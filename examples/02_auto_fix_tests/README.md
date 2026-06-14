# Auto-Fix Tests — Anvil's Verify-Recover Loop

See Anvil's core value proposition in action: detect failing tests,
diagnose root causes, apply fixes, and re-verify — all automatically.

## The Setup

`calculator.py` has 5 intentional bugs:

| Function  | Bug                              | Expected Fix       |
|-----------|----------------------------------|--------------------|
| `add()`   | Returns `a - b`                  | Change to `a + b`  |
| `multiply()` | Returns `a + b`               | Change to `a * b`  |
| `divide()` | No zero-division handling       | Add `ZeroDivisionError` |
| `power()` | Returns `a * exponent`          | Change to `a ** exponent` |
| `negate()` | Returns `a` instead of `-a`     | Change to `-a`     |

Running the test suite initially yields ~7 failures. Anvil automatically
detects the failures, reads the error messages, fixes each bug, and
re-runs the tests until they all pass.

## Quick Start

```bash
# Install from monorepo root
pip install -e ./anvil
pip install pytest

# Run the example
cd examples/02_auto_fix_tests
python main.py
```

## Step-by-Step Walkthrough

### 1. Initial Run — Tests Fail

```bash
$ pytest test_calculator.py -v
```

You'll see failures for `add`, `multiply`, `power`, `negate`, and `divide`.

### 2. Anvil Detects Failures

`main.py` captures the test output and feeds it to Anvil as context.

### 3. Anvil Diagnoses and Fixes

Anvil reads each error message, traces it back to the source, and applies
a minimal fix — changing only the line that causes the bug.

### 4. Re-Verification

Anvil re-runs the test suite. If any test still fails, the loop repeats.
Up to `max_steps` iterations are allowed (default in this example: 20).

### 5. All Tests Pass

After Anvil finishes, `calculator.py` should have correct implementations
and all 17 tests should pass.

## Key Takeaways

- **Anvil doesn't just generate code** — it *verifies* the code works.
- The **Recover** step is what sets Anvil apart: failed verification
  triggers automatic diagnosis and repair.
- Increasing `max_steps` gives Anvil more room to fix complex issues.

## Next Steps

- **03_multi_agent** — Coordinate multiple specialized agents.
