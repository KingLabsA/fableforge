<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/logo-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/logo-light.svg">
  <img alt="Anvil" src="docs/assets/logo-light.svg" width="400">
</picture>

# Anvil — The Self-Verified Coding Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/) [![Tests](https://img.shields.io/badge/tests-278+-green.svg)](tests/)


> **Generate → Execute → Verify → Recover**

Every other open agent generates and hopes. **Anvil generates, runs, checks, and fixes** — because it was trained on 210,000 examples of real agents doing exactly that.

This isn't prompt engineering. This is **behavior engineering**.

---

## Why Anvil?

| Other Agents | Anvil |
|---|---|
| Generate code and hope it works | Generate code, then **verify it works** |
| No error recovery | **Self-healing** with 3 retry attempts |
| One-shot output | **Iterative** Plan→Execute→Verify→Recover loop |
| No cost awareness | **Token tracking + model routing** for cost optimization |
| Black box | **Full session tracking**, verify reports, telemetry |
| Requires expensive API | Runs **fully local** with ShellWhisperer (1.5B) |

## The Verification Loop

```
   ┌──────┐     ┌──────┐     ┌──────┐     ┌──────┐
   │ PLAN │────▶│ EXEC │────▶│VERIFY│────▶│ DONE │
   └──────┘     └──────┘     └──┬───┘     └──────┘
                                 │ Fail
                                 ▼
                            ┌──────┐
                            │RECOVR│────▶ back to EXEC
                            └──────┘
```

Anvil doesn't just write code. It **verifies** every change:

1. **Syntax check** — Does the code parse?
2. **Test run** — Do the tests pass?
3. **Lint check** — Is the code clean?
4. **Import check** — Are dependencies valid?

If verification fails, Anvil **diagnoses the error, generates a fix, and re-verifies**. Up to 3 retry cycles. This isn't optional — it's the core loop.

## Quick Start

```bash
pip install anvil-agent

# Run with local model (ollama)
anvil run "Add error handling to main.py"

# Run with API model
anvil run -m gpt-4o "Refactor the auth module"

# Interactive chat with verification
anvil chat

# Verify existing code
anvil verify src/

# Start as persistent daemon
anvil daemon --port 8765

# List past sessions
anvil sessions
```

## The Name

**Anvil** — where code gets forged, hammered, and tested until it holds.

Every blacksmith knows: you don't just shape metal on the anvil. You **test** it. You strike it, check it, and if it's not right, you heat it again and hammer it until it is. That's what this agent does with code.

**Other agents shape and ship. Anvil shapes, verifies, and only then ships.**

## Architecture

```
anvil/
├── core/
│   ├── engine.py          # Plan→Execute→Verify→Recover loop
│   ├── config.py          # 7-layer configuration system
│   └── session.py          # Full session tracking + persistence
├── tools/
│   └── executor.py         # Bash, Read, Write, Edit, Grep, Glob, LS
├── verify/
│   └── pipeline.py         # Syntax, test, lint, import verification
├── models/
│   └── registry.py          # Local (ollama), OpenAI, Anthropic + cost tracking
├── integrations/
│   ├── verifyloop.py        # VerifyLoop framework integration
│   ├── error_recovery.py   # ErrorRecovery engine integration
│   ├── agent_swarm.py      # AgentSwarm coordination integration
│   └── cost_optimizer.py   # CostOptimizer routing integration
├── daemon/
│   └── server.py            # Persistent HTTP daemon mode
├── tui/
│   └── dashboard.py         # Rich terminal dashboard
└── cli.py                  # run, chat, verify, daemon, sessions, models
```

## The FableForge Ecosystem

Anvil is the flagship product of the **FableForge** ecosystem — 21 open-source projects built from 210K real agent traces:

| Project | What It Does |
|---|---|
| **Anvil** | Self-verified coding agent (this one) |
| VerifyLoop | Plan→Execute→Verify→Recover framework |
| ErrorRecovery | Self-healing middleware (3,725 error examples) |
| FableForge-14B | The fine-tuned model (4-stage training) |
| ShellWhisperer | 1.5B edge agent (phone/RPi, 50ms) |
| ReasonCritic | Verification model (130 benchmark tasks) |
| TraceCompiler | Compile traces → LoRA skills |
| AgentRuntime | Persistent agent daemon (systemd for AI) |
| AgentSwarm | Multi-agent from real trace transitions |
| AgentTelemetry | Datadog for agents (token tracking, costs) |
| BenchAgent | HumanEval for tool-use (107 tasks) |
| AgentDev | VSCode extension with verification |
| TraceViz | Trace replay visualizer (Next.js) |
| AgentSkills.org | npm for agent behaviors |
| AgentCurriculum | 5-stage progressive training |
| AgentFuzzer | Adversarial testing for agents |
| AgentConstitution | Safety guardrails from traces |
| CostOptimizer | Token cost reduction (50-80%) |
| AgentProfiler | Behavioral fingerprinting |
| TrajectoryDistiller | Trace→training data pipeline |
| Fable5-Dataset | HuggingFace dataset release |

## Configuration

Create `.anvil.json` in your project root:

```json
{
  "model": {
    "model": "local",
    "temperature": 0.2,
    "max_tokens": 4096
  },
  "verify": {
    "enabled": true,
    "auto_recover": true,
    "max_retries": 3,
    "check_syntax": true,
    "check_tests": true,
    "check_lint": true
  },
  "tools": {
    "allow_shell": true,
    "sandbox": false
  },
  "safety": {
    "constitution_enabled": true,
    "blocked_commands": ["rm -rf /", "mkfs"],
    "require_confirmation_for": ["git push", "DROP TABLE"]
  },
  "cost": {
    "max_cost_per_session_usd": 5.0,
    "route_by_complexity": true,
    "simple_model": "local",
    "complex_model": "gpt-4o"
  }
}
```

## Daemon Mode

Run Anvil as a persistent server:

```bash
anvil daemon --port 8765
```

```bash
curl -X POST http://localhost:8765/run \
  -H "Content-Type: application/json" \
  -d '{"task": "Add input validation to all API endpoints"}'
```

## Model Backends

| Model | Type | Input $/1M | Output $/1M |
|---|---|---|---|
| local (fableforge-14b) | Local | Free | Free |
| gpt-4o | API | $2.50 | $10.00 |
| gpt-4o-mini | API | $0.15 | $0.60 |
| o3-mini | API | $1.10 | $4.40 |
| claude-3.5-sonnet | API | $3.00 | $15.00 |
| claude-3.5-haiku | API | $0.80 | $4.00 |

## How It's Different

### Trained on Real Behavior

The FableForge model was trained on 210K examples from real agent traces:
- **87.7% planning rate** — agents plan before they act
- **39.5% error recovery rate** — agents that hit errors and recover
- **1,311-step trace** — the Boeing 747 trace proves agents need persistent runtime
- **31 tools** mapped — transition matrices drive swarm coordination

### Verification Is Not Optional

Other agents: "Here's the code, hope it works."

Anvil: "Here's the code. I ran it. Tests pass. Lint is clean. Imports resolve. Here's the proof."

### Self-Healing

When verification fails, Anvil doesn't just report the error. It **reads the error, generates a fix, applies it, and re-verifies**. This is the ErrorRecovery engine with 3,725 real error examples baked in.

### Ecosystem Integration

Anvil doesn't work alone. It's wired into the full FableForge stack:
- **VerifyLoop** → Sophisticated multi-step verification
- **ErrorRecovery** → Pattern-matched error resolution from real traces
- **AgentSwarm** → Multi-agent coordination via transition matrices
- **CostOptimizer** → Automatic model routing based on task complexity
- **AgentConstitution** → Safety guardrails from analysis of real traces

## License

MIT

## Built With

- 210,000+ real agent traces from the Fable-5 dataset collection
- 87.7% planning rate behavioral signal
- 39.5% error recovery success rate
- 303 tool calls in a single session (Boeing 747 trace)
- 5 specialized micro-models (ShellWhisperer, ReasonCritic, etc.)

---

**Anvil: Forge your code. Verify it holds.**