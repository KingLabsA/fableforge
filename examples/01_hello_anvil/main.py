"""Hello Anvil — Your first self-verified coding agent.

This example walks through the basics of the Anvil SDK:
  1. Configure a session
  2. Run a simple task through Plan → Execute → Verify → Recover
  3. Inspect the results

Run it:
    python main.py
"""

from anvil import AnvilEngine, AnvilConfig


def main() -> None:
    # ── 1. Configure ──────────────────────────────────────────────
    # AnvilConfig sets sensible defaults. Override anything you need.
    config = AnvilConfig(
        model="gpt-4o",            # or any model registered in ModelRegistry
        verify=True,               # Enable the verify step (default: True)
        max_steps=10,              # Cap tool-call iterations
        temperature=0.2,           # Low temperature for precise code
    )

    # ── 2. Create the engine ──────────────────────────────────────
    # The engine orchestrates the Plan → Execute → Verify → Recover loop.
    engine = AnvilEngine(config=config)

    # ── 3. Submit a task ─────────────────────────────────────────
    # Anvil will plan the work, execute with tools, verify the result,
    # and recover from any failures — all automatically.
    result = engine.run(
        "Create a Python function called `greet` in greet.py that takes "
        "a name and returns 'Hello, {name}!'. Then verify it works by "
        "running the function."
    )

    # ── 4. Inspect the result ─────────────────────────────────────
    print(f"\n{'='*60}")
    print(f"Status:     {result.status}")
    print(f"Steps used: {result.steps_used}")
    print(f"Verified:   {result.verified}")
    print(f"Cost:       ${result.total_cost:.4f}")
    print(f"{'='*60}\n")

    if result.verified:
        print("✅  Task completed and verified successfully!")
    else:
        print("❌  Verification failed. Recovery attempts exhausted.")
        print(f"   Last error: {result.last_error}")


if __name__ == "__main__":
    main()
