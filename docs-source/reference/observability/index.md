# exo.observability

Unified observability for Exo agents: structured logging, distributed tracing, metrics collection, cost tracking, health checks, alerting, SLO monitoring, and context propagation.

## Installation

```bash
pip install exo-observability
```

Optional dependencies for OpenTelemetry integration:

```bash
pip install "exo-observability[otel]"   # OTel API + SDK
pip install "exo-observability[otlp]"   # OTLP exporter
```

## Module Path

```python
import exo.observability
```

## Public Exports

### Eager Imports (10)

These are loaded immediately on import:

| Export | Source Module | Description |
|---|---|---|
| `ObservabilityConfig` | `config` | Immutable Pydantic configuration for the observability layer |
| `TraceBackend` | `config` | Enum of trace export backends (otlp, memory, console) |
| `configure` | `config` | Initialize the observability subsystem (idempotent) |
| `get_config` | `config` | Return the current config or a default |
| `get_logger` | `logging` | Return a stdlib Logger under the `exo.` namespace |
| `configure_logging` | `logging` | One-time handler setup on the `exo` root logger |
| `LogContext` | `logging` | Context manager for binding structured key-value pairs to logs |
| `traced` | `tracing` | Decorator that wraps a function in a span |
| `span` | `tracing` | Synchronous span context manager |
| `aspan` | `tracing` | Asynchronous span context manager |

### Lazy Imports (70+)

All other symbols are loaded on first access. Sub-module imports always work:

| Category | Key Exports | Source Module |
|---|---|---|
| Logging extras | `TextFormatter`, `JsonFormatter`, `reset_logging` | `logging` |
| Tracing extras | `SpanLike`, `NullSpan`, `is_user_code`, `get_user_frame`, `extract_metadata` | `tracing` |
| Metrics | `MetricsCollector`, `get_collector`, `record_agent_run`, `record_tool_step`, `Timer`, `timer` | `metrics` |
| Cost tracking | `ModelPricing`, `CostEntry`, `CostTracker`, `get_tracker` | `cost` |
| Health checks | `HealthStatus`, `HealthResult`, `HealthCheck`, `HealthRegistry`, `MemoryUsageCheck`, `EventLoopCheck` | `health` |
| Alerts | `AlertSeverity`, `Comparator`, `AlertRule`, `Alert`, `AlertManager`, `get_manager` | `alerts` |
| SLO tracking | `SLO`, `SLOReport`, `SLOTracker` | `slo` |
| Propagation | `BaggagePropagator`, `DictCarrier`, `SpanConsumer`, `register_span_consumer` | `propagation` |
| Prompt logger | `PromptLogger`, `TokenBreakdown`, `ExecutionLogEntry`, `estimate_tokens` | `prompt_logger` |
| Semantic conventions | `GEN_AI_SYSTEM`, `AGENT_NAME`, `TOOL_NAME`, `COST_TOTAL_USD`, ... (60+ constants) | `semconv` |

## Import Patterns

```python
# Core logging + tracing
from exo.observability import get_logger, configure_logging, LogContext
from exo.observability import traced, span, aspan

# Configuration
from exo.observability import configure, ObservabilityConfig, TraceBackend

# Metrics
from exo.observability import (
    MetricsCollector,
    get_collector,
    record_agent_run,
    record_tool_step,
    Timer,
    timer,
)

# Cost tracking
from exo.observability import CostTracker, get_tracker, ModelPricing, CostEntry

# Health checks
from exo.observability import (
    HealthRegistry,
    HealthCheck,
    HealthStatus,
    MemoryUsageCheck,
    EventLoopCheck,
    get_health_summary,
)

# Alerts
from exo.observability import AlertManager, AlertRule, AlertSeverity, Comparator

# SLO
from exo.observability import SLO, SLOReport, SLOTracker

# Propagation
from exo.observability import BaggagePropagator, DictCarrier, SpanConsumer

# Prompt logger
from exo.observability import PromptLogger, TokenBreakdown, ExecutionLogEntry

# Semantic conventions
from exo.observability import AGENT_NAME, TOOL_NAME, GEN_AI_USAGE_TOTAL_TOKENS
```

## Architecture

```
exo.observability
  __init__.py          Eager + lazy imports, __all__, __getattr__
  config.py            ObservabilityConfig, TraceBackend, configure(), get_config()
  logging.py           get_logger, configure_logging, LogContext, TextFormatter, JsonFormatter
  tracing.py           @traced, span(), aspan(), SpanLike, NullSpan
  metrics.py           MetricsCollector, counters/histograms/gauges, record helpers, Timer
  cost.py              CostTracker, ModelPricing, CostEntry, built-in pricing table
  health.py            HealthRegistry, HealthCheck protocol, MemoryUsageCheck, EventLoopCheck
  alerts.py            AlertManager, AlertRule, AlertSeverity, Comparator, cooldown logic
  slo.py               SLO, SLOReport, SLOTracker, sliding window compliance
  propagation.py       W3C Baggage propagation, SpanConsumer plugin system
  prompt_logger.py     PromptLogger, TokenBreakdown, ExecutionLogEntry
  semconv.py           60+ semantic convention constants (GenAI, agent, tool, cost, distributed)
```

## OTel Integration

The package has a dual-mode design:

- **Without OpenTelemetry**: tracing and metrics use lightweight in-memory fallbacks (`NullSpan`, `MetricsCollector`). All APIs remain functional.
- **With OpenTelemetry**: spans are created via the OTel SDK, metrics are recorded via OTel instruments. Install the `[otel]` extra to enable.

## Quick Example

```python
from exo.observability import (
    get_logger,
    configure_logging,
    LogContext,
    traced,
    configure,
    ObservabilityConfig,
)

# Set up logging
configure_logging(level="DEBUG", fmt="text")
log = get_logger("my_agent")

# Configure the full observability layer
configure(ObservabilityConfig(
    log_level="DEBUG",
    trace_enabled=True,
    service_name="my-service",
))

# Use structured logging context
with LogContext(agent_name="alpha", task_id="t-1"):
    log.info("starting task")  # Includes agent_name=alpha task_id=t-1

# Trace a function
@traced(name="process_query", extract_args=True)
async def process_query(query: str) -> str:
    log.info("processing: %s", query)
    return f"Result for {query}"
```

## Submodule Reference

| Page | Description |
|---|---|
| [logging](logging.md) | Structured logging: get_logger, configure_logging, LogContext, formatters |
| [tracing](tracing.md) | Distributed tracing: @traced decorator, span/aspan context managers |
