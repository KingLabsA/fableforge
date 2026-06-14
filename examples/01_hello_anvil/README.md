# Hello Anvil

A minimal example showing how to use the Anvil SDK to run a self-verified coding task.

## Quick Start

```bash
# Install anvil (from the monorepo root)
pip install -e ./anvil

# Run the example
cd examples/01_hello_anvil
python main.py
```

## What Happens

1. **Configure** — `AnvilConfig` sets the model, verification mode, and limits.
2. **Create** — `AnvilEngine` wraps the Plan → Execute → Verify → Recover loop.
3. **Run** — `engine.run(task)` submits a natural-language task.
4. **Inspect** — The result object tells you whether verification passed.

## Expected Output

```
============================================================
Status:     completed
Steps used: 4
Verified:   True
Cost:       $0.0023
============================================================

✅  Task completed and verified successfully!
```

## Customizing

Edit `AnvilConfig` to try different models, disable verification, or increase the step limit:

```python
config = AnvilConfig(
    model="claude-sonnet-4-20250514",
    verify=False,        # Skip verification (not recommended!)
    max_steps=25,        # Allow more iterations
    temperature=0.0,     # Deterministic output
)
```

## Next Steps

- **02_auto_fix_tests** — See how Anvil automatically detects and fixes failing tests.
- **03_multi_agent** — Learn about multi-agent coordination.
