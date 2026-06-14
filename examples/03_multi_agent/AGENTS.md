# Multi-Agent Workflow — Project Context

## Project Overview

This example demonstrates Anvil's multi-agent coordination:
specialized agents handle different phases of a task, orchestrated
by the engine's Plan → Execute → Verify → Recover loop.

## Architecture

| Agent       | Role                                              | Tools                        |
|-------------|---------------------------------------------------|------------------------------|
| Plan        | Analyzes tasks, creates step-by-step plans        | read, glob, ls, grep         |
| Build       | Implements plans by writing and editing files      | all tools                    |
| Explore     | Reviews code quality, reports findings            | read, glob, ls, grep, bash   |

## Key Concepts

- **AgentMode.SUBAGENT** — Invoked on-demand by the primary loop.
- **tools_whitelist** — Restricts which tools an agent can use.
- **tools_blacklist** — Explicitly denies certain tools.
- **PermissionConfig** — Maps tool patterns to allow/deny/ask actions.
- **Permission resolution** — Most-specific glob wins; later rules override earlier ones.

## Conventions

- Plan agents should be read-only (no write/edit).
- Build agents have full tool access for implementation.
- Explore agents should be read-only to prevent unintended modifications.
- Use `@agent_name` syntax in task descriptions to invoke specific agents.
- Always set `verify=True` to ensure cross-agent quality checks.
