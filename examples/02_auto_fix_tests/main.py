"""Auto-Fix Tests — Anvil's self-verification loop in action.

This example demonstrates Anvil's core differentiator:
  1. Run the test suite → tests FAIL (calculator.py has bugs)
  2. Detect which tests failed and why
  3. Diagnose root causes in the source code
  4. Apply targeted fixes
  5. Re-verify → all tests should now PASS

Run it:
    python main.py
"""

import subprocess
import sys
from pathlib import Path

from anvil import AnvilEngine, AnvilConfig


def run_tests() -> tuple[bool, str]:
    """Run pytest on calculator tests and return (passed, output)."""
    result = subprocess.run(
        [sys.executable, "-m", "pytest", "test_calculator.py", "-v", "--tb=short"],
        capture_output=True,
        text=True,
        cwd=Path(__file__).parent,
    )
    return result.returncode == 0, result.stdout + result.stderr


def main() -> None:
    # ── Step 0: Run tests BEFORE Anvil intervention ───────────────
    print("=" * 60)
    print("Step 0: Running tests on BUGGY calculator.py")
    print("=" * 60)
    passed, output = run_tests()
    print(output[-2000:] if len(output) > 2000 else output)
    print(f"\nTests passed: {passed} (expected: False)\n")

    # ── Step 1: Configure Anvil ───────────────────────────────────
    config = AnvilConfig(
        model="gpt-4o",
        verify=True,
        max_steps=20,           # Needs more steps for multi-bug fixes
        temperature=0.1,
    )
    engine = AnvilEngine(config=config)

    # ── Step 2: Ask Anvil to fix all failing tests ────────────────
    print("=" * 60)
    print("Step 1: Asking Anvil to fix the bugs")
    print("=" * 60)

    result = engine.run(
        "Fix all bugs in calculator.py. The test suite in test_calculator.py "
        "has 17 tests, and several are currently failing. Here's what's wrong:\n"
        "- add() subtracts instead of adding\n"
        "- multiply() adds instead of multiplying\n"
        "- divide() doesn't handle ZeroDivisionError\n"
        "- power() multiplies instead of exponentiating\n"
        "- negate() returns the number unchanged instead of negating\n\n"
        "Fix each function so that ALL tests in test_calculator.py pass. "
        "After fixing, run the test suite to verify."
    )

    print(f"\nResult: status={result.status}, verified={result.verified}")
    print(f"Steps used: {result.steps_used}")

    # ── Step 3: Run tests AFTER Anvil intervention ────────────────
    print("\n" + "=" * 60)
    print("Step 2: Running tests on FIXED calculator.py")
    print("=" * 60)
    passed_after, output_after = run_tests()
    print(output_after[-2000:] if len(output_after) > 2000 else output_after)
    print(f"\nTests passed after fix: {passed_after}")

    # ── Final verdict ────────────────────────────────────────────
    if not passed and passed_after:
        print("\n✅  Verify-Recover loop succeeded! All bugs were fixed.")
    else:
        print("\n⚠️  Some tests may still be failing. Try increasing max_steps.")


if __name__ == "__main__":
    main()
