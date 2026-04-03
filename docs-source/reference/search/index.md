# exo.search

AI-powered search engine with deep research, citation verification, contradiction detection, confidence scoring, and multi-turn conversation support. Supports four quality modes (speed, balanced, quality, deep) with adaptive research strategies.

## Installation

```bash
pip install exo-search
```

Optional extras:

```bash
# FastAPI server
pip install "exo-search[server] @ git+..."

# Embedding-based reranking (Gemini, Vertex AI, OpenAI)
pip install "exo-search[embeddings] @ git+..."

# PDF content extraction
pip install "exo-search[pdf] @ git+..."
```

## Module Path

```python
import exo.search
```

## Public Exports (8)

| Export | Type | Description |
|---|---|---|
| `search` | `async function` | Run a search query and return the answer string with inline citations |
| `search_with_details` | `async function` | Run a search query and return the full `SearchResponse` with sources, suggestions, verification, and confidence |
| `stream` | `function` | Stream the search pipeline, yielding `PipelineEvent`, `StreamEvent`, and a final `SearchResponse` |
| `SearchConfig` | `dataclass` | Configuration for models, backends, tuning parameters, and verification settings |
| `SearchResponse` | `BaseModel` | Final structured response with answer, sources, suggestions, verification stats, contradictions, and confidence score |
| `PipelineEvent` | `BaseModel` | Pipeline stage transition event (stage name + started/completed status) |
| `ResearchMode` | `StrEnum` | Quality mode enum: `SPEED`, `BALANCED`, `QUALITY`, `DEEP` |
| `ConversationManager` | `class` | Multi-turn conversation history tracker with context injection |

## Import Patterns

```python
# High-level search (most common)
from exo.search import search, search_with_details, stream

# Configuration
from exo.search import SearchConfig, ResearchMode

# Streaming events
from exo.search import PipelineEvent, SearchResponse

# Multi-turn conversation
from exo.search import ConversationManager
```

## Architecture

```
exo.search
  __init__.py          Public API: search(), search_with_details(), stream()
  config.py            SearchConfig, context budget computation
  types.py             All Pydantic models and enums
  pipeline.py          Orchestration: run_search_pipeline(), stream_search_pipeline()
  conversation.py      ConversationManager, format_chat_history()
  focus_modes.py       Focus mode to source-type mapping
  server.py            FastAPI server with /search, /stream, /chat endpoints
  __main__.py          CLI: python -m exo.search
  agents/
    classifier.py      Query classification (skip/academic/social/sequential/complexity)
    researcher.py      Iterative tool-calling research loop
    query_planner.py   Adaptive hybrid research with sub-question decomposition
    deep_researcher.py Sequential multi-step research for complex queries (DAG-based)
    writer.py          Citation-aware answer generation with claim-first writing
    suggestion_generator.py  Follow-up suggestion generation
  tools/
    searxng.py         web_search(), academic_search(), social_search() via Serper/SearXNG
    web_fetcher.py     Page scraping, content enrichment, Jina Reader integration
    embeddings.py      Semantic reranking via cosine similarity (Gemini/Vertex/OpenAI)
    citation_verifier.py  Three-phase citation verification (keyword + LLM spot-check)
    contradiction_detector.py  Cross-source contradiction detection
    confidence.py      Heuristic confidence scoring (citation rate, authority, richness, coverage)
    researcher_tools.py  Agent tools: done() signal, reasoning_preamble()
    jina.py            Jina Reader/Search API integration
    serper.py          Serper (Google Search) API client
    compute.py         Shared computation utilities
```

## Quick Example

```python
import asyncio
from exo.search import search

async def main():
    answer = await search("What is quantum computing?")
    print(answer)

asyncio.run(main())
```

## Detailed Examples

### Search with Full Details

```python
import asyncio
from exo.search import search_with_details

async def main():
    result = await search_with_details(
        "What are the latest advances in CRISPR gene editing?",
        mode="quality",
    )

    print(result.answer)

    print("\nSources:")
    for i, source in enumerate(result.sources, 1):
        print(f"  [{i}] {source.title} ({source.url})")

    print(f"\nConfidence: {result.confidence:.0%}")

    if result.verification:
        v = result.verification
        print(f"Citations: {v.verified}/{v.total_citations} verified, {v.removed} removed")

    if result.contradictions and result.contradictions.has_contradictions:
        print(f"Contradictions found: {len(result.contradictions.contradictions)}")

    print("\nSuggested follow-ups:")
    for s in result.suggestions:
        print(f"  - {s}")

asyncio.run(main())
```

### Streaming Pipeline

```python
import asyncio
from exo.search import stream, PipelineEvent, SearchResponse
from exo.types import TextEvent

async def main():
    async for event in stream("latest AI news", mode="balanced"):
        if isinstance(event, PipelineEvent):
            print(f"[{event.stage}] {event.status}")
        elif isinstance(event, TextEvent):
            print(event.text, end="", flush=True)
        elif isinstance(event, SearchResponse):
            print(f"\n\n{len(event.sources)} sources cited")

asyncio.run(main())
```

### Multi-turn Conversation

```python
import asyncio
from exo.search import search_with_details, ConversationManager

async def main():
    conv = ConversationManager(max_turns=10)

    # First query
    result = await search_with_details(
        "What is transformer architecture?",
        chat_history=conv.turns,
    )
    conv.add_turn("What is transformer architecture?", result.answer)
    print(result.answer[:200])

    # Follow-up (classifier resolves "it" from history)
    result = await search_with_details(
        "How does it compare to RNNs?",
        chat_history=conv.turns,
    )
    conv.add_turn("How does it compare to RNNs?", result.answer)
    print(result.answer[:200])

asyncio.run(main())
```

### Custom Configuration

```python
from exo.search import search, SearchConfig

config = SearchConfig(
    model="anthropic:claude-sonnet-4",
    fast_model="openai:gpt-4o-mini",
    max_results=15,
    max_iterations=10,
    max_writer_sources=20,
    llm_verification=True,
    max_revision_rounds=3,
    serper_api_key="sk-...",       # Google Search via Serper
    jina_api_key="jina_...",       # Full-page content extraction
)

answer = await search("complex multi-step question", mode="quality", config=config)
```

## Research Modes

| Mode | Iterations | Enrichment | Verification | Use Case |
|---|---|---|---|---|
| `speed` | 2 | None | Keyword only | Quick factual lookups, simple questions |
| `balanced` | 6 | 80% of sources | Keyword only | General research, default for most queries |
| `quality` | 25 | 90% of sources | Keyword + LLM | In-depth research, complex topics |
| `deep` | 25 | 90% of sources | Keyword + LLM + contradiction detection | Multi-step questions requiring sequential reasoning |

The pipeline automatically routes to deep sequential research when the classifier detects queries that require finding information in step N before knowing what to search for in step N+1.

## Pipeline Stages

The search pipeline executes these stages in order:

1. **Classifier** -- Analyzes the query to determine search intent, generates sub-questions, detects if sequential research is needed, and rewrites follow-up queries using conversation context.

2. **Researcher** -- Iterative tool-calling loop that searches the web, academic databases, and social media. Uses adaptive query planning with sub-question decomposition. Deep mode uses a DAG-based multi-step research planner.

3. **Reranking** -- Semantic reranking of search results using embedding cosine similarity (Gemini, Vertex AI, or OpenAI). Falls back to keyword overlap when no embedding API is available.

4. **Enrichment** -- Fetches full page content for top results via Jina Reader or direct scraping. Budget-aware: computes how many sources and characters fit in the model's context window.

5. **Writer** -- Generates the cited answer. Quality/deep modes use claim-first writing: extract claims from sources, then compose the answer grounded in verified claims.

6. **Citation Verification** -- Three-phase post-hoc verification: keyword filter, LLM spot-check for passed citations, LLM second-chance for failed citations. Removes unsupported citations.

7. **Revision Loop** -- If too many citations were removed (above `revision_threshold`), the answer is revised and re-verified, up to `max_revision_rounds`.

8. **Contradiction Detection** -- Cross-checks factual claims against source content to surface genuine disagreements (quality/deep modes only).

9. **Confidence Scoring** -- Heuristic 0--1 score from four components: citation verification rate (40%), source authority (20%), content richness (20%), sub-question coverage (20%).

10. **Suggestions** -- Generates follow-up question suggestions (runs concurrently with writing).

## Configuration Reference

`SearchConfig` fields with their defaults and environment variable overrides:

| Field | Type | Default | Env Var | Description |
|---|---|---|---|---|
| `model` | `str` | `"openai:gpt-4o"` | `EXO_SEARCH_MODEL` | Primary LLM for research and writing |
| `fast_model` | `str` | `"openai:gpt-4o-mini"` | `EXO_SEARCH_FAST_MODEL` | Fast LLM for classification and suggestions |
| `embedding_model` | `str` | `"gemini-embedding-2-preview"` | `EXO_SEARCH_EMBEDDING_MODEL` | Model for semantic reranking |
| `searxng_url` | `str` | `"http://localhost:8888"` | `SEARXNG_URL` | SearXNG instance URL (fallback search backend) |
| `serper_api_key` | `str` | `""` | `SERPER_API_KEY` | Serper API key for Google Search (preferred backend) |
| `jina_api_key` | `str` | `""` | `JINA_API_KEY` | Jina Cloud API key for page content extraction |
| `jina_reader_url` | `str` | `"http://127.0.0.1:3000"` | `JINA_READER_URL` | Local Jina Reader URL |
| `max_results` | `int` | `10` | -- | Maximum search results per query |
| `max_iterations` | `int \| None` | `None` (auto) | -- | Override per-mode iteration limit |
| `max_writer_sources` | `int` | `15` | -- | Cap on sources passed to writer |
| `max_writer_words` | `int \| None` | `None` | -- | Override quality mode 2000-word target |
| `max_content_chars` | `int` | `10000` | -- | Max characters per page for enrichment |
| `max_deep_research_steps` | `int` | `7` | -- | Max steps in sequential research plan |
| `llm_verification` | `bool` | `False` | -- | Enable LLM-based claim verification |
| `claim_first_writing` | `bool` | `True` | -- | Use claim-first writing in quality/deep modes |
| `max_revision_rounds` | `int` | `2` | -- | Max write-verify-revise rounds |
| `revision_threshold` | `float` | `0.3` | -- | Revise if removed/total citations exceeds this |
| `context_window_tokens` | `int \| None` | `None` (auto) | -- | Override model context window size |
| `system_instructions` | `str` | `""` | -- | Custom instructions injected into the writer prompt |

## CLI Usage

```bash
# Single query
python -m exo.search "What is quantum computing?"

# Quality mode
python -m exo.search --quality quality "CRISPR gene editing"

# Streaming output
python -m exo.search --stream "latest AI news"

# Interactive chat
python -m exo.search --chat

# Start FastAPI server
python -m exo.search --serve --port 8000

# With verbose logging
python -m exo.search -v "test query"
```

## Server Endpoints

When running with `--serve` or `exo-search --serve`, the FastAPI server exposes:

| Method | Path | Description |
|---|---|---|
| `GET` | `/search` | Run a search query, returns `SearchResponse` JSON |
| `GET` | `/stream` | Stream search pipeline as server-sent events |
| `POST` | `/chat` | Multi-turn chat with session management |

## Key Types

### SearchResponse

```python
class SearchResponse(BaseModel):
    answer: str                                    # Cited answer text with [N] markers
    sources: list[Source]                           # Cited sources (title, url, content)
    suggestions: list[str]                          # Follow-up question suggestions
    query: str                                     # Effective query (after rewriting)
    mode: str                                      # Research mode used
    verification: CitationVerification | None      # Citation verification stats
    contradictions: ContradictionReport | None     # Cross-source contradictions
    confidence: float | None                       # 0-1 confidence score
    confidence_breakdown: dict | None              # Component-level breakdown
```

### PipelineEvent

```python
class PipelineEvent(BaseModel):
    type: str = "pipeline"
    stage: str     # "classifier", "researcher", "deep_research", "enrichment",
                   # "writer", "revision", "suggestions"
    status: str    # "started", "completed"
    message: str   # Optional detail message
```

### CitationVerification

```python
class CitationVerification(BaseModel):
    total_citations: int     # Total [N] markers found
    verified: int            # Citations confirmed by source content
    removed: int             # Citations removed as unsupported
    flagged: int             # Citations flagged but kept
    llm_verified: int        # Citations verified via LLM spot-check
    revision_count: int      # Number of revision rounds performed
```

### Classification

```python
class Classification(BaseModel):
    skip_search: bool                    # True for greetings, math, etc.
    personal_search: bool                # User-specific queries
    academic_search: bool                # Scholarly content needed
    discussion_search: bool              # Social/forum content needed
    show_weather_widget: bool            # Weather intent detected
    show_stock_widget: bool              # Stock/finance intent detected
    show_calculation_widget: bool        # Calculation intent detected
    requires_sequential_research: bool   # Multi-step research needed
    estimated_complexity: str            # "simple", "moderate", "complex"
```

### ResearchMode

```python
class ResearchMode(StrEnum):
    SPEED = "speed"
    BALANCED = "balanced"
    QUALITY = "quality"
    DEEP = "deep"
```
