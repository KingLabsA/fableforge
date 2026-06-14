# Multi-Agent Workflow — Plan, Build, Review

Coordinate specialized agents for a full Plan → Build → Review pipeline.

## Agent Roles

```
┌─────────┐     ┌─────────┐     ┌──────────┐
│  Plan   │────>│  Build  │────>│ Explore  │
│ Agent   │     │ Agent   │     │ Agent    │
└─────────┘     └─────────┘     └──────────┘
  Read-only      Full access     Read-only
  Analysis       Implementation   Review
```

- **Plan Agent** — Analyzes the task, reads existing code, and creates a
  structured implementation plan. Cannot modify files (whitelisted to read-only tools).

- **Build Agent** — Takes the plan and implements it. Has full tool access:
  can create, read, edit, and delete files, run commands, etc.

- **Explore Agent** — Reviews the Build agent's output for quality, style,
  and correctness. Read-only — can run tests and read files, but cannot modify them.

## Quick Start

```bash
# Install from monorepo root
pip install -e ./anvil

# Run the example
cd examples/03_multi_agent
python main.py
```

## Customizing Agents

You can adjust each agent's configuration:

```python
plan_agent = BaseAgent(
    name="plan",
    model="gpt-4o",          # Use a smarter model for planning
    temperature=0.3,           # Some creativity for planning
    max_steps=5,              # Planning shouldn't need many steps
    tools_whitelist=["read", "glob", "ls", "grep"],
)

build_agent = BaseAgent(
    name="build",
    model="gpt-4o",          # Production-quality implementation
    temperature=0.1,           # Low temperature for precise code
    max_steps=15,              # Enough room to implement + verify
    # Empty whitelist = all tools available
)

explore_agent = BaseAgent(
    name="explore",
    model="gpt-4o-mini",      # Cheaper model for review
    temperature=0.2,
    max_steps=8,
    tools_whitelist=["read", "glob", "ls", "grep", "bash"],
    tools_blacklist=["write", "edit"],  # Read-only enforce
)
```

## Permission System

Anvil's permission system controls what each agent can do:

```python
permissions=PermissionConfig(
    default_action=PermissionAction.ALLOW,
    rules=[
        {"pattern": "build:*", "action": "allow"},      # Build can do anything
        {"pattern": "explore:write", "action": "deny"},  # Explore can't write
        {"pattern": "explore:edit", "action": "deny"},    # Explore can't edit
    ],
)
```

## Built-in Agents

Anvil comes with four built-in agents you can use out of the box:

| Name     | Description                          | Mode      |
|----------|--------------------------------------|-----------|
| `plan`   | Strategic planning and decomposition | SUBAGENT  |
| `build`  | Code implementation                  | PRIMARY   |
| `explore`| Code review and exploration           | SUBAGENT  |
| `verify` | Verification and testing              | SUBAGENT  |

Override or extend them by passing custom `BaseAgent` instances to `AnvilConfig(agents=...)`.

## Next Steps

- Read the [Anvil Documentation](../../anvil/docs/api.md) for the full API reference.
- Try combining agents with different models for cost optimization.
- Use `@mention` syntax in tasks to route work to specific agents.
