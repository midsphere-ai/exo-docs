# Vector Stores

Vector stores persist document chunks alongside their embedding vectors and support similarity search. All implementations conform to the `VectorStore` ABC.

```python
from exo.retrieval import VectorStore, InMemoryVectorStore
from exo.retrieval.backends.chroma import ChromaVectorStore
from exo.retrieval.backends.pgvector import PgVectorStore
```

---

## VectorStore

```python
class VectorStore(abc.ABC)
```

Abstract base class for vector stores. Subclasses must implement `add`, `search`, `delete`, and `clear`.

### Abstract methods

#### add

```python
async def add(
    self,
    chunks: list[Chunk],
    embeddings: list[list[float]],
) -> None
```

Add chunks with their embedding vectors.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `chunks` | `list[Chunk]` | *(required)* | The document chunks to store |
| `embeddings` | `list[list[float]]` | *(required)* | Corresponding embedding vectors (one per chunk) |

**Raises:** `ValueError` -- If the number of chunks and embeddings differ.

#### search

```python
async def search(
    self,
    query_embedding: list[float],
    top_k: int = 5,
    filter: dict[str, Any] | None = None,
) -> list[RetrievalResult]
```

Search for the most similar chunks to a query embedding.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query_embedding` | `list[float]` | *(required)* | The query vector to compare against |
| `top_k` | `int` | `5` | Maximum number of results to return |
| `filter` | `dict[str, Any] \| None` | `None` | Optional metadata filter (exact match on each key) |

**Returns:** A list of `RetrievalResult` objects ranked by similarity (highest score first).

#### delete

```python
async def delete(self, document_id: str) -> None
```

Delete all chunks belonging to a document.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `document_id` | `str` | *(required)* | The ID of the document whose chunks to remove |

#### clear

```python
async def clear(self) -> None
```

Remove all stored chunks and embeddings.

---

## InMemoryVectorStore

```python
class InMemoryVectorStore(VectorStore)
```

In-memory vector store using cosine similarity. Stores chunks and embeddings in plain Python dicts. Suitable for development, testing, and small datasets.

### Constructor

```python
InMemoryVectorStore()
```

Takes no parameters.

### Methods

Implements all `VectorStore` abstract methods. Search uses cosine similarity, metadata filters use exact key-value matching.

### Example

```python
from exo.retrieval import InMemoryVectorStore, Chunk

store = InMemoryVectorStore()

chunks = [
    Chunk(document_id="doc1", index=0, content="Hello world", start=0, end=11),
]
embeddings = [[0.1, 0.2, 0.3]]

await store.add(chunks, embeddings)

results = await store.search([0.1, 0.2, 0.3], top_k=3)
print(results[0].chunk.content)  # "Hello world"

await store.delete("doc1")
await store.clear()
```

---

## ChromaVectorStore

```python
class ChromaVectorStore(VectorStore)
```

ChromaDB vector store for local persistent or ephemeral vector search. Wraps the ChromaDB `Collection` API for similarity search using cosine distance.

Requires the `chromadb` package:

```bash
pip install exo-retrieval[chroma]
```

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `collection_name` | `str` | `"exo_vectors"` | Name of the ChromaDB collection |
| `path` | `str \| None` | `None` | Directory path for persistent storage. When `None`, an ephemeral (in-memory) client is used |
| `client` | `chromadb.ClientAPI \| None` | `None` | Optional pre-existing ChromaDB client instance |

`path` and `client` are keyword-only.

### Methods

Implements all `VectorStore` abstract methods. Search converts ChromaDB cosine distances to similarity scores via `1 - distance`. Metadata filters are serialized and matched via ChromaDB's `$contains` operator.

### Example

```python
from exo.retrieval.backends.chroma import ChromaVectorStore

# Ephemeral (in-memory)
store = ChromaVectorStore()

# Persistent storage
store = ChromaVectorStore(path="/tmp/chroma_data")

# Custom collection name
store = ChromaVectorStore("my_collection", path="/tmp/chroma_data")
```

---

## PgVectorStore

```python
class PgVectorStore(VectorStore)
```

PostgreSQL vector store using the pgvector extension. Uses `asyncpg` for async PostgreSQL access and the `<=>` cosine distance operator for similarity search.

Requires the `asyncpg` package:

```bash
pip install exo-retrieval[pgvector]
```

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `dsn` | `str` | `""` | PostgreSQL connection string (e.g. `postgresql://user:pass@host/db`) |
| `table` | `str` | `"exo_vectors"` | Name of the table to store vectors in |
| `dimensions` | `int` | `1536` | Dimensionality of embedding vectors |
| `pool` | `asyncpg.Pool \| None` | `None` | Optional pre-existing connection pool |

`table`, `dimensions`, and `pool` are keyword-only.

### Methods

#### initialize

```python
async def initialize(self) -> None
```

Create the pgvector extension and table if they don't exist. Call this once before using the store.

#### close

```python
async def close(self) -> None
```

Close the connection pool if the store owns it (i.e. no external pool was provided).

Also implements all `VectorStore` abstract methods (`add`, `search`, `delete`, `clear`). Search converts pgvector cosine distance to similarity via `1 - distance`. Metadata filters use JSONB `$>>` exact matching.

### Example

```python
from exo.retrieval.backends.pgvector import PgVectorStore

store = PgVectorStore(
    dsn="postgresql://user:pass@localhost/mydb",
    dimensions=1536,
)
await store.initialize()

# ... add chunks, search, etc.

await store.close()
```
