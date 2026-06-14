# Hello Anvil — Project Context

## Project Overview

This is a minimal "Hello World" example demonstrating the Anvil SDK's
core loop: **Plan → Execute → Verify → Recover**.

## Architecture

- `main.py` — Single-file example using `AnvilEngine` and `AnvilConfig`.
- No external dependencies beyond the `anvil-agent` package.

## Key Concepts

| Concept       | What It Does                                      |
|---------------|---------------------------------------------------|
| `AnvilConfig` | Configures model, verification, and limits        |
| `AnvilEngine` | Runs the Plan→Execute→Verify→Recover loop         |
| `engine.run()`| Submits a natural-language task and returns results|
| `result.verified` | Boolean — did the task pass verification?     |
| `result.steps_used` | How many tool-call iterations were needed    |

## Conventions

- Use type hints everywhere.
- Run `anvil verify` before committing.
- Prefer `AnvilConfig` defaults; only override when necessary.
