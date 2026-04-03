# Retrievers

Retrievers accept a text query and return ranked `RetrievalResult` objects. Exo provides a base `Retriever` ABC, multiple retriever implementations (dense, sparse, hybrid, agentic, graph), plus `QueryRewriter` and `Reranker` for pipeline composition.

```python
from exo.retrieval import (
    Retriever,
    VectorRetriever,
    SparseRetriever,
    HybridRetriever,
    AgenticRetriever,
    GraphRetriever,
    QueryRewriter,
    Reranker,
    LLMReranker,
    Triple,
    TripleExtractor,
    retrieve_tool,
    index_tool,
)
```

---

## Retriever

```python
class Retriever(abc.ABC)
```

Abstract base class for retrievers. Subclasses must implement `retrieve`.

### Abstract methods

#### retrieve

```python
async def retrieve(
    self,
    query: str,
    *,
    top_k: int = 5,
    **kwargs: Any,
) -> list[RetrievalResult]
```

Retrieve relevant chunks for a query.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | *(required)* | The search query text |
| `top_k` | `int` | `5` | Maximum number of results to return |
| `**kwargs` | `Any` | | Additional retriever-specific parameters |

**Returns:** A list of `RetrievalResult` objects ranked by relevance (highest score first).

---

## VectorRetriever

```python
class VectorRetriever(Retriever)
```

Dense vector retriever using embeddings and a vector store. Embeds the query text, searches the vector store for similar chunks, and optionally filters results below a score threshold.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `embeddings` | `Embeddings` | *(required)* | The embedding provider for vectorizing queries |
| `store` | `VectorStore` | *(required)* | The vector store to search against |
| `score_threshold` | `float \| None` | `None` | Optional minimum score; results below this are excluded |

`score_threshold` is keyword-only.

### Methods

#### retrieve

```python
async def retrieve(
    self,
    query: str,
    *,
    top_k: int = 5,
    **kwargs: Any,
) -> list[RetrievalResult]
```

Embed the query and search the vector store. Extra `**kwargs` (e.g. `filter`) are passed through to `VectorStore.search`.

### Example

```python
from exo.retrieval import OpenAIEmbeddings, InMemoryVectorStore, VectorRetriever

embeddings = OpenAIEmbeddings(api_key="sk-...")
store = InMemoryVectorStore()
retriever = VectorRetriever(embeddings, store, score_threshold=0.5)

results = await retriever.retrieve("What is Exo?", top_k=3)
for r in results:
    print(f"[{r.score:.3f}] {r.chunk.content[:80]}...")
```

---

## SparseRetriever

```python
class SparseRetriever(Retriever)
```

BM25 sparse retriever for keyword-based search. Builds an inverted index over `Chunk` objects and scores them using the [Okapi BM25](https://en.wikipedia.org/wiki/Okapi_BM25) ranking function. Pure Python with no external dependencies.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `k1` | `float` | `1.5` | Term-frequency saturation parameter |
| `b` | `float` | `0.75` | Length normalization parameter |

Both parameters are keyword-only.

### Methods

#### index

```python
def index(self, chunks: list[Chunk]) -> None
```

Build the inverted index over a list of chunks. Replaces any previously indexed data.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `chunks` | `list[Chunk]` | *(required)* | The chunks to index |

#### retrieve

```python
async def retrieve(
    self,
    query: str,
    *,
    top_k: int = 5,
    **kwargs: Any,
) -> list[RetrievalResult]
```

Retrieve chunks ranked by BM25 score. Only chunks with a positive score are returned.

### Example

```python
from exo.retrieval import SparseRetriever, CharacterChunker, Document

doc = Document(id="doc1", content="Python is a programming language...")
chunks = CharacterChunker(chunk_size=200).chunk(doc)

sparse = SparseRetriever(k1=1.5, b=0.75)
sparse.index(chunks)

results = await sparse.retrieve("programming language", top_k=3)
```

---

## HybridRetriever

```python
class HybridRetriever(Retriever)
```

Hybrid retriever that fuses dense and sparse results via weighted [Reciprocal Rank Fusion (RRF)](https://plg.uwaterloo.ca/~gvcormac/cormacksigir09-rrf.pdf). Calls both retrievers concurrently, then merges their ranked lists.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `vector_retriever` | `Retriever` | *(required)* | Dense (embedding-based) retriever |
| `sparse_retriever` | `Retriever` | *(required)* | Sparse (keyword-based) retriever |
| `k` | `int` | `60` | RRF constant -- higher values flatten the rank curve |
| `vector_weight` | `float` | `0.5` | Weight for the vector retriever's contribution (0.0--1.0). The sparse retriever receives `1 - vector_weight` |

`k` and `vector_weight` are keyword-only.

### Methods

#### retrieve

```python
async def retrieve(
    self,
    query: str,
    *,
    top_k: int = 5,
    **kwargs: Any,
) -> list[RetrievalResult]
```

Retrieve by fusing dense and sparse results with RRF. Both retrievers are called concurrently via `asyncio.gather`. Results are deduplicated by `(document_id, index)` and scored by weighted RRF.

### Example

```python
from exo.retrieval import (
    VectorRetriever,
    SparseRetriever,
    HybridRetriever,
    OpenAIEmbeddings,
    InMemoryVectorStore,
)

embeddings = OpenAIEmbeddings(api_key="sk-...")
store = InMemoryVectorStore()
vector = VectorRetriever(embeddings, store)

sparse = SparseRetriever()
sparse.index(chunks)  # pre-indexed chunks

hybrid = HybridRetriever(
    vector_retriever=vector,
    sparse_retriever=sparse,
    vector_weight=0.7,  # 70% dense, 30% sparse
)

results = await hybrid.retrieve("What is Exo?", top_k=5)
```

---

## AgenticRetriever

```python
class AgenticRetriever(Retriever)
```

Multi-round LLM-driven retriever that iteratively refines queries until the results are deemed sufficient. Wraps a base retriever and uses a `QueryRewriter` to reformulate queries between rounds. An LLM judge scores result sufficiency after each round.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_retriever` | `Retriever` | *(required)* | The underlying retriever to delegate to |
| `rewriter` | `QueryRewriter` | *(required)* | A `QueryRewriter` for query refinement between rounds |
| `model` | `str` | *(required)* | Model string for the sufficiency judge (e.g. `"openai:gpt-4o"`) |
| `max_rounds` | `int` | `3` | Maximum retrieval rounds |
| `sufficiency_threshold` | `float` | `0.7` | Minimum sufficiency score to accept results (0.0--1.0) |
| `**provider_kwargs` | `Any` | | Extra keyword arguments forwarded to `get_provider()` |

`max_rounds` and `sufficiency_threshold` are keyword-only.

### Methods

#### retrieve

```python
async def retrieve(
    self,
    query: str,
    *,
    top_k: int = 5,
    **kwargs: Any,
) -> list[RetrievalResult]
```

Retrieve with iterative refinement. Each round: rewrite the query, retrieve, judge sufficiency. Stops when the sufficiency threshold is met or max rounds are exhausted. Returns deduplicated results from all rounds, sorted by score descending.

### Example

```python
from exo.retrieval import (
    AgenticRetriever,
    QueryRewriter,
    VectorRetriever,
    OpenAIEmbeddings,
    InMemoryVectorStore,
)

embeddings = OpenAIEmbeddings(api_key="sk-...")
store = InMemoryVectorStore()
base = VectorRetriever(embeddings, store)
rewriter = QueryRewriter("openai:gpt-4o")

agentic = AgenticRetriever(
    base_retriever=base,
    rewriter=rewriter,
    model="openai:gpt-4o",
    max_rounds=3,
    sufficiency_threshold=0.7,
)

# May perform up to 3 rounds of retrieve-judge-rewrite
results = await agentic.retrieve("Explain how Exo agents handle tool calls")
```

---

## GraphRetriever

```python
class GraphRetriever(Retriever)
```

Retriever that expands results via knowledge graph traversal. After an initial retrieval from the base retriever, entities in the returned chunks are matched against pre-extracted `Triple` objects. A configurable beam search controls the breadth and depth of expansion. Expansion results receive a decayed score (0.8 per hop).

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `base_retriever` | `Retriever` | *(required)* | The underlying retriever for the initial query |
| `triples` | `list[Triple]` | *(required)* | Pre-extracted knowledge graph triples to traverse |
| `beam_width` | `int` | `3` | Maximum number of triples to expand per entity per hop |
| `max_hops` | `int` | `2` | Maximum traversal depth |

`beam_width` and `max_hops` are keyword-only.

### Methods

#### retrieve

```python
async def retrieve(
    self,
    query: str,
    *,
    top_k: int = 5,
    **kwargs: Any,
) -> list[RetrievalResult]
```

Retrieve chunks, then expand via graph traversal. Graph-expanded results include `graph_hop`, `graph_triple`, and `graph_source_entity` in their metadata.

### Example

```python
from exo.retrieval import GraphRetriever, TripleExtractor, VectorRetriever

# Extract triples from your chunks first
extractor = TripleExtractor("openai:gpt-4o")
triples = await extractor.extract(chunks)

# Wrap a base retriever with graph expansion
graph = GraphRetriever(
    base_retriever=vector_retriever,
    triples=triples,
    beam_width=3,
    max_hops=2,
)

results = await graph.retrieve("Who created Python?")
for r in results:
    if "graph_hop" in r.metadata:
        print(f"  (expanded at hop {r.metadata['graph_hop']})")
```

---

## Triple

```python
@dataclass(frozen=True)
class Triple
```

An immutable subject-predicate-object triple for knowledge graphs.

| Field | Type | Description |
|---|---|---|
| `subject` | `str` | The subject entity |
| `predicate` | `str` | The relationship or predicate |
| `object` | `str` | The object entity |
| `confidence` | `float` | Confidence score between 0 and 1 |
| `source_chunk_id` | `str` | Identifier linking back to the originating chunk (formatted as `document_id:index`) |

---

## TripleExtractor

```python
class TripleExtractor(
    model: str,
    *,
    prompt_template: str | None = None,
    **provider_kwargs: Any,
)
```

Extracts knowledge graph triples from text chunks via an LLM. Each chunk is sent individually; triples are tagged with the source chunk identifier.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | *(required)* | Model string, e.g. `"openai:gpt-4o"` |
| `prompt_template` | `str \| None` | `None` | Template with `{text}` placeholder. Defaults to a built-in extraction prompt |
| `**provider_kwargs` | `Any` | | Extra keyword arguments forwarded to `get_provider()` |

### Methods

#### extract

```python
async def extract(self, chunks: list[Chunk]) -> list[Triple]
```

Extract triples from a list of chunks.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `chunks` | `list[Chunk]` | *(required)* | Chunks to extract triples from |

**Returns:** A flat list of `Triple` objects extracted from all chunks.

---

## QueryRewriter

```python
class QueryRewriter(
    model: str,
    *,
    prompt_template: str | None = None,
    **provider_kwargs: Any,
)
```

Rewrites queries via an LLM to improve retrieval quality. Expands queries with synonyms, disambiguates terms, and optionally incorporates conversation history for context resolution.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | *(required)* | Model string, e.g. `"openai:gpt-4o"` |
| `prompt_template` | `str \| None` | `None` | Template with `{query}` placeholder (and optional `{history}` placeholder). Defaults to a built-in query expansion prompt |
| `**provider_kwargs` | `Any` | | Extra keyword arguments forwarded to `get_provider()` |

### Methods

#### rewrite

```python
async def rewrite(
    self,
    query: str,
    *,
    history: list[str] | None = None,
) -> str
```

Rewrite a query for better retrieval.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | *(required)* | The original user query |
| `history` | `list[str] \| None` | `None` | Optional conversation history for context resolution |

**Returns:** The rewritten query string. Falls back to the original query if the LLM returns an empty response.

### Example

```python
from exo.retrieval import QueryRewriter

rewriter = QueryRewriter("openai:gpt-4o")

# Simple rewrite
better_query = await rewriter.rewrite("How do agents work?")

# With conversation history
better_query = await rewriter.rewrite(
    "How does it handle errors?",
    history=["User asked about Exo agents", "Discussed tool calls"],
)
```

---

## Reranker

```python
class Reranker(abc.ABC)
```

Abstract base class for rerankers. Subclasses must implement `rerank` to reorder retrieval results by relevance.

### Abstract methods

#### rerank

```python
async def rerank(
    self,
    query: str,
    results: list[RetrievalResult],
    *,
    top_k: int = 5,
) -> list[RetrievalResult]
```

Rerank retrieval results by relevance to the query.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `query` | `str` | *(required)* | The original search query |
| `results` | `list[RetrievalResult]` | *(required)* | Retrieval results to rerank |
| `top_k` | `int` | `5` | Maximum number of results to return |

**Returns:** A reordered list of `RetrievalResult` objects, most relevant first.

---

## LLMReranker

```python
class LLMReranker(Reranker)
```

Reranker that uses an LLM to judge passage relevance. Sends the query and passage texts to an LLM, asks for a relevance ranking, and reorders results accordingly. Reranked results have updated scores (1.0 for rank 0, decreasing linearly) and an `original_score` key in their metadata.

### Constructor parameters

| Parameter | Type | Default | Description |
|---|---|---|---|
| `model` | `str` | *(required)* | Model string, e.g. `"openai:gpt-4o"` |
| `prompt_template` | `str \| None` | `None` | Template with `{query}` and `{passages}` placeholders. Defaults to a built-in relevance judging prompt |
| `**provider_kwargs` | `Any` | | Extra keyword arguments forwarded to `get_provider()` |

### Example

```python
from exo.retrieval import LLMReranker

reranker = LLMReranker("openai:gpt-4o")

# Rerank initial retrieval results
reranked = await reranker.rerank(
    "What is Exo?",
    initial_results,
    top_k=3,
)
for r in reranked:
    print(f"[{r.score:.3f}] {r.chunk.content[:80]}...")
    print(f"  (original score: {r.metadata['original_score']:.3f})")
```

---

## Agent Tools

Factory functions that wrap retrievers and indexing pipelines as `FunctionTool` instances, ready to be added to an Agent's `tools` list.

### retrieve_tool

```python
def retrieve_tool(
    retriever: Retriever,
    *,
    name: str = "retrieve",
) -> FunctionTool
```

Create a tool that searches a knowledge base via a retriever.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `retriever` | `Retriever` | *(required)* | The retriever instance to wrap |
| `name` | `str` | `"retrieve"` | Override the tool name |

**Returns:** A `FunctionTool` that agents can invoke with `query` and `top_k` parameters.

### index_tool

```python
def index_tool(
    chunker: Chunker,
    store: VectorStore,
    embeddings: Embeddings,
    *,
    name: str = "index_document",
) -> FunctionTool
```

Create a tool that indexes new documents into a vector store.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `chunker` | `Chunker` | *(required)* | The chunker for splitting documents |
| `store` | `VectorStore` | *(required)* | The vector store to add chunks to |
| `embeddings` | `Embeddings` | *(required)* | The embeddings provider for vectorizing chunks |
| `name` | `str` | `"index_document"` | Override the tool name |

**Returns:** A `FunctionTool` that agents can invoke with `content` and `document_id` parameters.

### Example

```python
from exo import Agent, run
from exo.retrieval import (
    CharacterChunker,
    OpenAIEmbeddings,
    InMemoryVectorStore,
    VectorRetriever,
    retrieve_tool,
    index_tool,
)

embeddings = OpenAIEmbeddings(api_key="sk-...")
store = InMemoryVectorStore()
chunker = CharacterChunker()
retriever = VectorRetriever(embeddings, store)

agent = Agent(
    name="rag_agent",
    model="openai:gpt-4o",
    tools=[
        retrieve_tool(retriever),
        index_tool(chunker, store, embeddings),
    ],
)

result = await run(agent, "Index this document: 'Exo is a multi-agent framework.'")
result = await run(agent, "What is Exo?")
```

---

## Parsers

Document parsers extract text from common file formats, producing `Document` objects ready for chunking.

```python
from exo.retrieval import Parser, TextParser, MarkdownParser, JSONParser, PDFParser
```

### Parser

```python
class Parser(abc.ABC)
```

Abstract base class. Subclasses must implement `parse(source) -> Document` where `source` is `str | bytes | Path`.

### TextParser

Passthrough parser for plain text. Returns the input unchanged in a `Document`.

### MarkdownParser

Strips Markdown formatting (headings, links, bold, italic, code, blockquotes, lists, HTML tags) while preserving text structure. Fenced code block markers are removed but code content is kept.

### JSONParser

Flattens JSON into readable text with dot-separated key paths and bracket notation for arrays. For example, `{"user": {"name": "Alice"}}` becomes `user.name: Alice`.

### PDFParser

Extracts text from PDF files page by page. Requires the optional `pymupdf` package, included via the `pdf` extra:

```bash
# From the exo-ai monorepo root or packages/exo-retrieval directory
uv sync --extra pdf
```

### Example

```python
from pathlib import Path
from exo.retrieval import MarkdownParser, CharacterChunker

parser = MarkdownParser()
doc = parser.parse(Path("README.md"))

chunker = CharacterChunker(chunk_size=500)
chunks = chunker.chunk(doc)
```
