# exo-retrieval

Retrieval framework for Exo agents: embeddings, vector stores, chunkers, parsers, and a full RAG pipeline with agentic retrieval, knowledge graph expansion, hybrid search, query rewriting, and reranking.

## Installation

```bash
pip install exo-retrieval
```

Optional backends:

```bash
# ChromaDB vector store
pip install "exo-retrieval[chroma] @ git+..."

# PostgreSQL/pgvector vector store
pip install "exo-retrieval[pgvector] @ git+..."

# PDF parsing
pip install "exo-retrieval[pdf] @ git+..."
```

## Module path

```python
import exo.retrieval
```

## Package exports

| Export | Module | Description |
|---|---|---|
| `Document` | `exo.retrieval.types` | A document stored in a retrieval system |
| `Chunk` | `exo.retrieval.types` | An immutable slice of a document for retrieval |
| `RetrievalResult` | `exo.retrieval.types` | A scored chunk returned from a retrieval query |
| `RetrievalError` | `exo.retrieval.types` | Raised when a retrieval operation fails |
| `Embeddings` | `exo.retrieval.embeddings` | Abstract base class for embedding providers |
| `OpenAIEmbeddings` | `exo.retrieval.openai_embeddings` | OpenAI embeddings API provider |
| `VertexEmbeddings` | `exo.retrieval.vertex_embeddings` | Google Vertex AI embeddings provider |
| `HTTPEmbeddings` | `exo.retrieval.http_embeddings` | Generic HTTP endpoint embeddings provider |
| `VectorStore` | `exo.retrieval.vector_store` | Abstract base class for vector stores |
| `InMemoryVectorStore` | `exo.retrieval.vector_store` | In-memory vector store using cosine similarity |
| `ChromaVectorStore` | `exo.retrieval.backends.chroma` | ChromaDB vector store backend |
| `PgVectorStore` | `exo.retrieval.backends.pgvector` | PostgreSQL/pgvector vector store backend |
| `Chunker` | `exo.retrieval.chunker` | Abstract base class for text chunkers |
| `CharacterChunker` | `exo.retrieval.chunker` | Fixed character-count windows with overlap |
| `ParagraphChunker` | `exo.retrieval.chunker` | Splits at paragraph boundaries |
| `TokenChunker` | `exo.retrieval.chunker` | Splits by token count (uses tiktoken) |
| `Parser` | `exo.retrieval.parsers` | Abstract base class for document parsers |
| `TextParser` | `exo.retrieval.parsers` | Passthrough parser for plain text |
| `MarkdownParser` | `exo.retrieval.parsers` | Strips Markdown formatting, preserves structure |
| `JSONParser` | `exo.retrieval.parsers` | Flattens JSON to readable text with key paths |
| `PDFParser` | `exo.retrieval.parsers` | Extracts text from PDFs (requires pymupdf) |
| `Retriever` | `exo.retrieval.retriever` | Abstract base class for retrievers |
| `VectorRetriever` | `exo.retrieval.retriever` | Dense vector retriever using embeddings + vector store |
| `SparseRetriever` | `exo.retrieval.sparse_retriever` | BM25 keyword-based sparse retriever |
| `HybridRetriever` | `exo.retrieval.hybrid_retriever` | Fuses dense and sparse results via Reciprocal Rank Fusion |
| `AgenticRetriever` | `exo.retrieval.agentic_retriever` | Multi-round LLM-driven retriever with query refinement |
| `GraphRetriever` | `exo.retrieval.graph_retriever` | Expands results via knowledge graph traversal |
| `QueryRewriter` | `exo.retrieval.query_rewriter` | LLM-based query rewriting for improved retrieval |
| `Reranker` | `exo.retrieval.reranker` | Abstract base class for rerankers |
| `LLMReranker` | `exo.retrieval.reranker` | LLM-based passage relevance reranking |
| `Triple` | `exo.retrieval.triple_extractor` | Subject-predicate-object triple for knowledge graphs |
| `TripleExtractor` | `exo.retrieval.triple_extractor` | LLM-based knowledge graph triple extraction |
| `retrieve_tool` | `exo.retrieval.tools` | Factory that wraps a retriever as an agent tool |
| `index_tool` | `exo.retrieval.tools` | Factory that wraps an indexing pipeline as an agent tool |

## Submodules

- [Embeddings](embeddings.md) -- Embeddings ABC, OpenAIEmbeddings, VertexEmbeddings, HTTPEmbeddings
- [Vector Stores](vector-stores.md) -- VectorStore ABC, InMemoryVectorStore, ChromaVectorStore, PgVectorStore
- [Chunkers](chunkers.md) -- Chunker ABC, CharacterChunker, ParagraphChunker, TokenChunker
- [Retrievers](retrievers.md) -- Retriever ABC, VectorRetriever, SparseRetriever, HybridRetriever, AgenticRetriever, GraphRetriever, QueryRewriter, Reranker

## Quick example

```python
import asyncio
from exo.retrieval import (
    CharacterChunker,
    Document,
    InMemoryVectorStore,
    OpenAIEmbeddings,
    VectorRetriever,
    retrieve_tool,
)
from exo import Agent, run

# Set up the RAG pipeline
embeddings = OpenAIEmbeddings(api_key="sk-...")
store = InMemoryVectorStore()
retriever = VectorRetriever(embeddings, store)

# Index a document
doc = Document(id="readme", content="Exo is a modular multi-agent framework...")
chunker = CharacterChunker(chunk_size=500, chunk_overlap=50)
chunks = chunker.chunk(doc)

async def main():
    vecs = await embeddings.embed_batch([c.content for c in chunks])
    await store.add(chunks, vecs)

    # Give an agent the retrieve tool
    agent = Agent(
        name="assistant",
        model="openai:gpt-4o",
        tools=[retrieve_tool(retriever)],
    )
    result = await run(agent, "What is Exo?")
    print(result.output)

asyncio.run(main())
```
