# Chunkers

Chunkers split documents into retrieval-friendly chunks, each preserving character offsets into the original document content. All chunkers implement the `Chunker` ABC.

```python
from exo.retrieval import (
    Chunker,
    CharacterChunker,
    ParagraphChunker,
    TokenChunker,
)
```

---

## Types

Before covering the chunkers, here are the data types they operate on. Both are defined in `exo.retrieval.types`.

### Document

```python
class Document(BaseModel)
```

A document stored in a retrieval system.

| Field | Type | Default | Description |
|---|---|---|---|
| `id` | `str` | *(required)* | Unique identifier for the document |
| `content` | `str` | *(required)* | Full text content of the document |
| `metadata` | `dict[str, Any]` | `{}` | Arbitrary metadata (e.g. source, author, tags) |
| `embedding` | `list[float] \| None` | `None` | Optional pre-computed embedding vector |

### Chunk

```python
class Chunk(BaseModel, frozen=True)
```

An immutable slice of a document for retrieval.

| Field | Type | Default | Description |
|---|---|---|---|
| `document_id` | `str` | *(required)* | ID of the parent document |
| `index` | `int` | *(required)* | Position of this chunk within the document (0-based) |
| `content` | `str` | *(required)* | Text content of the chunk |
| `start` | `int` | *(required)* | Character offset where the chunk begins in the document |
| `end` | `int` | *(required)* | Character offset where the chunk ends in the document |
| `metadata` | `dict[str, Any]` | `{}` | Arbitrary metadata inherited or derived from the document |

### RetrievalResult

```python
class RetrievalResult(BaseModel, frozen=True)
```

A scored chunk returned from a retrieval query.

| Field | Type | Default | Description |
|---|---|---|---|
| `chunk` | `Chunk` | *(required)* | The matched chunk |
| `score` | `float` | *(required)* | Similarity or relevance score (higher is better) |
| `metadata` | `dict[str, Any]` | `{}` | Additional metadata from the retrieval process |

### RetrievalError

```python
class RetrievalError(ExoError)
```

Raised when a retrieval operation fails.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `message` | `str` | *(required)* | Error message |
| `operation` | `str` | `""` | The operation that failed (e.g. `"embed"`, `"search"`, `"index"`) |
| `details` | `dict[str, Any] \| None` | `None` | Additional context about the failure |

---

## Chunker

```python
class Chunker(abc.ABC)
```

Abstract base class for text chunkers. Subclasses must implement `chunk`.

### Abstract methods

#### chunk

```python
def chunk(self, document: Document) -> list[Chunk]
```

Split a document into chunks.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `document` | `Document` | *(required)* | The document to split |

**Returns:** A list of `Chunk` objects with character offsets preserved.

---

## CharacterChunker

```python
class CharacterChunker(Chunker)
```

Splits text by character count with configurable overlap. Produces fixed-size windows that slide across the document content.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `chunk_size` | `int` | `500` | Maximum number of characters per chunk |
| `chunk_overlap` | `int` | `50` | Number of overlapping characters between consecutive chunks |

**Raises:** `ValueError` -- If `chunk_size` is not positive, `chunk_overlap` is negative, or `chunk_overlap >= chunk_size`.

### Example

```python
from exo.retrieval import CharacterChunker, Document

chunker = CharacterChunker(chunk_size=200, chunk_overlap=20)
doc = Document(id="doc1", content="A long document..." * 100)
chunks = chunker.chunk(doc)

for c in chunks:
    print(f"Chunk {c.index}: chars {c.start}-{c.end} ({len(c.content)} chars)")
```

---

## ParagraphChunker

```python
class ParagraphChunker(Chunker)
```

Splits text at paragraph boundaries, respecting a maximum chunk size. Paragraphs are delimited by one or more blank lines. Multiple paragraphs are merged into a single chunk until adding another would exceed `chunk_size`. If a single paragraph exceeds the limit, it becomes its own chunk.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `chunk_size` | `int` | `1000` | Maximum number of characters per chunk |

**Raises:** `ValueError` -- If `chunk_size` is not positive.

### Example

```python
from exo.retrieval import ParagraphChunker, Document

chunker = ParagraphChunker(chunk_size=500)
doc = Document(id="article", content="First paragraph.\n\nSecond paragraph.\n\nThird paragraph.")
chunks = chunker.chunk(doc)

for c in chunks:
    print(f"Chunk {c.index}: {c.content[:50]}...")
```

---

## TokenChunker

```python
class TokenChunker(Chunker)
```

Splits text by token count using `tiktoken`. Falls back to a simple whitespace tokenizer if `tiktoken` is not installed. This chunker is useful when you need precise control over token budgets (e.g. matching an LLM's context window).

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `chunk_size` | `int` | `200` | Maximum number of tokens per chunk |
| `chunk_overlap` | `int` | `20` | Number of overlapping tokens between consecutive chunks |
| `encoding` | `str` | `"cl100k_base"` | The tiktoken encoding name |

**Raises:** `ValueError` -- If `chunk_size` is not positive, `chunk_overlap` is negative, or `chunk_overlap >= chunk_size`.

### Example

```python
from exo.retrieval import TokenChunker, Document

chunker = TokenChunker(chunk_size=100, chunk_overlap=10)
doc = Document(id="paper", content="A research paper with many words...")
chunks = chunker.chunk(doc)

for c in chunks:
    print(f"Chunk {c.index}: {len(c.content)} chars, offset {c.start}-{c.end}")
```

Install `tiktoken` for accurate token counting:

```bash
uv pip install tiktoken
```

Without `tiktoken`, the chunker falls back to whitespace splitting (each whitespace-separated word counts as one token).
