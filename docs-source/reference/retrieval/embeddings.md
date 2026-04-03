# Embeddings

Embedding providers convert text into dense vector representations for similarity search. All providers implement the `Embeddings` ABC and use `httpx` for async HTTP calls -- no provider SDKs are required.

```python
from exo.retrieval import (
    Embeddings,
    OpenAIEmbeddings,
    VertexEmbeddings,
    HTTPEmbeddings,
)
```

---

## Embeddings

```python
class Embeddings(abc.ABC)
```

Abstract base class for text embedding providers. Subclasses must implement `embed()`, `embed_batch()`, and the `dimension` property.

### Abstract methods

#### embed

```python
async def embed(self, text: str) -> list[float]
```

Embed a single text string.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `text` | `str` | *(required)* | The text to embed |

**Returns:** A dense vector of length `dimension`.

#### embed_batch

```python
async def embed_batch(self, texts: list[str]) -> list[list[float]]
```

Embed multiple texts in a single call.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `texts` | `list[str]` | *(required)* | A list of texts to embed |

**Returns:** A list of dense vectors, one per input text.

### Abstract properties

#### dimension

```python
@property
def dimension(self) -> int
```

The dimensionality of the embedding vectors.

---

## OpenAIEmbeddings

```python
class OpenAIEmbeddings(Embeddings)
```

Embedding provider backed by the OpenAI embeddings API. Uses `httpx` directly -- the `openai` SDK is not required.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `api_key` | `str` | *(required)* | OpenAI API key |
| `model` | `str` | `"text-embedding-3-small"` | Embedding model name |
| `dimension` | `int` | `1536` | Vector dimensionality |
| `base_url` | `str` | `"https://api.openai.com/v1"` | API base URL |

All parameters are keyword-only.

### Methods

Implements `embed()`, `embed_batch()`, and the `dimension` property from `Embeddings`.

**Raises:** `RetrievalError` -- If the API call fails.

### Example

```python
from exo.retrieval import OpenAIEmbeddings

embeddings = OpenAIEmbeddings(api_key="sk-...")

# Single text
vec = await embeddings.embed("Hello, world!")
print(len(vec))  # 1536

# Batch
vecs = await embeddings.embed_batch(["Hello", "World"])
print(len(vecs))  # 2
```

---

## VertexEmbeddings

```python
class VertexEmbeddings(Embeddings)
```

Embedding provider backed by Google Vertex AI. Uses `httpx` directly -- the `google-cloud-aiplatform` SDK is not required.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `api_key` | `str` | *(required)* | API key or access token for authentication |
| `project` | `str` | *(required)* | Google Cloud project ID |
| `model` | `str` | `"text-embedding-005"` | Embedding model name |
| `dimension` | `int` | `768` | Vector dimensionality |
| `location` | `str` | `"us-central1"` | Google Cloud region |

All parameters are keyword-only.

### Methods

Implements `embed()`, `embed_batch()`, and the `dimension` property from `Embeddings`.

**Raises:** `RetrievalError` -- If the API call fails.

### Example

```python
from exo.retrieval import VertexEmbeddings

embeddings = VertexEmbeddings(
    api_key="ya29.a0...",
    project="my-gcp-project",
    dimension=768,
)

vec = await embeddings.embed("Hello from Vertex AI")
print(len(vec))  # 768
```

---

## HTTPEmbeddings

```python
class HTTPEmbeddings(Embeddings)
```

Embedding provider that calls any HTTP endpoint. Configurable field paths let you adapt to any API response format. Sends a POST request with the input texts and extracts vectors using dot-separated paths (e.g. `"data.0.embedding"`).

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `url` | `str` | *(required)* | The embedding endpoint URL |
| `dimension` | `int` | *(required)* | Vector dimensionality |
| `headers` | `dict[str, str] \| None` | `None` | Optional HTTP headers (e.g. for authentication) |
| `input_field` | `str` | `"input"` | Dot path in the request body for the input texts |
| `output_field` | `str` | `"data"` | Dot path in the response body to the list of embedding objects |
| `vector_field` | `str` | `"embedding"` | Dot path within each embedding object to the vector |
| `timeout` | `float` | `60.0` | Request timeout in seconds |

All parameters are keyword-only.

### Methods

Implements `embed()`, `embed_batch()`, and the `dimension` property from `Embeddings`.

**Raises:** `RetrievalError` -- If the HTTP call or response parsing fails.

### Example

```python
from exo.retrieval import HTTPEmbeddings

# OpenAI-compatible endpoint
embeddings = HTTPEmbeddings(
    url="http://localhost:11434/api/embeddings",
    dimension=384,
    headers={"Authorization": "Bearer my-key"},
    input_field="input",
    output_field="data",
    vector_field="embedding",
)

vec = await embeddings.embed("Hello from a custom endpoint")
print(len(vec))  # 384
```

For non-standard response shapes, adjust `output_field` and `vector_field`. Dot paths support integer keys for list indexing (e.g. `"results.0.values"`).
