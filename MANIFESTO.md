# The Anvil Manifesto

## Why This Exists

We analyzed 210,000+ real agent traces from the Fable-5 dataset collection. What we found was a behavioral DNA — patterns of planning, execution, verification, and recovery that make agents actually work.

**87.7% planning rate.** The best agents don't just type — they plan first.

**39.5% error recovery rate.** They hit errors and recover. Not by magic. By predictable, learnable patterns.

**303 tool calls in a single session.** The Boeing 747 trace proves agents need persistent runtime, not disposable chat turns.

**31 tools mapped into transition matrices.** Bash→Bash is 59%. Read→Edit is 22%. These aren't random. They're the grammar of effective coding.

## What We Built

We turned these behavioral patterns into **21 open-source projects** — not demos, not wrappers, not research papers. Working code.

**Anvil** is the flagship. A self-verified coding agent that **doesn't hope — it verifies**. Every change gets checked: syntax, tests, lint, imports. When verification fails, it reads the error, generates a fix, applies it, and re-verifies. Up to 3 times.

This isn't prompt engineering. This is **behavior engineering**.

## The Pattern

```
PLAN → EXECUTE → VERIFY → RECOVER
                       ↑         │
                       └─────────┘ (if verification fails)
```

Every other open agent does this:

```
PROMPT → GENERATE → HOPE IT WORKS
```

We don't hope. We verify.

## The Stack

| Layer | Project | What It Does |
|-------|---------|--------------|
| Flagship | **Anvil** | Self-verified coding agent |
| Frameworks | VerifyLoop | Plan→Execute→Verify→Recover loop |
| Frameworks | ErrorRecovery | Self-healing from 3,725 real errors |
| Frameworks | AgentSwarm | Multi-agent from trace transition matrices |
| Models | FableForge-14B | Fine-tuned on 210K traces |
| Models | ShellWhisperer | 1.5B edge agent, 50ms latency |
| Models | ReasonCritic | Verification model, 130 benchmark tasks |
| Infrastructure | TraceCompiler | Compile traces → LoRA skills |
| Infrastructure | AgentRuntime | Persistent agent daemon |
| Infrastructure | AgentTelemetry | Tokens, costs, errors dashboard |
| Tools | BenchAgent | HumanEval for tool-use, 107 tasks |
| Tools | AgentDev | VSCode extension with verification |
| Tools | TraceViz | Trace replay visualizer |
| Data | AgentSkills.org | npm for agent behaviors |
| Data | AgentCurriculum | 5-stage progressive training |
| Data | AgentFuzzer | Adversarial testing for agents |
| Meta | AgentConstitution | Safety guardrails from traces |
| Meta | CostOptimizer | Token cost reduction, 50-80% |
| Meta | AgentProfiler | Behavioral fingerprinting |
| Meta | TrajectoryDistiller | Trace→training data pipeline |
| Meta | Fable5-Dataset | HuggingFace dataset release |

## The Data

- **Glint-Research/Fable-5-traces**: 4,665 rows, 60 sessions, 31 tools, 87.7% planning, 39.5% recovery
- **armand0e/claude-fable-5-claude-code**: 63 sessions, 18,370 rows, full token counts
- **summerMC/v-Fable**: 100K rows, synthetic but distribution-preserving
- **summerMC/coding-excellence**: 100K rows, instruction/input/output
- **OpenCoven/fable-forge-10k**: 10K rows, 3 task types, complexity 0.35–1.0
- **victor/fable-5-boeing-747-trace**: 1,311 lines, 303 tool calls, 15-hour session

**234,346 total rows. ~145 unique sessions. ~35 unique tools.**

## How to Use

```bash
# Install Anvil
pip install anvil-agent

# Run the self-verified agent
anvil run "Add error handling to the auth module"

# Verify existing code
anvil verify src/

# Interactive chat
anvil chat

# Start as a persistent daemon
anvil daemon --port 8765

# Or use the unified FableForge CLI
pip install fableforge
ff run "fix the bug"
ff projects   # list all 21
ff status     # check what's installed
```

## The Bet

We're betting that **verification is the differentiator**.

Every agent can generate code. The question is: does it work? Does it pass tests? Is it clean? Did the agent check? Or did it just... send it?

Anvil checks. Not because we told it to check. Because it was **trained on 210,000 examples of real agents checking**. The verification behavior is baked into the model, not bolted onto the prompt.

**Other agents shape and ship. Anvil forges, verifies, and only then ships.**

## License

MIT. All 21 projects. The data, the models, the frameworks, the agent. Everything.

## The Name

**Anvil** — where metal gets shaped. Where it gets tested. Where you hammer it until it holds.

Every blacksmith knows: you don't just shape metal on the anvil. You **test** it. You strike it, check it, and if it's not right, you heat it again and hammer until it is.

That's what this agent does with code.

---

**FableForge** — Forge your code. Verify it holds.