# exo_skills.watchers

Concrete `SkillWatcher` implementations for monitoring skill sources and yielding change events.

## LocalFileWatcher

```python
from exo_skills import LocalFileWatcher
```

Watches a local directory for skill file changes using the `watchfiles` library. Detects additions, modifications, and removals of `skill.md` / `SKILL.md` files. Changes are debounced and diffed against a snapshot to produce batches of `SkillChangeEvent` objects.

### Constructor

```python
LocalFileWatcher(path: str | Path, debounce_ms: int = 500)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `path` | `str \| Path` | *required* | Root directory to watch for skill files |
| `debounce_ms` | `int` | `500` | Minimum quiet period in milliseconds before processing a batch of filesystem events |

### Methods

#### `watch() -> AsyncIterator[list[SkillChangeEvent]]`

Yield batches of skill change events as they occur. Takes an initial snapshot on the first iteration, then watches the directory for changes. The iterator terminates when `stop()` is called.

```python
watcher = LocalFileWatcher("./skills")
async for batch in watcher.watch():
    for event in batch:
        print(event.kind, event.skill_name)
```

#### `stop() -> None`

Signal the watcher to stop. Causes the `awatch` loop in `watch()` to terminate, ending the async iterator.

```python
await watcher.stop()
```

### How It Works

1. On first iteration of `watch()`, scans the directory tree for `skill.md` / `SKILL.md` files and builds an initial snapshot
2. Uses `watchfiles.awatch()` with a filter that only passes skill file changes
3. On each filesystem event batch, re-scans the directory and diffs against the previous snapshot
4. Yields a list of `SkillChangeEvent` objects for any added, modified, or removed skills
5. Non-semantic changes (e.g. whitespace-only edits) are detected and silently ignored

### Example

```python
import asyncio
from exo_skills import LocalFileWatcher

async def main():
    watcher = LocalFileWatcher("./skills", debounce_ms=300)

    async for batch in watcher.watch():
        for event in batch:
            if event.kind == "added":
                print(f"New skill: {event.skill_name}")
            elif event.kind == "modified":
                print(f"Updated: {event.skill_name}")
            elif event.kind == "removed":
                print(f"Removed: {event.skill_name}")

asyncio.run(main())
```

---

## GitHubPollingWatcher

```python
from exo_skills import GitHubPollingWatcher
```

Watches a GitHub repository for skill changes by periodically running `git pull --ff-only`. The repository is shallow-cloned on first use and cached locally. On each poll cycle, upstream changes are fetched and diffed against a snapshot to produce `SkillChangeEvent` batches.

### Constructor

```python
GitHubPollingWatcher(
    source_url: str,
    poll_interval: float = 300.0,
    cache_dir: Path | None = None,
)
```

| Parameter | Type | Default | Description |
|---|---|---|---|
| `source_url` | `str` | *required* | GitHub URL to watch (e.g. `https://github.com/owner/repo/tree/branch/subdir`) |
| `poll_interval` | `float` | `300.0` | Seconds between polls (default: 5 minutes) |
| `cache_dir` | `Path \| None` | `~/.exo/skills` | Local directory for cloned repositories |

### Methods

#### `watch() -> AsyncIterator[list[SkillChangeEvent]]`

Yield batches of skill change events as they are detected. Performs an initial shallow clone, takes a snapshot, then enters a poll loop that runs `git pull --ff-only` at the configured interval. The iterator terminates when `stop()` is called.

```python
watcher = GitHubPollingWatcher(
    "https://github.com/acme/skills/tree/main/agents",
    poll_interval=60.0,
)
async for batch in watcher.watch():
    for event in batch:
        print(event.kind, event.skill_name)
```

#### `stop() -> None`

Signal the watcher to stop. Sets the internal stop event, causing the poll loop in `watch()` to terminate on its next cycle.

```python
await watcher.stop()
```

### Supported URL Formats

The watcher parses GitHub URLs of the form:

```
https://github.com/{owner}/{repo}
https://github.com/{owner}/{repo}/tree/{branch}
https://github.com/{owner}/{repo}/tree/{branch}/{subdir}
```

If no branch is specified, `main` is assumed. If a subdirectory is specified, only skills within that subdirectory are scanned.

### How It Works

1. Parses the GitHub URL into owner, repo, branch, and optional subdirectory
2. Shallow-clones the repository to `{cache_dir}/{owner}/{repo}/{branch}` (if not already cached)
3. Takes an initial snapshot of all skill files
4. Enters a poll loop: sleeps for `poll_interval` seconds, then runs `git pull --ff-only`
5. After each pull, re-scans and diffs against the previous snapshot
6. Yields `SkillChangeEvent` batches for any detected changes
7. Failed `git pull` operations are logged as warnings and the cycle continues

### Raises

| Exception | Condition |
|---|---|
| `SkillError` | If `source_url` is not a valid GitHub URL |

### Example

```python
import asyncio
from exo_skills import GitHubPollingWatcher

async def main():
    watcher = GitHubPollingWatcher(
        "https://github.com/myorg/agent-skills/tree/main/skills",
        poll_interval=120.0,  # Check every 2 minutes
    )

    async for batch in watcher.watch():
        for event in batch:
            print(f"[{event.kind}] {event.skill_name} from {event.source_path}")

asyncio.run(main())
```

---

## SkillChangeEvent

Defined in `exo.skills` (exo-core). Both watchers yield lists of this dataclass.

```python
from exo.skills import SkillChangeEvent
```

| Field | Type | Description |
|---|---|---|
| `kind` | `Literal["added", "modified", "removed"]` | The type of change detected |
| `skill_name` | `str` | Name of the affected skill |
| `skill` | `Skill \| None` | The new/updated `Skill` object, or `None` for removals |
| `source_path` | `str` | The source path or URL being watched |
