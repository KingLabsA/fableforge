# AgentSwarm

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/) [![Tests](https://img.shields.io/badge/tests-54-green.svg)](tests/)


Orchestrate micro-agent swarms using **Markov transition matrices** derived from real Fable5 trace data.

## Overview

AgentSwarm models agent coordination as a Markov chain: each agent's next tool call is predicted by transition probabilities learned from real coding sessions. Instead of hardcoded orchestration logic, the swarm uses probabilistic handoff patterns that mirror how skilled developers switch between reading, editing, running commands, and verifying.

### Key Transition Probabilities (Fable5 Data)

| Transition | Probability | Interpretation |
|---|---|---|
| Bash → Bash | 0.59 | Agents loop on shell commands |
| Bash → Edit | 0.18 | Shell work leads to file edits |
| Read → Bash | 0.37 | Reading triggers command execution |
| Read → Edit | 0.22 | Reading precedes editing |
| Edit → Bash | 0.34 | Edits trigger verification |
| Edit → Read | 0.28 | Edits lead to re-reading |

## Architecture

```
┌─────────────────────────────────────────────┐
│            SwarmOrchestrator                │
│  ┌──────────┐  TransitionMatrix  ┌──────┐  │
│  │ Planner  │ ──────────────────→ │Reader│  │
│  └────┬─────┘                     └──┬───┘  │
│       │                              │      │
│       ▼                              ▼      │
│  ┌──────────┐     handoff()     ┌──────┐   │
│  │  Editor  │ ←──────────────── │Bash  │   │
│  └────┬─────┘                    └──┬───┘   │
│       │                             │       │
│       ▼                             │       │
│  ┌──────────┐                        │       │
│  │Verifier  │ ←──────────────────────┘       │
│  └──────────┘                                │
└─────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
pip install agent-swarm
```

For development:

```bash
git clone https://github.com/example/agent-swarm.git
cd agent-swarm
pip install -e ".[dev]"
```

### Run a Task

```bash
swarm run "Fix the authentication bug in auth.py"
```

### Check Status

```bash
swarm status
```

### Visualize the Swarm

```bash
swarm visualize
```

### Build Custom Transition Matrix

```bash
swarm build-matrix traces.jsonl -o my_matrix.json
```

## Programmatic Usage

### Basic Usage

```python
from agent_swarm import SwarmOrchestrator, TransitionMatrix

# Use the default matrix (derived from Fable5 data)
orchestrator = SwarmOrchestrator()

# Or load from trace data
tm = TransitionMatrix.from_traces("my_traces.jsonl")
orchestrator = SwarmOrchestrator(transition_matrix=tm)

# Run a task through the swarm
result = orchestrator.run("Implement user authentication")
print(result.summary())
print(f"Total handoffs: {result.total_handoffs}")
print(f"Final agent: {result.final_agent}")
```

### Spawn and Coordinate Agents

```python
from agent_swarm import SwarmOrchestrator

orchestrator = SwarmOrchestrator()

# Spawn individual agents
reader = orchestrator.spawn_agent("reader")
editor = orchestrator.spawn_agent("editor")

# Coordinate a task
task = orchestrator.coordinate("Fix the login bug")

# Predict the next agent
next_agent = orchestrator.predict_next_agent("reader", current_tool="read")
# → "editor" or "bash" (based on transition probabilities)
```

### Handoffs with Transition Data

```python
# Hand off between agents with context enrichment
handoff = orchestrator.handoff(
    from_agent="reader",
    to_agent="editor",
    context={"findings": "Auth bug is in token validation", "files": ["auth.py"]},
)

# The handoff record includes transition data
print(handoff.context["handoff_probability"])  # e.g., 0.35
print(handoff.context["handoff_pattern"])       # Tool call sequence
```

### Agent Execution

```python
from agent_swarm.agents import create_agent

# Create and execute with an agent
reader = create_agent("reader")
result = reader.execute("Find the authentication module")
print(result["plan"])              # Planned tool calls
print(result["recommended_handoff"])  # Next agent suggestion
```

## Transition Matrix API

### Predict Next Tool

```python
from agent_swarm import TransitionMatrix

tm = TransitionMatrix()

# Top-3 predictions after "read"
predictions = tm.next_tool("read", top_k=3)
# → [ToolCall(name='bash', confidence=0.37),
#    ToolCall(name='edit', confidence=0.22),
#    ToolCall(name='grep', confidence=0.20)]

# Get specific transition probability
prob = tm.get_transition_prob("bash", "bash")
# → 0.59
```

### Get Handoff Patterns

```python
# Get the tool-call sequence for a reader→editor handoff
pattern = tm.get_handoff_pattern("reader", "editor")
# → [ToolCall(name='read', confidence=0.92),
#    ToolCall(name='edit', confidence=0.88)]

# Get the probability of this handoff
prob = tm.get_handoff_probability("reader", "editor")
# → 0.35

# Get all handoff probabilities from a role
probs = tm.get_all_handoff_probabilities("planner")
# → {"reader": 0.25, "editor": 0.30, "bash": 0.15, ...}
```

### Build from Traces

```python
# Build from a JSONL trace file
tm = TransitionMatrix.from_traces("agent_traces.jsonl", min_occurrences=5)

# Save for later use
tm.to_json("my_matrix.json")

# Load later
tm = TransitionMatrix.from_json("my_matrix.json")
```

## Micro-Agents

| Agent | Role | Tools | Handoff Targets | Key Transition |
|-------|------|-------|-----------------|---------------|
| **ReaderAgent** | Explore & understand code | `read`, `grep`, `glob` | editor, bash, verifier, planner | Read→Edit=0.22 |
| **EditorAgent** | Write & modify code | `edit`, `write` | reader, bash, verifier, planner | Edit→Bash=0.34 |
| **BashAgent** | Execute commands | `bash` | reader, editor, verifier, planner | Bash→Bash=0.59 |
| **VerifierAgent** | Test & validate changes | `bash`, `read`, `grep` | reader, editor, bash, planner | Verify→Edit=0.25 |
| **PlannerAgent** | Plan & coordinate | `question`, `glob`, `read` | reader, editor, bash, verifier | Plan→Read=0.25 |

## Pydantic Models

The `models` module provides Pydantic v2 models for serialization and validation:

- **AgentConfig** — Configuration for spawning agents (role, tools, prompt, model settings)
- **SwarmResult** — Result of swarm execution with handoff history and output
- **HandoffEvent** — Record of an agent handoff with probability and pattern
- **AgentMessage** — Message in the agent conversation

## Testing

```bash
# Run all tests
pytest tests/

# Run with verbose output
pytest tests/ -v

# Run specific test class
pytest tests/test_orchestrator.py::TestTransitionMatrix -v
```

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
