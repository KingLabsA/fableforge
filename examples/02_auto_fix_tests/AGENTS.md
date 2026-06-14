# Auto-Fix Tests — Project Context

## Project Overview

This example demonstrates Anvil's **self-verification loop**:
a deliberately buggy module, a test suite that catches the bugs,
and Anvil's ability to detect, diagnose, and fix the failures.

## Architecture

| File                | Purpose                                         |
|---------------------|-------------------------------------------------|
| `calculator.py`     | Arithmetic module with **5 intentional bugs**  |
| `test_calculator.py`| Pytest suite (17 tests, ~7 will fail initially) |
| `main.py`           | Orchestrates the detect→fix→verify cycle        |

## Known Bugs (for context — do NOT pre-fix)

1. `add()` — subtracts instead of adding (`a - b`)
2. `multiply()` — adds instead of multiplying (`a + b`)
3. `divide()` — no `ZeroDivisionError` handling
4. `power()` — multiplies instead of exponentiating (`a * exponent`)
5. `negate()` — returns `a` instead of `-a`

## Conventions

- Use pytest for all tests.
- Each function has its own test class for organized failures.
- Bug fixes should be minimal — change one line per bug.
- After Anvil fixes the file, `calculator.py` should match the
  mathematical contract described in each docstring.
