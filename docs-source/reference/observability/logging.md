# exo.observability.logging

Structured logging for Exo using the Python stdlib `logging` module. Provides ANSI text and JSON formatters, logger namespace management under the `exo.` prefix, and a `LogContext` context manager for binding structured key-value pairs to all log records within a scope.

## get_logger

```python
from exo.observability import get_logger
```

Return a stdlib `Logger` under the `exo.` namespace.

```python
get_logger(name: str) -> logging.Logger
```

| Parameter | Type | Description |
|---|---|---|
| `name` | `str` | Logger name. Auto-prefixed with `exo.` if not already present. |

If `name` does not start with `exo.`, it is automatically prefixed. This ensures all Exo loggers live under a single root for unified configuration.

```python
log = get_logger("agent")       # Returns logger named "exo.agent"
log = get_logger("exo.agent")   # Returns logger named "exo.agent" (no double prefix)
log = get_logger("exo")         # Returns the root "exo" logger
```

## configure_logging

```python
from exo.observability import configure_logging
```

One-time handler setup on the `exo` root logger. Idempotent by default.

```python
configure_logging(
    level: str | int = "WARNING",
    fmt: str = "text",
    *,
    force: bool = False,
) -> None
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `level` | `str \| int` | `"WARNING"` | Log level name or int (e.g. `"DEBUG"`, `logging.INFO`) |
| `fmt` | `str` | `"text"` | `"text"` for compact ANSI output, `"json"` for structured JSON |
| `force` | `bool` | `False` | If `True`, remove existing handlers and reconfigure |

Calling twice is a no-op unless `force=True` is passed.

```python
# Basic setup
configure_logging(level="DEBUG")

# JSON output for production
configure_logging(level="INFO", fmt="json")

# Force reconfigure
configure_logging(level="WARNING", force=True)
```

### Environment Variable Configuration

Logging is also auto-configured at import time from environment variables:

| Variable | Effect |
|---|---|
| `EXO_DEBUG=1` | Forces log level to `DEBUG` regardless of `EXO_LOG_LEVEL` |
| `EXO_LOG_LEVEL` | Sets log level (`DEBUG`, `INFO`, `WARNING`, `ERROR`). Falls back to `WARNING` for unrecognised values. |

When either variable is present, a `StreamHandler` with a standard format is attached to the `exo` root logger automatically.

## LogContext

```python
from exo.observability import LogContext
```

Context manager that binds key-value pairs to all log records within its scope. Uses `contextvars` so it works correctly with asyncio concurrency. Contexts nest and merge.

```python
class LogContext(**kwargs: Any)
```

| Parameter | Type | Description |
|---|---|---|
| `**kwargs` | `Any` | Arbitrary key-value pairs to bind to log records |

### Usage

```python
from exo.observability import get_logger, LogContext, configure_logging

configure_logging(level="DEBUG")
log = get_logger("agent")

with LogContext(agent_name="alpha", task_id="t-1"):
    log.info("step completed")
    # Output includes: agent_name=alpha task_id=t-1

    # Contexts nest and merge
    with LogContext(step=3):
        log.info("inner step")
        # Output includes: agent_name=alpha task_id=t-1 step=3

# Outside context, bindings are removed
log.info("no context")  # No extra fields
```

### How It Works

`LogContext` stores bindings in a `ContextVar`, making it async-safe. When entering the context, current bindings are copied and merged with new ones. On exit, the previous state is restored via the `ContextVar` reset token.

## TextFormatter

```python
from exo.observability import TextFormatter
```

Compact single-line ANSI formatter for development. Produces output in the format:

```
HH:MM:SS L name context_fields > message
```

Where `L` is a single-character level indicator (D/I/W/E/C), colors are applied per level, and the `exo.` prefix is stripped from logger names for brevity.

| Level | Color | Character |
|---|---|---|
| DEBUG | dim | D |
| INFO | cyan | I |
| WARNING | yellow | W |
| ERROR | red | E |
| CRITICAL | bold red | C |

## JsonFormatter

```python
from exo.observability import JsonFormatter
```

Structured JSON formatter for production logging. Each log record is serialized as a single JSON line with the following fields:

| Field | Type | Description |
|---|---|---|
| `timestamp` | `str` | ISO 8601 timestamp with timezone |
| `level` | `str` | Log level name |
| `logger` | `str` | Logger name |
| `message` | `str` | Formatted message |
| `extra` | `dict` | Context bindings from `LogContext` (present only when bindings exist) |
| `exception` | `str` | Formatted exception (present only on error) |

```json
{"timestamp": "2026-04-03T10:30:00+00:00", "level": "INFO", "logger": "exo.agent", "message": "step completed", "extra": {"agent_name": "alpha"}}
```

## reset_logging

```python
from exo.observability import reset_logging
```

Reset logging state. Clears all handlers from the `exo` root logger and resets the configured flag. Intended for testing only.

```python
reset_logging() -> None
```

## Full Example

```python
import asyncio
from exo.observability import get_logger, configure_logging, LogContext

configure_logging(level="DEBUG", fmt="text")
log = get_logger("my_app")

async def process_task(task_id: str):
    with LogContext(task_id=task_id):
        log.info("starting task")
        await asyncio.sleep(0.1)
        log.info("task complete")

async def main():
    with LogContext(service="my-agent"):
        await asyncio.gather(
            process_task("t-1"),
            process_task("t-2"),
        )

asyncio.run(main())
```
