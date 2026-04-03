# Migration Guide

This section covers migrating from AWorld to Exo. Exo is a ground-up rewrite of AWorld that simplifies the API surface while preserving the framework's capabilities.

## Why Migrate?

AWorld grew to 96,500 lines of code with accumulated complexity:

- **5 agent types** that resist composition (`LLMAgent`, `TaskLLMAgent`, `LoopLLMAgent`, `ParallelLLMAgent`, `SerialLLMAgent`)
- **3 config systems** (`ConfigDict`, `BaseConfig`, Pydantic models) mixed throughout the codebase
- **Sync/async duplication** (`BaseTool` and `AsyncBaseTool`, `run()` and `sync_run()`)
- **Stringly-typed message routing** (`category="tool"`, `topic="GROUP_RESULTS"`)
- **Deep factory chains** (`Factory[T]` + `AgentManager` + `ToolsManager`)

Exo addresses all of these with:

- **1 Agent class** with composable behavior via Swarm modes
- **1 config system** (Pydantic v2 models)
- **Async-first** with automatic sync wrapping
- **Typed message classes** (`UserMessage`, `AssistantMessage`, `ToolResult`)
- **1 Registry** pattern (`Registry[T]`)

## Migration Scope

The migration is broken into these areas:

| Area | AWorld Package | Exo Package | Difficulty |
|------|---------------|-----------------|------------|
| Agent definition | `aworld.agents` | `exo.agent` | Low |
| Tool registration | `aworld.core.tool`, `aworld.tools` | `exo.tool` | Low |
| Running agents | `aworld.runner`, `aworld.runners` | `exo.runner` | Low |
| Configuration | `aworld.config.conf` | `exo.config` | Medium |
| Multi-agent | `aworld.agents.swarm_composer_agent` | `exo.swarm` | Medium |
| Context engine | `aworld.core.context.amni` | `exo.context` | High |
| Memory | `aworld.memory` | `exo.memory` | Medium |
| Models/LLM | `aworld.models` | `exo.models` | Low |
| Tracing | `aworld.trace` | `exo.trace` | Medium |
| Evaluation | `aworld.evaluations` | `exo.eval` | Medium |
| MCP | `aworld.mcp_client` | `exo.mcp` | Low |
| Sandbox | `aworld.sandbox` | `exo.sandbox` | Medium |

## Getting Started

1. Start with the [detailed migration guide](./from-aworld.md) for step-by-step instructions
2. Migrate the simplest agents first (single agent, no context, no memory)
3. Add tools, then multi-agent, then context/memory

## Package Installation

AWorld was a monolith. Exo is a modular monorepo -- all packages are installed together:

```bash
git clone https://github.com/Midsphere-AI/exo-ai.git && cd exo-ai
uv sync
```

Optional extras can be enabled per-package. For example, from the relevant package directory:

```bash
uv sync --extra qdrant       # Vector memory backend (packages/exo-memory)
uv sync --extra kubernetes   # Kubernetes sandbox (packages/exo-sandbox)
```
