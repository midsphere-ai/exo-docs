# Planning

Planning adds a two-phase execution pattern to any agent: a **planner** agent runs first to produce a step-by-step plan, then the **executor** agent carries out that plan. This separation improves task decomposition, lets you use a cheaper model for planning, and keeps the executor focused on execution rather than strategy.

## Basic Usage

Enable planning by setting `planning_enabled=True` on the agent:

```python
from exo import Agent, run

agent = Agent(
    name="researcher",
    model="openai:gpt-4o",
    instructions="You are a thorough research assistant.",
    tools=[search, summarize],
    planning_enabled=True,
)

result = await run(agent, "Compare React vs Svelte for a new project")
```

When the agent runs, the runtime automatically creates an ephemeral planner agent, runs it on the same input, extracts the plan text, and injects it into the executor's context before the main run begins.

## How It Works

```
User Input
    |
    v
+-----------------------------+
|  Phase 1: Planner Pre-Pass  |
|                             |
|  Ephemeral planner agent    |
|  runs the full LLM-tool     |
|  loop on the original input |
|  -> produces plan_text      |
|                             |
|  Transcript is discarded    |
+-------------+---------------+
              | plan_text
              v
+-----------------------------+
|  Plan Injection             |
|                             |
|  The plan is prepended to   |
|  the executor's input or    |
|  appended as a system       |
|  message                    |
+-------------+---------------+
              | augmented input
              v
+-----------------------------+
|  Phase 2: Main Execution    |
|                             |
|  Agent runs its normal      |
|  LLM-tool loop with the     |
|  plan injected as context   |
+-----------------------------+
```

The planner is a real agent -- it can call tools, reason over multiple steps, and use all the tools available to the executor (except `spawn_self` and internal context tools). Its full conversation transcript is discarded after the plan text is extracted; only the final text output survives.

If the planner produces empty text, the plan injection is skipped entirely and the executor receives the original input unchanged.

## Agent Parameters

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `planning_enabled` | `bool` | `False` | When `True`, runs an ephemeral planner agent before the main execution |
| `planning_model` | `str \| None` | `None` | Model for the planner phase. When `None`, uses the agent's own `model` |
| `planning_instructions` | `str` | `""` | Instructions for the planner agent. When empty, uses the agent's own `instructions` |

## Using a Separate Planning Model

One of the most useful patterns is pairing an expensive executor model with a cheaper planning model. The planner only needs to decompose the task -- it does not need the full reasoning power of the executor:

```python
from exo import Agent, run

agent = Agent(
    name="coder",
    model="anthropic:claude-sonnet-4-6",
    instructions="You are an expert software engineer.",
    tools=[read_file, write_file, run_tests],
    planning_enabled=True,
    planning_model="openai:gpt-4o-mini",
    planning_instructions=(
        "Analyze the task and create a step-by-step implementation plan. "
        "List files to modify, functions to change, and tests to add. "
        "Do NOT execute -- only plan."
    ),
)

result = await run(agent, "Add pagination to the /users endpoint")
```

When `planning_model` differs from the agent's model, the runtime resolves a provider in this order:

1. **Same model** -- reuse the executor's provider directly
2. **Same backend, different model** (e.g., both `openai:*`) -- clone the provider with the new model name
3. **Different backend** -- resolve a fresh provider via `get_provider()`

If none of these succeed, an `AgentError` is raised at runtime.

## Custom Planning Instructions

By default, the planner uses the same instructions as the executor. You can override this to give the planner a more focused directive:

```python
from exo import Agent, run

agent = Agent(
    name="analyst",
    model="openai:gpt-4o",
    instructions="You are a data analyst. Answer questions with clear visualizations.",
    tools=[query_db, chart],
    planning_enabled=True,
    planning_instructions=(
        "You are a planning assistant. Given a data analysis request, "
        "break it into steps: which tables to query, what aggregations "
        "to compute, and what chart types to use. Output a numbered plan."
    ),
)
```

## Plan Injection Format

The plan is injected differently depending on the input type.

**String input** -- the plan is prepended alongside the original task:

```
Original task:
Compare React vs Svelte for a new project

Planner output:
1. Research React -- strengths, weaknesses, ecosystem
2. Research Svelte -- strengths, weaknesses, ecosystem
3. Compare on performance, DX, ecosystem, learning curve
4. Synthesize findings

Use the planner output while completing the task.
```

**Content-block input** (e.g., images, multi-part content) -- a `SystemMessage` is appended to the message history:

```
Planner output:
1. Research React -- strengths, weaknesses, ecosystem
...

Use the planner output while responding to the next user task.
```

## Planning with Streaming

Planning works with `run.stream()`. The planner pre-pass runs to completion first (it is not streamed), then streaming begins for the executor phase:

```python
import asyncio
from exo import Agent, run
from exo.types import TextEvent

agent = Agent(
    name="writer",
    model="openai:gpt-4o",
    instructions="You are a technical writer.",
    planning_enabled=True,
    planning_instructions="Outline the structure: sections, key points, and flow.",
)

async def main():
    async for event in run.stream(agent, "Write a guide on Python async/await"):
        if isinstance(event, TextEvent):
            print(event.text, end="")

asyncio.run(main())
```

Only the executor's output is streamed. The planner's intermediate steps and tool calls are not visible in the stream.

## Planning with Self-Spawn

Planning and self-spawn are compatible. The planner agent inherits `allow_self_spawn` and related settings but does not receive the `spawn_self` tool -- the planner should plan, not execute:

```python
from exo import Agent, run

agent = Agent(
    name="coordinator",
    model="openai:gpt-4o",
    instructions="Plan research, then delegate via spawn_self.",
    tools=[search],
    planning_enabled=True,
    planning_instructions="Create a research plan listing topics to investigate.",
    allow_self_spawn=True,
    max_spawn_children=4,
)
```

## Ephemeral Planner Agent Details

The planner agent is created internally with these properties:

| Property | Value |
|----------|-------|
| `name` | `{agent.name}_planner` |
| `model` | `planning_model` or agent's `model` |
| `instructions` | `planning_instructions` or agent's `instructions` |
| `tools` | Agent's tools, minus `spawn_self`, `retrieve_artifact`, and context tools |
| `memory` | `None` (stateless) |
| `context` | Shared with the parent agent |
| `max_steps` | Same as agent |
| `temperature` | Same as agent |
| `max_tokens` | Same as agent |

The planner is stateless -- it has no memory and does not persist its conversation. Each run creates a fresh planner agent.

## Things to Know

- **Double LLM cost.** Planning adds an extra agent run before execution. Use a cheaper `planning_model` to keep costs down.
- **Planner transcript is discarded.** Only the final text output from the planner survives. Intermediate tool calls, reasoning steps, and partial outputs are thrown away.
- **Planner is a full agent.** It can call tools and run multiple LLM steps. If you want a lightweight plan, use instructions that say "do NOT call tools, only plan" or keep `max_steps` low on the agent.
- **Empty plan is a no-op.** If the planner returns empty text, the executor gets the original input unchanged.
- **Provider must be resolvable.** If `planning_model` is set and no provider can be resolved for it, `AgentError` is raised at runtime, not at agent construction time.
- **Works with both `run()` and `run.stream()`.** The planner pre-pass runs in both entry points.

## API Summary

| Symbol | Module | Description |
|--------|--------|-------------|
| `Agent(planning_enabled=...)` | `exo` | Enable the planner pre-pass |
| `Agent(planning_model=...)` | `exo` | Override the model used for planning |
| `Agent(planning_instructions=...)` | `exo` | Override the instructions used for planning |
