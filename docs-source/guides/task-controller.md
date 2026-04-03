# Task Controller

The task controller allows external code to influence a running agent mid-execution. By pushing events into a `TaskLoopQueue`, you can steer the agent in a new direction, ask follow-up questions, or abort the run entirely -- all without modifying the agent's own logic.

## Core Concepts

The task controller has three main components:

1. **`TaskLoopEventType`** -- an enum that defines three event types with strict priority ordering.
2. **`TaskLoopEvent`** -- a dataclass representing a single event with a type, content, and optional metadata.
3. **`TaskLoopQueue`** -- a thread-safe priority queue that connects external code to the agent's tool loop.

When the agent processes its tool loop, the queue is drained between steps. Events are sorted by priority: ABORT events are always processed first, then STEER events, then FOLLOWUP events. Within the same priority, events are processed in insertion order (FIFO).

## TaskLoopEventType

The `TaskLoopEventType` enum defines three event types, ordered by priority (lower value = higher priority):

```python
from exo.task_controller import TaskLoopEventType

TaskLoopEventType.ABORT    # 0 -- highest priority, stops the agent
TaskLoopEventType.STEER    # 1 -- redirects the agent
TaskLoopEventType.FOLLOWUP # 2 -- lowest priority, adds context
```

| Type | Value | Effect |
|------|-------|--------|
| `ABORT` | 0 | Raises `TaskLoopAbort`, stopping the agent immediately |
| `STEER` | 1 | Injects a `UserMessage` with `[STEER] {content}` into the conversation |
| `FOLLOWUP` | 2 | Injects a `UserMessage` with `[FOLLOWUP] {content}` into the conversation |

Priority ordering means that if an ABORT and a STEER event are both in the queue, the ABORT is always processed first -- the agent stops before the steer instruction is ever seen.

## TaskLoopEvent

A `TaskLoopEvent` is a dataclass representing a single event destined for the agent's tool loop.

```python
from exo.task_controller import TaskLoopEvent, TaskLoopEventType

event = TaskLoopEvent(
    type=TaskLoopEventType.STEER,
    content="Focus on summarizing the results instead of searching further.",
    metadata={"source": "supervisor"},
)
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `type` | `TaskLoopEventType` | *(required)* | The event type (determines priority) |
| `content` | `str` | `""` | Textual content for the event (e.g. a steering instruction or abort reason) |
| `metadata` | `dict[str, Any]` | `{}` | Arbitrary key-value payload for custom data |

Events are ordered by `(type, insertion_order)`. Two events with the same type are dequeued in the order they were pushed.

## TaskLoopQueue

The `TaskLoopQueue` is a thread-safe priority queue built on a heap. It is safe to push events from any thread (e.g. a monitoring process, a web handler, or another asyncio task) and pop from the agent's asyncio event loop.

```python
from exo.task_controller import TaskLoopQueue, TaskLoopEvent, TaskLoopEventType

queue = TaskLoopQueue()

# Push events from anywhere (thread-safe)
queue.push(TaskLoopEvent(type=TaskLoopEventType.STEER, content="Try a different approach"))
queue.push(TaskLoopEvent(type=TaskLoopEventType.FOLLOWUP, content="Also check the backup logs"))

# Check queue state
len(queue)    # 2
bool(queue)   # True

# Peek without removing
event = queue.peek()  # returns highest-priority event, or None

# Pop the highest-priority event
event = queue.pop()   # returns and removes highest-priority event, or None
```

### API

| Method | Returns | Description |
|--------|---------|-------------|
| `push(event)` | `None` | Add an event to the queue |
| `pop()` | `TaskLoopEvent \| None` | Remove and return the highest-priority event, or `None` if empty |
| `peek()` | `TaskLoopEvent \| None` | Return the highest-priority event without removing it, or `None` |
| `len(queue)` | `int` | Number of events in the queue |
| `bool(queue)` | `bool` | `True` if the queue is non-empty |

## How Events Are Processed

Between each step of the agent's tool loop, the runtime drains the queue using an internal `_drain_task_loop_queue` function. The drain process works as follows:

1. All events are popped from the queue and sorted by priority.
2. Events are processed in order:
   - **ABORT** -- raises `TaskLoopAbort`, stopping the agent immediately. No further events are processed.
   - **STEER** -- appends a `UserMessage` with content `[STEER] {event.content}` to the conversation history.
   - **FOLLOWUP** -- appends a `UserMessage` with content `[FOLLOWUP] {event.content}` to the conversation history.
3. The agent then sees the injected messages on its next LLM call and adjusts its behavior accordingly.

```
             External code
                  |
                  v
        queue.push(event)
                  |
                  v
          +-----------------+
          | TaskLoopQueue   |  (thread-safe heap)
          +-----------------+
                  |
                  v  (drained between agent steps)
          +-----------------+
          | _drain_queue()  |  sort by priority, process
          +-----------------+
           /      |       \
        ABORT   STEER   FOLLOWUP
          |       |         |
        raise   inject    inject
        error   [STEER]   [FOLLOWUP]
                message    message
```

## Built-in Tools: steer_agent and abort_agent

Exo provides two pre-built tools that push events to a `TaskLoopQueue`. These are useful when one agent needs to control another, or when tools within an agent need to redirect or stop the agent's own loop.

```python
from exo.task_controller import steer_agent_tool, abort_agent_tool, get_task_loop_tools

# Get both tools as a list
tools = get_task_loop_tools()  # [steer_agent_tool, abort_agent_tool]
```

Before use, each tool must be bound to a queue:

```python
from exo.task_controller import TaskLoopQueue

queue = TaskLoopQueue()
steer_agent_tool.bind(queue)
abort_agent_tool.bind(queue)
```

Once bound, calling the tool pushes an event to the queue:

```python
# These are async -- typically called by the agent runtime
await steer_agent_tool.execute(content="Switch to plan B")
# Pushes TaskLoopEvent(type=STEER, content="Switch to plan B")

await abort_agent_tool.execute(reason="Budget exceeded")
# Pushes TaskLoopEvent(type=ABORT, content="Budget exceeded")
```

The `queue` parameter is excluded from the tool's JSON schema, so the LLM never sees it. The LLM only sees the `content` or `reason` parameter.

## Example: Steering an Agent from Another Task

This example shows a supervisor coroutine that monitors an agent's progress and steers it mid-execution by pushing events into a shared queue.

```python
import asyncio
from exo import Agent, run
from exo.task_controller import TaskLoopQueue, TaskLoopEvent, TaskLoopEventType

agent = Agent(
    name="researcher",
    model="openai:gpt-4o",
    instructions="You are a research assistant. Follow any [STEER] instructions.",
)

queue = TaskLoopQueue()


async def supervisor(queue: TaskLoopQueue):
    """External process that monitors and steers the agent."""
    # Wait a bit, then redirect the agent
    await asyncio.sleep(5)
    queue.push(TaskLoopEvent(
        type=TaskLoopEventType.STEER,
        content="Stop researching history and focus on recent developments from 2025.",
    ))

    # Wait more, then add a follow-up question
    await asyncio.sleep(10)
    queue.push(TaskLoopEvent(
        type=TaskLoopEventType.FOLLOWUP,
        content="Also include statistics on adoption rates.",
    ))


async def main():
    # Start the supervisor in the background
    supervisor_task = asyncio.create_task(supervisor(queue))

    # Run the agent (the queue is checked between each tool loop step)
    result = await run(agent, "Research the state of AI in healthcare")

    supervisor_task.cancel()
    print(result.output)


asyncio.run(main())
```

## Example: Aborting an Agent on Timeout

```python
import asyncio
from exo import Agent, run
from exo.agent import TaskLoopAbort
from exo.task_controller import TaskLoopQueue, TaskLoopEvent, TaskLoopEventType

agent = Agent(
    name="long-running-agent",
    model="openai:gpt-4o",
    instructions="You are a thorough analyst.",
    max_steps=20,
)

queue = TaskLoopQueue()


async def timeout_watchdog(queue: TaskLoopQueue, seconds: float):
    """Abort the agent if it runs longer than the allowed time."""
    await asyncio.sleep(seconds)
    queue.push(TaskLoopEvent(
        type=TaskLoopEventType.ABORT,
        content=f"Execution time limit of {seconds}s exceeded.",
    ))


async def main():
    watchdog = asyncio.create_task(timeout_watchdog(queue, seconds=30.0))

    try:
        result = await run(agent, "Analyze all quarterly reports from 2020-2025")
        print(result.output)
    except TaskLoopAbort as e:
        print(f"Agent aborted: {e}")
    finally:
        watchdog.cancel()


asyncio.run(main())
```

## Example: Thread-Safe Steering from a Web Handler

Because `TaskLoopQueue` is thread-safe, you can push events from a web server thread while the agent runs on the asyncio event loop:

```python
from exo.task_controller import TaskLoopQueue, TaskLoopEvent, TaskLoopEventType

# Shared queue -- created once, referenced by both the agent runner and the web server
queue = TaskLoopQueue()


# In a Flask/Django/FastAPI route handler (possibly a different thread):
def handle_steer_request(new_instruction: str):
    queue.push(TaskLoopEvent(
        type=TaskLoopEventType.STEER,
        content=new_instruction,
    ))
    return {"status": "queued"}
```

## Task Manager and Scheduler

Beyond the event queue, the task controller package includes higher-level components for managing hierarchical tasks with lifecycle enforcement.

### TaskStatus

Tasks follow a state machine with defined transitions:

```python
from exo.task_controller import TaskStatus

# Lifecycle states
TaskStatus.SUBMITTED       # initial state
TaskStatus.WORKING         # actively being processed
TaskStatus.PAUSED          # temporarily halted
TaskStatus.INPUT_REQUIRED  # waiting for external input
TaskStatus.WAITING         # waiting for a dependency
TaskStatus.COMPLETED       # terminal: finished successfully
TaskStatus.CANCELED        # terminal: stopped
TaskStatus.FAILED          # can retry (transition back to SUBMITTED)
```

### TaskManager

The `TaskManager` provides CRUD operations on tasks with automatic status-transition validation and cascading effects:

```python
from exo.task_controller import TaskManager, TaskEventBus

bus = TaskEventBus()
manager = TaskManager(auto_complete_parent=True, event_bus=bus)

# Create tasks with hierarchy
parent = manager.create("Analyze dataset", priority=1)
child1 = manager.create("Load CSV files", parent_id=parent.id)
child2 = manager.create("Run statistics", parent_id=parent.id)

# Transition status (validated against allowed transitions)
manager.update(child1.id, status=TaskStatus.WORKING)
manager.update(child1.id, status=TaskStatus.COMPLETED)
manager.update(child2.id, status=TaskStatus.WORKING)
manager.update(child2.id, status=TaskStatus.COMPLETED)
# parent auto-completes when all children are COMPLETED

# List and filter
working_tasks = manager.list(status=TaskStatus.WORKING)
children = manager.get_children(parent.id)
```

Canceling a parent task cascades to all descendants automatically.

### TaskScheduler

The `TaskScheduler` executes eligible tasks concurrently with a configurable concurrency limit:

```python
from exo.task_controller import TaskScheduler, TaskManager

manager = TaskManager()
scheduler = TaskScheduler(manager, max_concurrent=3)

manager.create("Task A")
manager.create("Task B")
manager.create("Task C")
manager.create("Task D")  # will wait for a slot


async def execute(task):
    # Your task execution logic here
    print(f"Running {task.name}")


await scheduler.schedule(execute)
# Runs up to 3 tasks concurrently, transitions them through WORKING -> COMPLETED/FAILED
```

The scheduler also supports `pause()`, `resume()`, and `cancel()` operations on individual tasks.

### TaskEventBus

Subscribe to task lifecycle events for monitoring and side effects:

```python
from exo.task_controller import TaskEventBus, TaskEventType

bus = TaskEventBus()


async def on_task_completed(event):
    print(f"Task {event.task_id} completed at {event.timestamp}")


bus.subscribe(TaskEventType.COMPLETED, on_task_completed)
```

| Event Type | When it fires |
|------------|---------------|
| `CREATED` | A new task is created |
| `STARTED` | A task transitions to WORKING |
| `COMPLETED` | A task transitions to COMPLETED |
| `FAILED` | A task transitions to FAILED |
| `PAUSED` | A task transitions to PAUSED |
| `CANCELED` | A task transitions to CANCELED |

## API Summary

| Symbol | Import Path | Description |
|--------|-------------|-------------|
| `TaskLoopEventType` | `exo.task_controller` | Enum: ABORT (0), STEER (1), FOLLOWUP (2) |
| `TaskLoopEvent` | `exo.task_controller` | Dataclass: event with type, content, metadata |
| `TaskLoopQueue` | `exo.task_controller` | Thread-safe priority queue for events |
| `TaskLoopAbort` | `exo.agent` | Exception raised when an ABORT event is processed |
| `steer_agent_tool` | `exo.task_controller` | Pre-built tool that pushes STEER events |
| `abort_agent_tool` | `exo.task_controller` | Pre-built tool that pushes ABORT events |
| `get_task_loop_tools()` | `exo.task_controller` | Returns `[steer_agent_tool, abort_agent_tool]` |
| `Task` | `exo.task_controller` | Pydantic model for a managed task with lifecycle |
| `TaskStatus` | `exo.task_controller` | Enum of task lifecycle states |
| `TaskManager` | `exo.task_controller` | CRUD + status transitions + cascading effects |
| `TaskScheduler` | `exo.task_controller` | Concurrent task execution with semaphore throttling |
| `TaskEventBus` | `exo.task_controller` | Pub/sub bus for task lifecycle events |
| `TaskEventType` | `exo.task_controller` | Enum of lifecycle event types |
| `IntentRecognizer` | `exo.task_controller` | LLM-powered intent classification for task actions |
