# Rails

Rails are structured lifecycle guards that attach to agent hook points and control execution flow. Unlike raw [hooks](hooks.md), which are fire-and-forget async functions, rails return a `RailAction` that tells the framework what to do next -- continue, skip the operation, retry it, or abort the entire run. Rails run in priority order, support cross-rail state sharing, and integrate directly with the `Agent` constructor via the `rails=` parameter.

## How Rails Differ from Hooks

| Feature | Hooks | Rails |
|---------|-------|-------|
| **Return value** | None (fire-and-forget) | `RailAction` that controls execution flow |
| **Priority ordering** | Registration order | Numeric priority (lower runs first) |
| **Cross-invocation state** | Manual (closures or classes) | Built-in `extra` dict shared across all rails |
| **Retry support** | No | Yes, via `RailAction.RETRY` and `RetryRequest` |
| **Skip support** | No (must raise to abort) | Yes, via `RailAction.SKIP` |
| **Definition style** | Async functions | Class-based (subclass `Rail` ABC) |

Use hooks for lightweight side effects (logging, metrics). Use rails when you need to inspect and **control** the agent's behavior at lifecycle points.

## RailAction Enum

Every rail returns a `RailAction` to indicate what should happen next:

```python
from exo.rail import RailAction
```

| Action | Effect |
|--------|--------|
| `RailAction.CONTINUE` | Proceed to the next rail, then to the guarded operation. |
| `RailAction.SKIP` | Skip the guarded operation entirely. |
| `RailAction.RETRY` | Retry the guarded operation (pair with `RetryRequest`). |
| `RailAction.ABORT` | Abort the agent run immediately. Raises `RailAbortError`. |

Returning `None` from a rail is treated as `CONTINUE`.

## Defining a Rail

Subclass the `Rail` abstract base class and implement the `handle` method:

```python
from exo.rail import Rail, RailAction

class LogEveryCall(Rail):
    """A minimal rail that logs every lifecycle event."""

    def __init__(self):
        super().__init__(name="log_every_call", priority=10)

    async def handle(self, ctx):
        print(f"[{self.name}] event={ctx.event.value}, agent={ctx.agent.name}")
        return RailAction.CONTINUE
```

### Constructor Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `str` | (required) | Unique identifier for this rail. |
| `priority` | `int` | `50` | Execution order. Lower numbers run first. |

### The `handle` Method

```python
async def handle(self, ctx: RailContext) -> RailAction | None:
```

The `handle` method receives a `RailContext` and must return a `RailAction` (or `None` for `CONTINUE`). This is the only method you need to implement.

## RailContext

The `RailContext` object bundles everything a rail needs to make its decision:

```python
from exo.rail_types import RailContext
```

| Field | Type | Description |
|-------|------|-------------|
| `agent` | `Agent` | The agent instance that triggered the event. |
| `event` | `HookPoint` | The lifecycle point (`START`, `PRE_LLM_CALL`, etc.). |
| `inputs` | `InvokeInputs \| ModelCallInputs \| ToolCallInputs` | Typed inputs specific to the event. |
| `extra` | `dict[str, Any]` | Shared dict for cross-rail state (see below). |

### Typed Inputs by Event

The `inputs` field is automatically populated with the correct type based on the event:

| Event | Input Type | Key Fields |
|-------|-----------|------------|
| `START`, `FINISHED` | `InvokeInputs` | `input`, `messages`, `result` |
| `PRE_LLM_CALL`, `POST_LLM_CALL` | `ModelCallInputs` | `messages`, `tools`, `response`, `usage` |
| `PRE_TOOL_CALL`, `POST_TOOL_CALL` | `ToolCallInputs` | `tool_name`, `arguments`, `result`, `metadata` |

Input models are **mutable** -- a rail can modify `ctx.inputs` fields before the next rail or the guarded operation sees them.

## Priority Ordering

Rails run in ascending priority order (lower numbers first). This lets you layer rails predictably:

```python
class AuthRail(Rail):
    def __init__(self):
        super().__init__(name="auth", priority=10)  # Runs first

    async def handle(self, ctx):
        # Check authentication before anything else
        ...

class ContentFilter(Rail):
    def __init__(self):
        super().__init__(name="content_filter", priority=50)  # Runs second

    async def handle(self, ctx):
        # Filter content after auth passes
        ...

class AuditLog(Rail):
    def __init__(self):
        super().__init__(name="audit_log", priority=90)  # Runs last

    async def handle(self, ctx):
        # Log the event after all other rails have passed
        ...
```

When any rail returns a non-`CONTINUE` action, execution stops -- subsequent rails in the chain are not called.

## Cross-Rail State Sharing

The `ctx.extra` dict is shared across all rails within a single invocation. This enables coordination between rails without coupling them directly:

```python
class TimingStartRail(Rail):
    def __init__(self):
        super().__init__(name="timing_start", priority=1)

    async def handle(self, ctx):
        import time
        ctx.extra["start_time"] = time.monotonic()
        return RailAction.CONTINUE


class TimingEndRail(Rail):
    def __init__(self):
        super().__init__(name="timing_end", priority=99)

    async def handle(self, ctx):
        import time
        start = ctx.extra.get("start_time")
        if start is not None:
            elapsed = time.monotonic() - start
            print(f"Rail chain took {elapsed:.3f}s")
        return RailAction.CONTINUE
```

A fresh `extra` dict is created for each `RailManager.run()` invocation, so state does not leak between lifecycle events.

## Using Rails with an Agent

Pass rails to the `Agent` constructor via the `rails=` parameter:

```python
from exo import Agent
from exo.rail import Rail, RailAction

class BlockDangerousTool(Rail):
    def __init__(self, blocked_tools: list[str]):
        super().__init__(name="block_dangerous", priority=20)
        self.blocked_tools = set(blocked_tools)

    async def handle(self, ctx):
        if hasattr(ctx.inputs, "tool_name"):
            if ctx.inputs.tool_name in self.blocked_tools:
                return RailAction.ABORT
        return RailAction.CONTINUE

agent = Agent(
    name="safe_agent",
    model="openai:gpt-4o",
    instructions="You are a helpful assistant.",
    rails=[
        BlockDangerousTool(blocked_tools=["delete_file", "drop_table"]),
    ],
)
```

Under the hood, the `Agent` constructor creates a `RailManager`, adds each rail to it, and registers a hook for every `HookPoint`. When a rail returns `ABORT`, a `RailAbortError` is raised to halt the run.

## RailManager

The `RailManager` class orchestrates rail execution. You rarely need to use it directly -- the `Agent` constructor handles it -- but it is available for advanced use cases.

```python
from exo.rail import RailManager
from exo.hooks import HookPoint

manager = RailManager()
manager.add(my_rail)
manager.add(another_rail)

# Run all rails for an event
action = await manager.run(
    HookPoint.PRE_TOOL_CALL,
    agent=agent,
    tool_name="search",
    arguments={"query": "hello"},
)
```

### RailManager Methods

| Method | Description |
|--------|-------------|
| `add(rail)` | Add a rail to the manager. |
| `remove(rail)` | Remove a rail (raises `ValueError` if not found). |
| `clear()` | Remove all rails. |
| `run(event, **data)` | Run all rails in priority order. Returns the first non-`CONTINUE` action, or `CONTINUE`. |
| `hook_for(event)` | Create an async hook callable for a specific `HookPoint`. If any rail returns `ABORT`, the hook raises `RailAbortError`. |

## RailAbortError

When a rail returns `RailAction.ABORT`, the framework raises `RailAbortError` to halt the agent run:

```python
from exo.rail import RailAbortError

try:
    result = await run(agent, "Do something dangerous")
except RailAbortError as e:
    print(f"Aborted by rail: {e.rail_name}")
    print(f"Reason: {e.reason}")
```

| Attribute | Type | Description |
|-----------|------|-------------|
| `rail_name` | `str` | Name of the rail that triggered the abort. |
| `reason` | `str` | Human-readable reason (may be empty). |

## RetryRequest

When returning `RailAction.RETRY`, attach a `RetryRequest` to `ctx.extra` so the caller knows how to retry:

```python
from exo.rail import Rail, RailAction, RetryRequest

class RateLimitRail(Rail):
    def __init__(self):
        super().__init__(name="rate_limit", priority=5)
        self._call_count = 0

    async def handle(self, ctx):
        from exo.hooks import HookPoint
        if ctx.event == HookPoint.PRE_LLM_CALL:
            self._call_count += 1
            if self._call_count > 10:
                ctx.extra["retry_request"] = RetryRequest(
                    delay=2.0,
                    max_retries=3,
                    reason="Rate limit exceeded, backing off",
                )
                return RailAction.RETRY
        return RailAction.CONTINUE
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `delay` | `float` | `0.0` | Seconds to wait before retrying. |
| `max_retries` | `int` | `1` | Maximum retry attempts. |
| `reason` | `str` | `""` | Human-readable explanation. |

## Example: Content Filtering Rail

A complete example that filters both user input and model output:

```python
from exo import Agent, run
from exo.hooks import HookPoint
from exo.rail import Rail, RailAction

BLOCKED_PHRASES = ["hack into", "steal credentials", "bypass security"]


class ContentFilterRail(Rail):
    """Block requests and responses containing dangerous phrases."""

    def __init__(self):
        super().__init__(name="content_filter", priority=30)

    async def handle(self, ctx):
        text = ""

        # Check user input at invocation start
        if ctx.event == HookPoint.START:
            text = ctx.inputs.input.lower()

        # Check messages being sent to the model
        elif ctx.event == HookPoint.PRE_LLM_CALL:
            for msg in ctx.inputs.messages:
                if isinstance(msg, dict):
                    text += " " + str(msg.get("content", "")).lower()

        # Check model response
        elif ctx.event == HookPoint.POST_LLM_CALL:
            if ctx.inputs.response:
                text = str(getattr(ctx.inputs.response, "content", "")).lower()

        for phrase in BLOCKED_PHRASES:
            if phrase in text:
                ctx.extra["blocked_phrase"] = phrase
                return RailAction.ABORT

        return RailAction.CONTINUE


agent = Agent(
    name="filtered_agent",
    model="openai:gpt-4o",
    instructions="You are a helpful assistant.",
    rails=[ContentFilterRail()],
)
```

## Example: Combining Multiple Rails

Rails compose naturally. Stack them to build layered safety:

```python
from exo import Agent
from exo.rail import Rail, RailAction

class InputLengthRail(Rail):
    """Reject excessively long inputs."""

    def __init__(self, max_chars: int = 10000):
        super().__init__(name="input_length", priority=10)
        self.max_chars = max_chars

    async def handle(self, ctx):
        from exo.hooks import HookPoint
        if ctx.event == HookPoint.START:
            if len(ctx.inputs.input) > self.max_chars:
                return RailAction.ABORT
        return RailAction.CONTINUE


class ToolAllowlistRail(Rail):
    """Only allow specific tools to be called."""

    def __init__(self, allowed: list[str]):
        super().__init__(name="tool_allowlist", priority=20)
        self.allowed = set(allowed)

    async def handle(self, ctx):
        from exo.hooks import HookPoint
        if ctx.event in (HookPoint.PRE_TOOL_CALL,):
            if ctx.inputs.tool_name not in self.allowed:
                return RailAction.SKIP
        return RailAction.CONTINUE


agent = Agent(
    name="locked_down_agent",
    model="openai:gpt-4o",
    instructions="You are a helpful assistant.",
    rails=[
        InputLengthRail(max_chars=5000),
        ToolAllowlistRail(allowed=["search", "calculate"]),
    ],
)
```

## Rails vs Guardrails (exo-guardrail)

Exo has two complementary safety systems:

| Feature | Rails (`exo.rail`) | Guardrails (`exo.guardrail`) |
|---------|---------------------|-------------------------------|
| **Package** | `exo-core` | `exo-guardrail` |
| **Purpose** | General-purpose lifecycle control | Specialized prompt injection and jailbreak detection |
| **Interface** | `Rail` ABC with `handle()` method | `BaseGuardrail` with pluggable `GuardrailBackend` |
| **Actions** | `CONTINUE`, `SKIP`, `RETRY`, `ABORT` | Risk levels (`LOW`, `MEDIUM`, `HIGH`, `CRITICAL`) |
| **Detection** | Custom logic you write | Pattern-based (`PatternBackend`) or LLM-based (`LLMGuardrailBackend`) |
| **Attachment** | `Agent(rails=[...])` | `guard.attach(agent)` / `guard.detach(agent)` |

Use **rails** when you need full control over execution flow (input validation, tool allowlists, rate limiting, retry logic). Use **guardrails** when you need specialized threat detection with pluggable backends for prompt injection, jailbreak attempts, or content policy violations.

Both systems ultimately integrate through the same hook infrastructure -- guardrails register themselves as hooks on the agent's `HookManager`, while rails register through a `RailManager` that creates hooks for every lifecycle point.

## API Summary

| Symbol | Module | Description |
|--------|--------|-------------|
| `Rail` | `exo.rail` | Abstract base class for rails |
| `RailAction` | `exo.rail` | Enum: `CONTINUE`, `SKIP`, `RETRY`, `ABORT` |
| `RailManager` | `exo.rail` | Manages rail registration, priority ordering, and execution |
| `RailAbortError` | `exo.rail` | Exception raised when a rail returns `ABORT` |
| `RetryRequest` | `exo.rail` | Dataclass for retry parameters (delay, max_retries, reason) |
| `RailContext` | `exo.rail_types` | Context object passed to `handle()` with agent, event, inputs, and extra dict |
| `InvokeInputs` | `exo.rail_types` | Typed inputs for `START` / `FINISHED` events |
| `ModelCallInputs` | `exo.rail_types` | Typed inputs for `PRE_LLM_CALL` / `POST_LLM_CALL` events |
| `ToolCallInputs` | `exo.rail_types` | Typed inputs for `PRE_TOOL_CALL` / `POST_TOOL_CALL` events |
