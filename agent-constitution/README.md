# Agent Constitution

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/) [![Tests](https://img.shields.io/badge/tests-0-yellow.svg)](tests/)


Extract safety patterns from agent traces and enforce constitutional guardrails on agent outputs.

## Installation

```bash
pip install agent-constitution
```

## Quick Start

### Extract Safety Patterns

```bash
# Extract all patterns from a trace file
constitution extract trace.jsonl

# Extract only refusals
constitution extract trace.jsonl --category refusals

# Save results to file
constitution extract trace.jsonl -o patterns.json
```

### Check Output Against Rules

```bash
# Check text against all constitutional rules
constitution check "I can't help with that request"

# Check against specific rule levels
constitution check "some output text" --level must
```

### List All Rules

```bash
# List all 60 constitutional rules
constitution list

# Filter by level
constitution list --level must

# Filter by category
constitution list --category safety
```

## Programming API

```python
from agent_constitution import ExtractSafetyPatterns, ConstitutionalRules, GuardrailEngine

# Extract patterns
extractor = ExtractSafetyPatterns()
refusals = extractor.extract_refusals("trace.jsonl")
corrections = extractor.extract_self_corrections("trace.jsonl")
flagged = extractor.extract_flagged_content("trace.jsonl")

# Check output
engine = GuardrailEngine()
result = engine.check_output("some agent output text")
if not result.passed:
    for violation in result.violations:
        print(f"Violation: {violation.rule.id} - {violation.suggestion}")

# Wrap an agent
class MyAgent:
    def generate(self, prompt):
        return "response text"

agent = MyAgent()
safe_agent = engine.apply_to_agent(agent)
output = safe_agent.generate("hello")
```

## Rule Levels

- **MUST** (20 rules): Always enforced. Covers safety, privacy, integrity, security.
- **SHOULD** (20 rules): Best practices. Covers quality, transparency, robustness.
- **MAY NOT** (20 rules): Prohibited behaviors. Covers destruction, deception, excess, conscience.

## License

MIT

## Ecosystem

Part of the [FableForge](../) ecosystem — 21 open-source projects built from 210K real agent traces:

| Project | Description |
| --- | --- |
| **[Anvil](../anvil)** | Self-verified coding agent |
| **[VerifyLoop](../verifyloop)** | Plan→Execute→Verify→Recover framework |
| **[ErrorRecovery](../error-recovery)** | Self-healing middleware (3,725 error patterns) |
| **[FableForge-14B](../fableforge-14b)** | The fine-tuned 14B model (4-stage training) |
| **[ShellWhisperer](../shell-whisperer)** | 1.5B edge agent (phone/RPi, 50ms) |
| **[ReasonCritic](../reason-critic)** | Verification model (130 benchmark tasks) |
| **[TraceCompiler](../trace-compiler)** | Compile traces → LoRA skills |
| **[AgentRuntime](../agent-runtime)** | Persistent agent daemon (systemd for AI) |
| **[AgentSwarm](../agent-swarm)** | Multi-agent from real trace transitions |
| **[AgentTelemetry](../agent-telemetry)** | Datadog for agents (token tracking, costs) |
| **[BenchAgent](../bench-agent)** | HumanEval for tool-use (107 tasks) |
| **[AgentDev](../agent-dev)** | VSCode extension with verification |
| **[TraceViz](../trace-viz)** | Trace replay visualizer (Next.js) |
| **[AgentSkills](../agent-skills)** | npm for agent behaviors |
| **[AgentCurriculum](../agent-curriculum)** | 5-stage progressive training |
| **[AgentFuzzer](../agent-fuzzer)** | Adversarial testing for agents |
| **[AgentConstitution](../agent-constitution)** | Safety guardrails from traces |
| **[CostOptimizer](../cost-optimizer)** | Token cost reduction (50-80%) |
| **[AgentProfiler](../agent-profiler)** | Behavioral fingerprinting |
| **[TrajectoryDistiller](../trajectory-distiller)** | Trace→training data pipeline |
| **[Fable5-Dataset](../fable5-dataset)** | HuggingFace dataset release |
