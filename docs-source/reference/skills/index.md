# exo-skills

Skill source watchers for Exo hot-reloading. Provides filesystem and GitHub-based watchers that monitor skill directories for changes and yield batches of `SkillChangeEvent` objects for live skill updates.

## Installation

Part of the exo-ai monorepo:

```bash
git clone https://github.com/Midsphere-AI/exo-ai.git && cd exo-ai
uv sync
```

## Module Path

```python
import exo_skills
```

## Dependencies

- `exo-core` -- provides `Skill`, `SkillWatcher`, `SkillChangeEvent`, `SkillRegistry`, and `SkillSyncManager`
- `watchfiles` -- filesystem change detection (used by `LocalFileWatcher`)

## Public Exports (2)

| Export | Source Module | Description |
|---|---|---|
| `LocalFileWatcher` | `watchers.local` | Watches a local directory for skill file changes using `watchfiles` |
| `GitHubPollingWatcher` | `watchers.github` | Polls a GitHub repository for skill changes via periodic `git pull` |

## Import Patterns

```python
# Import watchers
from exo_skills import LocalFileWatcher, GitHubPollingWatcher

# Import from watchers sub-package
from exo_skills.watchers import LocalFileWatcher, GitHubPollingWatcher
```

## Architecture

```
exo_skills
  __init__.py              Re-exports LocalFileWatcher, GitHubPollingWatcher
  watchers/
    __init__.py            Re-exports watchers
    local.py               LocalFileWatcher (watchfiles-based)
    github.py              GitHubPollingWatcher (git pull polling)
```

Both watchers implement the `SkillWatcher` abstract base class from `exo.skills` in exo-core. They integrate with `SkillSyncManager` to push live skill updates to bound agents.

## Related Core Types (from exo-core)

These types are defined in `exo.skills` and used by both watchers:

| Type | Description |
|---|---|
| `SkillWatcher` | Abstract base class with `watch()` and `stop()` methods |
| `SkillChangeEvent` | Dataclass with `kind` (added/modified/removed), `skill_name`, `skill`, `source_path` |
| `Skill` | A loaded skill with name, description, usage, tool_list, and metadata |
| `SkillRegistry` | Multi-source skill registry that loads from local paths and GitHub URLs |
| `SkillSyncManager` | Orchestrator that connects watchers to agents for live updates |

## Quick Example

```python
import asyncio
from exo_skills import LocalFileWatcher, GitHubPollingWatcher

async def watch_local():
    watcher = LocalFileWatcher("./skills", debounce_ms=500)
    async for batch in watcher.watch():
        for event in batch:
            print(f"{event.kind}: {event.skill_name}")
    await watcher.stop()

async def watch_github():
    watcher = GitHubPollingWatcher(
        "https://github.com/acme/skills/tree/main/agents",
        poll_interval=60.0,
    )
    async for batch in watcher.watch():
        for event in batch:
            print(f"{event.kind}: {event.skill_name}")
    await watcher.stop()
```

### Using with SkillSyncManager

```python
import asyncio
from exo import Agent
from exo.skills import SkillRegistry, SkillSyncManager
from exo_skills import LocalFileWatcher

async def main():
    registry = SkillRegistry()
    registry.register_source("./skills")
    registry.load_all()

    agent = Agent(name="assistant", model="openai:gpt-4o")

    sync = SkillSyncManager(registry, tool_resolver={})
    sync.add_watcher(LocalFileWatcher("./skills"))
    sync.bind_agent(agent)

    await sync.start()
    # Agent now receives live skill updates
    # ...
    await sync.stop()

asyncio.run(main())
```

## Submodule Reference

| Page | Description |
|---|---|
| [watchers](watchers.md) | LocalFileWatcher and GitHubPollingWatcher reference |
