# Installation

## Requirements

- **Python 3.11+** -- Exo uses modern Python features (`types.UnionType`, `asyncio.TaskGroup`, `ExceptionGroup`) that require Python 3.11 or later.
- **An LLM API key** -- At minimum, you need an API key from OpenAI or Anthropic.
- **UV** -- Exo uses [UV](https://docs.astral.sh/uv/) for package management.

## Install from Git

Exo is not yet published on PyPI. Install directly from the Git repository:

```bash
# Install UV if you don't have it
curl -LsSf https://astral.sh/uv/install.sh | sh

# Clone the repository
git clone https://github.com/Midsphere-AI/exo-ai.git && cd exo-ai

# Sync all workspace packages (installs all packages in editable mode)
uv sync

# Verify the installation
uv run python -c "from exo import Agent, run, tool; print('OK')"
```

## Environment Variables

Set API keys for the LLM providers you plan to use:

```bash
# OpenAI (required for "openai:gpt-4o", "openai:gpt-4o-mini", etc.)
export OPENAI_API_KEY="sk-..."

# Anthropic (required for "anthropic:claude-sonnet-4-20250514", etc.)
export ANTHROPIC_API_KEY="sk-ant-..."
```

You can also pass API keys programmatically when constructing a provider:

```python
from exo.models.provider import get_provider

provider = get_provider("openai:gpt-4o", api_key="sk-...")
```

Or set them in a `.env` file and load with your preferred method (e.g., `python-dotenv`).

## Running Tests

```bash
# Run all tests
uv run pytest

# Run tests for a specific package
uv run pytest packages/exo-core/tests/
uv run pytest packages/exo-models/tests/

# Run with verbose output
uv run pytest -v
```

## Linting and Type Checking

```bash
# Lint with ruff
uv run ruff check packages/

# Type-check with pyright
uv run pyright packages/exo-core/
uv run pyright packages/exo-models/
```

## Verify Your Installation

Run this minimal script to confirm everything is working:

```python
from exo import Agent, tool

@tool
def hello(name: str) -> str:
    """Say hello."""
    return f"Hello, {name}!"

agent = Agent(
    name="greeter",
    model="openai:gpt-4o-mini",
    instructions="You are a friendly greeter.",
    tools=[hello],
)

print(agent.describe())
# {'name': 'greeter', 'model': 'openai:gpt-4o-mini', 'tools': ['hello'],
#  'handoffs': [], 'max_steps': 10, 'output_type': None}
```

This script only constructs the agent and does not make any LLM calls, so it works without an API key. If this runs without errors, your installation is correct.

## Next Steps

Continue to the [Quickstart](quickstart.md) to build and run your first agent.
