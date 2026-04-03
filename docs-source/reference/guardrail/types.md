# exo.guardrail.types

Core guardrail types: risk severity levels, risk assessments, guardrail results, error handling, and the abstract backend interface.

## Module Path

```python
from exo.guardrail.types import (
    RiskLevel,
    RiskAssessment,
    GuardrailResult,
    GuardrailError,
    GuardrailBackend,
)
```

---

## RiskLevel

Severity level of a detected risk. Inherits from `StrEnum`.

```python
class RiskLevel(StrEnum):
    SAFE = "safe"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"
```

| Value | Description |
|---|---|
| `SAFE` | No risk detected |
| `LOW` | Minor concern, does not trigger blocking |
| `MEDIUM` | Moderate concern, does not trigger blocking |
| `HIGH` | Serious risk, triggers automatic blocking |
| `CRITICAL` | Severe risk, triggers automatic blocking |

> **Blocking behavior:** `BaseGuardrail` automatically raises `GuardrailError` for `HIGH` and `CRITICAL` levels. `LOW` and `MEDIUM` results are logged but do not block execution.

---

## RiskAssessment

Result of a backend's risk analysis. Returned by `GuardrailBackend.analyze()`.

**Base class:** `pydantic.BaseModel` (frozen)

### Constructor

```python
RiskAssessment(
    has_risk: bool,
    risk_level: RiskLevel,
    risk_type: str | None = None,
    confidence: float = 1.0,
    details: dict[str, Any] = {},
)
```

| Field | Type | Default | Description |
|---|---|---|---|
| `has_risk` | `bool` | *(required)* | Whether any risk was detected |
| `risk_level` | `RiskLevel` | *(required)* | Severity of the detected risk |
| `risk_type` | `str \| None` | `None` | Category of risk (e.g., `"prompt_injection"`, `"pii_leak"`) |
| `confidence` | `float` | `1.0` | Backend's confidence in the assessment (0.0--1.0) |
| `details` | `dict[str, Any]` | `{}` | Additional metadata for logging and auditing |

### Example

```python
from exo.guardrail import RiskAssessment, RiskLevel

# Safe assessment
safe = RiskAssessment(has_risk=False, risk_level=RiskLevel.SAFE)

# Risk detected
risky = RiskAssessment(
    has_risk=True,
    risk_level=RiskLevel.HIGH,
    risk_type="prompt_injection",
    confidence=0.95,
    details={"matched_patterns": ["instruction_override"]},
)
```

---

## GuardrailResult

Outcome of a guardrail check, including an optional sanitised data modification. Returned by `BaseGuardrail.detect()`.

**Base class:** `pydantic.BaseModel` (frozen)

### Constructor

```python
GuardrailResult(
    is_safe: bool,
    risk_level: RiskLevel,
    risk_type: str | None = None,
    details: dict[str, Any] = {},
    modified_data: dict[str, Any] | None = None,
)
```

| Field | Type | Default | Description |
|---|---|---|---|
| `is_safe` | `bool` | *(required)* | Whether the data passed the guardrail check |
| `risk_level` | `RiskLevel` | *(required)* | Severity of the detected risk |
| `risk_type` | `str \| None` | `None` | Category of risk (e.g., `"prompt_injection"`, `"pii_leak"`) |
| `details` | `dict[str, Any]` | `{}` | Additional metadata for logging and auditing |
| `modified_data` | `dict[str, Any] \| None` | `None` | Optionally sanitised version of the original data |

### Class Methods

#### safe()

```python
@classmethod
def safe(cls) -> GuardrailResult
```

Create a result indicating the data is safe. Returns a `GuardrailResult` with `is_safe=True` and `risk_level=RiskLevel.SAFE`.

#### block()

```python
@classmethod
def block(
    cls,
    risk_level: RiskLevel,
    risk_type: str,
    details: dict[str, Any] | None = None,
) -> GuardrailResult
```

Create a result indicating the data should be blocked.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `risk_level` | `RiskLevel` | *(required)* | Severity of the detected risk |
| `risk_type` | `str` | *(required)* | Category of the detected risk |
| `details` | `dict[str, Any] \| None` | `None` | Additional context for logging and auditing |

**Returns:** `GuardrailResult` with `is_safe=False` and the given risk info.

### Example

```python
from exo.guardrail import GuardrailResult, RiskLevel

# Safe result
result = GuardrailResult.safe()
assert result.is_safe is True
assert result.risk_level == RiskLevel.SAFE

# Blocked result
result = GuardrailResult.block(
    risk_level=RiskLevel.HIGH,
    risk_type="prompt_injection",
    details={"matched_patterns": ["instruction_override"]},
)
assert result.is_safe is False
```

---

## GuardrailError

Exception raised when a guardrail blocks an operation. Inherits from `ExoError`.

### Constructor

```python
GuardrailError(
    message: str,
    *,
    risk_level: RiskLevel,
    risk_type: str | None = None,
    details: dict[str, Any] | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `str` | *(required)* | Human-readable error message |
| `risk_level` | `RiskLevel` | *(required)* | The risk level that triggered the block |
| `risk_type` | `str \| None` | `None` | Category of the detected risk |
| `details` | `dict[str, Any] \| None` | `None` | Additional context from the risk assessment |

### Attributes

| Attribute | Type | Description |
|---|---|---|
| `risk_level` | `RiskLevel` | The risk level that triggered the block |
| `risk_type` | `str \| None` | Category of the detected risk |
| `details` | `dict[str, Any]` | Additional context (defaults to `{}` if `None`) |

### Example

```python
from exo.guardrail import GuardrailError, RiskLevel

try:
    raise GuardrailError(
        "Prompt injection detected",
        risk_level=RiskLevel.HIGH,
        risk_type="prompt_injection",
        details={"matched_patterns": ["instruction_override"]},
    )
except GuardrailError as e:
    print(e.risk_level)   # RiskLevel.HIGH
    print(e.risk_type)    # "prompt_injection"
    print(e.details)      # {"matched_patterns": ["instruction_override"]}
```

---

## GuardrailBackend (ABC)

Abstract base class for pluggable guardrail detection backends. Subclasses implement `analyze()` to inspect data and return a `RiskAssessment`.

### Abstract Methods

#### analyze()

```python
async def analyze(self, data: dict[str, Any]) -> RiskAssessment
```

Analyze data for potential risks.

| Parameter | Type | Description |
|---|---|---|
| `data` | `dict[str, Any]` | Arbitrary data to inspect (e.g., messages, tool arguments) |

**Returns:** A `RiskAssessment` describing the detected risk level.

### Example

```python
from exo.guardrail import GuardrailBackend, RiskAssessment, RiskLevel

class MyBackend(GuardrailBackend):
    async def analyze(self, data: dict[str, Any]) -> RiskAssessment:
        text = str(data.get("messages", ""))
        if "forbidden" in text.lower():
            return RiskAssessment(
                has_risk=True,
                risk_level=RiskLevel.HIGH,
                risk_type="forbidden_content",
            )
        return RiskAssessment(has_risk=False, risk_level=RiskLevel.SAFE)
```
