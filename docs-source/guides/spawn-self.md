# Self-Spawning Agents

Self-spawning lets a single agent dynamically create copies of itself to handle parallel sub-tasks. Unlike [Agent Groups](agent-groups.md) (which require a fixed topology at construction time) or [Multi-Agent Swarms](multi-agent.md) (which pre-define the agent roster), self-spawning happens at runtime -- the LLM decides when and how to decompose work.

When enabled, the agent receives a `spawn_self` tool. Each call creates one or more child agents that run concurrently, share the parent's long-term memory, and return their combined results as a single tool response.

## Enabling Self-Spawn

Set `allow_self_spawn=True` on the agent constructor:

```python
from exo.agent import Agent
from exo.runner import run

agent = Agent(
    name="researcher",
    model="openai:gpt-4o",
    instructions=(
        "You are a research assistant. When a question has multiple independent "
        "parts, use spawn_self to investigate them in parallel."
    ),
    allow_self_spawn=True,
)

result = await run(agent, "Compare the economies of Japan, Germany, and Brazil.")
print(result.output)
```

The agent now has a `spawn_self` tool in its tool list. The LLM sees its schema and can decide to call it whenever parallel decomposition makes sense.

## How spawn_self Works

The `spawn_self` tool accepts a single argument:

```
spawn_self(tasks: list[str]) -> str
```

Each string in `tasks` is a sub-task prompt. For every task, Exo creates a new child agent with:

- The same model, instructions, tools, temperature, and step limit as the parent
- Fresh short-term memory (conversation history is not carried over)
- Shared long-term memory (knowledge accumulates across spawns)
- A forked context from the parent

All children run concurrently via `asyncio.TaskGroup`. When all children finish, the tool returns their combined outputs.

### Single Task

When `tasks` contains exactly one item, the tool returns the child's output directly as a plain string.

### Multiple Tasks

When `tasks` contains multiple items, the tool returns a formatted string with labeled results:

```
[Task 1]: <output from child 1>

[Task 2]: <output from child 2>

[Task 3]: <output from child 3>
```

The parent agent receives this combined result as the tool response and can synthesize, summarize, or act on it.

## Configuration Parameters

Three parameters on the `Agent` constructor control self-spawn behavior:

| Parameter | Type | Default | Range | Description |
|-----------|------|---------|-------|-------------|
| `allow_self_spawn` | `bool` | `False` | -- | Adds the `spawn_self` tool to the agent |
| `max_spawn_depth` | `int` | `3` | >= 1 | Maximum recursive nesting depth |
| `max_spawn_children` | `int` | `4` | 1--8 | Maximum parallel children per `spawn_self` call |

```python
agent = Agent(
    name="deep_researcher",
    model="anthropic:claude-sonnet-4-20250514",
    instructions="Break complex research into parallel sub-tasks.",
    allow_self_spawn=True,
    max_spawn_depth=2,     # Allow one level of sub-spawning
    max_spawn_children=6,  # Up to 6 parallel children per call
)
```

## Depth Guards

Every agent tracks its current spawn depth internally (starting at 0 for the top-level agent). Each child increments the depth by 1. When a child's depth equals or exceeds `max_spawn_depth`, calling `spawn_self` returns an error string instead of spawning:

```
[spawn_self error] Maximum spawn depth (3) reached. Cannot spawn further sub-agents.
```

This prevents runaway recursion. The agent sees this error as a tool result and must complete the task with its own capabilities.

### Depth Example

With `max_spawn_depth=3` (the default):

| Level | Depth | Can spawn? |
|-------|-------|------------|
| Original agent | 0 | Yes |
| First-generation child | 1 | Yes |
| Second-generation child | 2 | Yes |
| Third-generation child | 3 | No -- returns error |

## Children Limit

If the LLM tries to pass more tasks than `max_spawn_children` allows, the tool returns an error immediately without spawning any children:

```
[spawn_self error] Too many tasks (7). Maximum is 4 per call.
```

An empty tasks list also returns an error:

```
[spawn_self error] Empty tasks list. Provide at least one task.
```

## Memory Isolation

Children do **not** inherit the parent's conversation history. Each child starts with a clean short-term memory so it focuses exclusively on its assigned sub-task.

However, children **do** share the parent's long-term memory store. This means:

- Knowledge extracted during earlier runs is available to children
- Children can write to long-term memory, and those writes are visible to the parent and siblings
- This shared long-term memory enables knowledge accumulation across spawn generations

If the parent has memory disabled (`memory=None`), children also have no memory.

## Context Forking

When the parent agent has a context engine configured, each child receives a **forked** copy of the parent's context. This means:

- The child inherits the parent's state hierarchy at the time of forking
- Changes the child makes to its context do not affect the parent
- If the fork operation fails for any reason, the child shares the parent's context directly as a fallback

If the parent has no context (`context=None`), children also have no context.

## Tool Inheritance

Children inherit all of the parent's tools **except**:

- The `spawn_self` tool itself (children have `allow_self_spawn=False` by default)
- Context tools (tools marked with `_is_context_tool`)

This means children can use the same domain tools as the parent but cannot spawn further children of their own. To enable multi-level spawning, children at depth < `max_spawn_depth` would need their own spawn capability -- but in the current implementation, only the original top-level agent has `spawn_self`.

## Error Handling

If a child agent raises an exception during execution, the error is captured and included in the results rather than crashing the entire spawn operation:

```
[Task 1]: <successful output>

[Task 2]: [child 2 error] Connection timeout after 30s

[Task 3]: <successful output>
```

The parent agent sees these errors in the tool response and can decide how to handle them -- retry, skip, or report the failure.

## Example: Parallel Research

A common pattern is an agent that decomposes a broad question into independent sub-questions, spawns children to research each one, then synthesizes the results:

```python
from exo.agent import Agent
from exo.tool import tool
from exo.runner import run


@tool
def search_web(query: str) -> str:
    """Search the web for information.

    Args:
        query: The search query.
    """
    # In production, this would call a real search API
    return f"Search results for: {query}"


agent = Agent(
    name="research_agent",
    model="openai:gpt-4o",
    instructions=(
        "You are a senior research analyst. When given a complex question, "
        "break it into independent sub-questions and use spawn_self to "
        "research each one in parallel. Then synthesize the findings into "
        "a coherent answer."
    ),
    tools=[search_web],
    allow_self_spawn=True,
    max_spawn_children=4,
)

result = await run(
    agent,
    "What are the key differences between the tech industries in "
    "Silicon Valley, Shenzhen, Bangalore, and Tel Aviv?",
)
print(result.output)
```

In this example, the agent might call:

```python
spawn_self(tasks=[
    "Research the tech industry in Silicon Valley: key companies, specializations, culture.",
    "Research the tech industry in Shenzhen: key companies, specializations, culture.",
    "Research the tech industry in Bangalore: key companies, specializations, culture.",
    "Research the tech industry in Tel Aviv: key companies, specializations, culture.",
])
```

Each child receives the `search_web` tool and works independently. The parent receives all four results and writes a comparative analysis.

## Example: Streaming with Self-Spawn

Self-spawn works with streaming. The parent agent's stream includes events from the spawn tool call and the final synthesis:

```python
import asyncio
from exo.agent import Agent
from exo.runner import run


agent = Agent(
    name="analyst",
    model="openai:gpt-4o",
    instructions="Decompose analysis tasks and use spawn_self for parallel work.",
    allow_self_spawn=True,
    max_spawn_children=3,
)


async def main():
    async for event in run.stream(agent, "Analyze the pros and cons of solar, wind, and nuclear energy."):
        if event.type == "text":
            print(event.text, end="", flush=True)
        elif event.type == "tool_call":
            print(f"\n[Calling: {event.tool_name}]")
    print()


asyncio.run(main())
```

## When to Use Self-Spawn vs Other Patterns

| Pattern | Best for | Defined at |
|---------|----------|------------|
| **Self-spawn** | Dynamic decomposition -- the LLM decides the sub-tasks at runtime | Runtime (agent decides) |
| **ParallelGroup** | Fixed parallel topology known at build time | Build time (developer defines) |
| **Swarm (team mode)** | Lead agent delegating to specialized workers with different tools/instructions | Build time (developer defines) |
| **Handoff** | Sequential agent-driven delegation where each agent has a distinct role | Build time (developer defines) |

Self-spawn is the right choice when you cannot predict the sub-task structure in advance -- for example, when the number of parallel tasks depends on the user's input.
