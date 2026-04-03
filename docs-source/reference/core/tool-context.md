# exo.tool_context

Injectable context for tools that need to emit streaming events back to the parent agent.

## ToolContext

```python
from exo import ToolContext
```

`ToolContext` is automatically injected into any tool that declares a parameter with the `ToolContext` type annotation. The runtime detects the type and provides the instance -- it is excluded from the tool's JSON schema.

### Constructor

| Parameter | Type | Description |
|-----------|------|-------------|
| `agent_name` | `str` | Name of the parent agent |
| `queue` | `asyncio.Queue[StreamEvent]` | The parent agent's event queue |

### Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `agent_name` | `str` | Name of the parent agent |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `emit(event)` | `None` | Push a `StreamEvent` to the parent agent's stream (non-blocking) |

Events pushed via `emit()` are buffered in an `asyncio.Queue` and drained by `run.stream()` after tool execution completes.

### Usage

```python
from exo import tool, ToolContext
from exo.types import TextEvent

@tool
async def analyze(data: str, ctx: ToolContext) -> str:
    """Analyze data with progress streaming.

    Args:
        data: The data to analyze.
        ctx: Injected automatically by the runtime.
    """
    ctx.emit(TextEvent(type="text", text="Starting analysis...\n", agent_name=ctx.agent_name))
    # ... perform analysis ...
    ctx.emit(TextEvent(type="text", text="Analysis complete.\n", agent_name=ctx.agent_name))
    return f"Analysis result for {data}"
```

The `ctx` parameter name is arbitrary -- the runtime matches by type annotation, not by name. The parameter is automatically excluded from the tool's JSON schema so the LLM never sees it.

### Use Case: Nested Agent Streaming

`ToolContext` enables nested agents (e.g., those spawned via `spawn_self`) to stream events back to the top-level caller:

```python
@tool
async def delegate_research(topic: str, ctx: ToolContext) -> str:
    """Spawn a sub-agent for research, streaming its output.

    Args:
        topic: Research topic.
        ctx: Injected automatically.
    """
    sub_agent = Agent(name="researcher", model="openai:gpt-4o-mini")
    async for event in run.stream(sub_agent, f"Research: {topic}"):
        ctx.emit(event)  # Forward sub-agent events to parent stream
    # ...
```
