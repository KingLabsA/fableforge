# Agent Profiler

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/) [![Tests](https://img.shields.io/badge/tests-0-yellow.svg)](tests/)


Profile and classify agent behavior patterns from traces using transition matrices and tool distributions.

## Installation

```bash
pip install agent-profiler
```

## Quick Start

### Profile a Session

```bash
# Profile and classify behavior
aprof profile trace.jsonl

# Save results to JSON
aprof profile trace.jsonl -o results.json
```

### Classify Behavior

```bash
aprof classify trace.jsonl
```

### Generate Visualizations

```bash
aprof visualize trace.jsonl --output profile_chart.png
```

## Programming API

```python
from agent_profiler import AgentProfiler, BehaviorClassifier, ProfileVisualizer

# Profile a session
profiler = AgentProfiler()
result = profiler.profile("trace.jsonl")
print(f"Category: {result.category} (confidence: {result.confidence:.1%})")
print(f"Tool distribution: {result.tool_distribution.tool_counts}")

# Classify directly
classifier = BehaviorClassifier()
category, confidence, scores = classifier.classify(
    edit_ratio=0.25, read_ratio=0.15, bash_ratio=0.30,
    error_rate=0.4, error_recovery_rate=0.35
)

# Generate visualizations
visualizer = ProfileVisualizer()
visualizer.generate_profile_chart(result, output="profile.png")
visualizer.generate_transition_heatmap("trace.jsonl", output="heatmap.png")
visualizer.generate_tool_distribution_pie("trace.jsonl", output="tools.png")
```

## Behavior Categories

| Category | Description | Key Indicators |
|----------|-------------|----------------|
| Debugging | Active debugging sessions | High Edit+Bash, many errors, recoveries |
| Building | Feature development | High Write+Bash, low Read |
| Exploring | Code investigation | High Read+Grep, low Edit |
| Lost | Confused/circular behavior | Circular transitions, high Read |
| Verifying | Change verification | Read after Edit, test runs |

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
