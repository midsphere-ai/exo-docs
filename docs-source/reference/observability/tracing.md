# exo.observability.tracing

Distributed tracing with optional OpenTelemetry support. When `opentelemetry` is installed, spans are created via the OTel SDK. When it is not installed, all instrumentation becomes a lightweight no-op: `@traced` passes through, and `span()`/`aspan()` yield a `NullSpan`.

## traced

```python
from exo.observability import traced
```

Decorator that wraps a function in a tracing span. Supports sync functions, async functions, sync generators, and async generators. Function metadata (qualname, module, line number, parameters) is automatically recorded as span attributes.

```python
@traced(
    name: str | None = None,
    *,
    attributes: dict[str, Any] | None = None,
    extract_args: bool = False,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `str \| None` | `None` | Span name override. Defaults to `func.__qualname__` |
| `attributes` | `dict[str, Any] \| None` | `None` | Extra attributes merged onto the span |
| `extract_args` | `bool` | `False` | When `True`, record the function's call arguments as span attributes |

### Behavior

- **With OTel installed**: creates a real span via `opentelemetry.trace`, records metadata and exceptions
- **Without OTel**: the decorator is a lightweight passthrough that preserves `functools.wraps` metadata

### Auto-recorded Attributes

The following attributes are automatically extracted from the decorated function:

| Attribute | Description |
|---|---|
| `code.function` | Qualified function name |
| `code.module` | Module name |
| `code.lineno` | First line number |
| `code.filepath` | Relative file path |
| `code.parameters` | List of parameter names (excluding `self`) |

When `extract_args=True`, call arguments are also recorded as `arg.{param_name}` attributes.

### Examples

```python
from exo.observability import traced

# Basic usage -- span name defaults to function qualname
@traced()
async def process_query(query: str) -> str:
    return f"Result for {query}"

# Custom span name and extra attributes
@traced(name="search.execute", attributes={"component": "search"})
async def execute_search(query: str, limit: int = 10) -> list:
    return []

# Record function arguments
@traced(extract_args=True)
def compute(x: int, y: int) -> int:
    return x + y

# Works with sync generators
@traced()
def generate_items():
    yield 1
    yield 2

# Works with async generators
@traced()
async def stream_results():
    yield "chunk1"
    yield "chunk2"
```

## span

```python
from exo.observability import span
```

Synchronous span context manager. Yields a real OTel span when available, otherwise a `NullSpan`.

```python
@contextmanager
def span(
    name: str,
    attributes: dict[str, Any] | None = None,
) -> Iterator[SpanLike]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `str` | *required* | Name of the span |
| `attributes` | `dict[str, Any] \| None` | `None` | Attributes to set on the span |

```python
from exo.observability import span

with span("process_batch", {"batch_size": 100}) as s:
    # s is a real OTel span or NullSpan
    result = do_work()
    s.set_attribute("result_count", len(result))
```

## aspan

```python
from exo.observability import aspan
```

Asynchronous span context manager. Yields a real OTel span when available, otherwise a `NullSpan`.

```python
@asynccontextmanager
async def aspan(
    name: str,
    attributes: dict[str, Any] | None = None,
) -> AsyncIterator[SpanLike]
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `name` | `str` | *required* | Name of the span |
| `attributes` | `dict[str, Any] \| None` | `None` | Attributes to set on the span |

```python
from exo.observability import aspan

async with aspan("fetch_data", {"source": "api"}) as s:
    data = await fetch_from_api()
    s.set_attribute("bytes_received", len(data))
```

## SpanLike

```python
from exo.observability import SpanLike
```

Runtime-checkable protocol defining the minimal span interface used by Exo instrumentation.

```python
class SpanLike(Protocol):
    def set_attribute(self, key: str, value: Any) -> None: ...
    def record_exception(self, exception: BaseException) -> None: ...
    def set_status(self, status: Any, description: str | None = None) -> None: ...
```

## NullSpan

```python
from exo.observability import NullSpan
```

No-op span stub returned when OpenTelemetry is not installed. All methods are silent no-ops. Also usable as a context manager.

```python
class NullSpan:
    def set_attribute(self, key: str, value: Any) -> None: ...
    def record_exception(self, exception: BaseException) -> None: ...
    def set_status(self, status: Any, description: str | None = None) -> None: ...
    def __enter__(self) -> NullSpan: ...
    def __exit__(self, *args: Any) -> None: ...
```

## Utility Functions

### extract_metadata

```python
from exo.observability import extract_metadata
```

Extract tracing metadata from a callable. Returns a dict with `code.function`, `code.module`, `code.lineno`, `code.filepath`, and `code.parameters`.

```python
extract_metadata(func: Any) -> dict[str, Any]
```

### is_user_code

```python
from exo.observability import is_user_code
```

Return `True` if a filename belongs to user code (not stdlib or observability internals).

```python
is_user_code(filename: str) -> bool
```

### get_user_frame

```python
from exo.observability import get_user_frame
```

Walk the call stack to find the first user-code frame. Returns `None` if no user frame is found.

```python
get_user_frame() -> inspect.FrameInfo | None
```

## Full Example

```python
import asyncio
from exo.observability import (
    traced,
    span,
    aspan,
    get_logger,
    configure_logging,
    configure,
    ObservabilityConfig,
)

configure_logging(level="DEBUG")
configure(ObservabilityConfig(trace_enabled=True, service_name="my-service"))

log = get_logger("app")

@traced(name="pipeline.run", extract_args=True)
async def run_pipeline(input_data: str) -> str:
    async with aspan("pipeline.fetch") as s:
        data = await fetch(input_data)
        s.set_attribute("data_size", len(data))

    with span("pipeline.transform") as s:
        result = transform(data)
        s.set_attribute("result_size", len(result))

    return result

asyncio.run(run_pipeline("hello"))
```
