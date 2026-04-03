# exo.rail

Security validation rails with priority ordering and cross-rail state sharing. Rails are lifecycle guards that intercept agent execution at hook points and return actions to control flow.

## RailAction

```python
class RailAction(enum.StrEnum):
    CONTINUE = "continue"  # Proceed to next rail or guarded operation
    SKIP = "skip"          # Skip the guarded operation entirely
    RETRY = "retry"        # Retry the guarded operation
    ABORT = "abort"        # Abort the agent run immediately
```

## Rail (ABC)

Abstract base class for agent rails. Rails are run in ascending `priority` order (lower numbers run first).

```python
from exo.rail import Rail, RailAction

class BlockDangerousTool(Rail):
    async def handle(self, ctx):
        if ctx.inputs.tool_name == "rm_rf":
            return RailAction.ABORT
        return RailAction.CONTINUE

rail = BlockDangerousTool(name="block_dangerous", priority=10)
```

### Constructor

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `name` | `str` | *required* | Unique identifier for this rail |
| `priority` | `int` | `50` | Execution order (lower = earlier) |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `handle(ctx)` | `RailAction \| None` | Inspect and act on a lifecycle event. Return `None` to continue. |

### RailContext

The `ctx` parameter passed to `handle()` contains:

| Attribute | Type | Description |
|-----------|------|-------------|
| `agent` | `Agent` | The agent being guarded |
| `event` | `HookPoint` | The lifecycle hook point |
| `inputs` | `InvokeInputs \| ModelCallInputs \| ToolCallInputs` | Typed inputs for the event |
| `extra` | `dict[str, Any]` | Shared state across rails in the same invocation |

## RailManager

Manages rails with priority ordering and cross-rail state sharing.

```python
from exo.rail import RailManager, RailAction
from exo.hooks import HookPoint

manager = RailManager()
manager.add(my_safety_rail)
action = await manager.run(HookPoint.PRE_LLM_CALL, agent=agent, messages=msgs)
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `add(rail)` | `None` | Add a rail to the manager |
| `remove(rail)` | `None` | Remove a rail (raises `ValueError` if not found) |
| `clear()` | `None` | Remove all rails |
| `run(event, **data)` | `RailAction` | Run all rails in priority order, return first non-CONTINUE action |
| `hook_for(event)` | `Hook` | Create a hook callable for use with `HookManager` |

### Integration with Agent

Pass rails directly to the Agent constructor:

```python
from exo import Agent
from exo.rail import Rail, RailAction

class ContentFilter(Rail):
    async def handle(self, ctx):
        # Check content before LLM call
        return RailAction.CONTINUE

agent = Agent(
    name="safe_agent",
    rails=[ContentFilter(name="content_filter", priority=10)],
)
```

## RetryRequest

Parameters for a RETRY action. Attach to the rail's return context when returning `RailAction.RETRY`.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `delay` | `float` | `0.0` | Seconds to wait before retrying |
| `max_retries` | `int` | `1` | Maximum retry attempts |
| `reason` | `str` | `""` | Human-readable explanation |

## RailAbortError

Raised when a rail returns `RailAction.ABORT`. Inherits from `ExoError`.

| Attribute | Type | Description |
|-----------|------|-------------|
| `rail_name` | `str` | Name of the rail that triggered the abort |
| `reason` | `str` | Human-readable reason |
