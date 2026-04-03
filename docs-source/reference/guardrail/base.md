# exo.guardrail.base

Hook-based guardrail that integrates with an Agent's `HookManager`. Provides the attach/detach lifecycle for registering detection hooks on agent events.

## Module Path

```python
from exo.guardrail.base import BaseGuardrail
```

---

## BaseGuardrail

A guardrail that registers itself as hooks on an Agent's `HookManager`. When an event fires, the guardrail runs its backend's `analyze()` method and raises `GuardrailError` if the risk level is `HIGH` or `CRITICAL`.

### Constructor

```python
BaseGuardrail(
    backend: GuardrailBackend | None = None,
    events: list[str] | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `backend` | `GuardrailBackend \| None` | `None` | Detection backend. When `None`, `detect()` always returns `GuardrailResult.safe()` |
| `events` | `list[str] \| None` | `None` | Hook point names to monitor (e.g., `["pre_llm_call"]`). Only these events get hooks registered |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `backend` | `GuardrailBackend \| None` | The detection backend instance |
| `events` | `list[str]` | List of hook point names being monitored |

### Methods

#### attach()

```python
def attach(self, agent: Agent) -> None
```

Register guardrail hooks on an agent's `hook_manager`. Each event in `self.events` gets an async hook that calls `detect()` and raises `GuardrailError` when the risk level is `HIGH` or `CRITICAL`.

Existing hooks on the agent are not disturbed -- guardrail hooks are appended. Calling `attach()` on an already-attached agent is a no-op.

| Parameter | Type | Description |
|---|---|---|
| `agent` | `Agent` | The agent to attach to |

#### detach()

```python
def detach(self, agent: Agent) -> None
```

Remove previously registered guardrail hooks from an agent. Only removes the hooks that were added by this guardrail instance. Calling `detach()` on a non-attached agent is a no-op.

| Parameter | Type | Description |
|---|---|---|
| `agent` | `Agent` | The agent to detach from |

#### detect()

```python
async def detect(self, event: str, **data: Any) -> GuardrailResult
```

Run the backend analysis and return a guardrail result. If no backend is set, returns `GuardrailResult.safe()`.

| Parameter | Type | Description |
|---|---|---|
| `event` | `str` | The hook point name that triggered detection |
| `**data` | `Any` | Keyword arguments from the hook invocation |

**Returns:** A `GuardrailResult` indicating whether the data is safe.

**Behavior:**
1. If `self.backend` is `None`, returns `GuardrailResult.safe()` immediately
2. Calls `self.backend.analyze({"event": event, **data})` to get a `RiskAssessment`
3. If `assessment.has_risk` is `False`, returns `GuardrailResult.safe()`
4. Otherwise, returns `GuardrailResult.block()` with the assessment's risk info

### Example

```python
import asyncio
from exo import Agent
from exo.guardrail import BaseGuardrail, GuardrailBackend, RiskAssessment, RiskLevel

class MyBackend(GuardrailBackend):
    async def analyze(self, data):
        text = str(data)
        if "danger" in text.lower():
            return RiskAssessment(
                has_risk=True,
                risk_level=RiskLevel.HIGH,
                risk_type="dangerous_content",
            )
        return RiskAssessment(has_risk=False, risk_level=RiskLevel.SAFE)

agent = Agent(name="my-agent", model="openai:gpt-4o-mini")

guard = BaseGuardrail(
    backend=MyBackend(),
    events=["pre_llm_call"],
)

# Attach -- hooks are registered on the agent
guard.attach(agent)

# ... agent runs, guardrail hooks fire automatically ...

# Detach -- hooks are cleanly removed
guard.detach(agent)
```

### Lifecycle Diagram

```
                  attach(agent)
                       |
          resolve event names -> HookPoint enums
                       |
          for each HookPoint:
              create async hook -> calls detect() -> may raise GuardrailError
              agent.hook_manager.add(point, hook)
                       |
               agent runs normally
           hooks fire on matching events
                       |
                  detach(agent)
                       |
          for each registered hook:
              agent.hook_manager.remove(point, hook)
```
