"""Multi-Agent Workflow — Plan, Build, Review with specialized agents.

This example shows how to coordinate multiple Anvil agents:

  - Plan Agent:   Analyzes the task, creates a structured plan.
  - Build Agent:  Implements the plan with file operations.
  - Explore Agent: Reviews the implementation for quality.

Each agent has its own tool permissions and personality, ensuring
the right specialist handles each phase.

Run it:
    python main.py
"""

from anvil import (
    AnvilEngine,
    AnvilConfig,
    BaseAgent,
    AgentMode,
    PermissionAction,
    PermissionConfig,
)


def main() -> None:
    # ── 1. Define specialized agents ──────────────────────────────

    plan_agent = BaseAgent(
        name="plan",
        description="Analyzes tasks and creates step-by-step plans",
        mode=AgentMode.SUBAGENT,
        model="gpt-4o",
        temperature=0.3,
        max_steps=5,
        tools_whitelist=["read", "glob", "ls", "grep"],
        tools_blacklist=[],
    )

    build_agent = BaseAgent(
        name="build",
        description="Implements plans by writing and editing files",
        mode=AgentMode.SUBAGENT,
        model="gpt-4o",
        temperature=0.1,
        max_steps=15,
        tools_whitelist=[],  # Empty whitelist = all tools available
        tools_blacklist=[],
    )

    explore_agent = BaseAgent(
        name="explore",
        description="Reviews code quality, reads files, and reports findings",
        mode=AgentMode.SUBAGENT,
        model="gpt-4o",
        temperature=0.2,
        max_steps=8,
        tools_whitelist=["read", "glob", "ls", "grep", "bash"],
        tools_blacklist=["write", "edit"],
    )

    # ── 2. Configure the orchestrator ──────────────────────────────

    config = AnvilConfig(
        model="gpt-4o",
        verify=True,
        max_steps=30,
        temperature=0.2,
        permissions=PermissionConfig(
            default_action=PermissionAction.ALLOW,
            rules=[
                # Build agent can write files
                {"pattern": "build:*", "action": "allow"},
                # Explore agent is read-only
                {"pattern": "explore:write", "action": "deny"},
                {"pattern": "explore:edit", "action": "deny"},
            ],
        ),
        agents=[plan_agent, build_agent, explore_agent],
    )

    engine = AnvilEngine(config=config)

    # ── 3. Submit a multi-phase task ─────────────────────────────

    result = engine.run(
        "Create a Python module called `string_utils.py` with the following "
        "functions:\n\n"
        "1. `slugify(text)` — Convert text to a URL-safe slug\n"
        "2. `camel_to_snake(name)` — Convert CamelCase to snake_case\n"
        "3. `truncate(text, max_length, suffix='...')` — Truncate with suffix\n\n"
        "Use the Plan agent to break down the task, the Build agent to "
        "implement it, and the Explore agent to review the code quality.\n\n"
        "Make sure all functions have proper type hints, docstrings, and "
        "edge-case handling. The Explore agent should verify the code is "
        "production-ready."
    )

    # ── 4. Inspect results ───────────────────────────────────────

    print(f"\n{'='*60}")
    print(f"Overall Status: {result.status}")
    print(f"Steps Used:     {result.steps_used}")
    print(f"Verified:       {result.verified}")
    print(f"Cost:           ${result.total_cost:.4f}")
    print(f"{'='*60}\n")

    # Show which agents were invoked
    if hasattr(result, "agent_steps"):
        print("Agent Invocations:")
        for agent_name, count in result.agent_steps.items():
            print(f"  @{agent_name}: {count} steps")

    if result.verified:
        print("✅  Multi-agent task completed and verified!")
    else:
        print("⚠️  Task finished but verification had issues.")


if __name__ == "__main__":
    main()
