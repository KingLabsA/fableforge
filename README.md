<p align="center">
  <img src="https://img.shields.io/badge/FableForge-0.1.0-purple?style=for-the-badge&logo=fire&logoColor=white" alt="FableForge Version"/>
  <img src="https://img.shields.io/badge/python-3.10%2B-blue?style=for-the-badge" alt="Python"/>
  <img src="https://img.shields.io/badge/packages-20-orange?style=for-the-badge" alt="Packages"/>
  <img src="https://img.shields.io/badge/tests-865%2B-green?style=for-the-badge" alt="Tests"/>
  <img src="https://img.shields.io/badge/license-MIT-yellow?style=for-the-badge" alt="License"/>
</p>

<h1 align="center">🔥 FableForge — The Agent Ecosystem</h1>

<p align="center"><em>21 open-source projects. One verified agent stack.</em></p>

<p align="center">
  <a href="https://kinglabsa.github.io/fableforge/">🌐 Website</a> · 
  <a href="https://pypi.org/project/fableforge/">📦 PyPI</a> · 
  <a href="https://huggingface.co/fableforge-ai">🤗 HuggingFace</a> · 
  <a href="https://github.com/KingLabsA?q=fableforge">📂 All Repos</a>
</p>

---

**FableForge** is the meta-package that installs the entire FableForge agent ecosystem — 20 Python packages + 1 Node.js tool for building reliable, verifiable AI agents.

## Install Everything

```bash
pip install fableforge
```

This installs all 20 Python packages:

| Package | PyPI | Purpose |
|---------|------|---------|
| `verifyloop` | [🔗](https://pypi.org/project/verifyloop/) | Plan → Execute → Verify loop |
| `error-recovery` | [🔗](https://pypi.org/project/error-recovery/) | Failure classification & recovery |
| `fableforge-14b` | [🔗](https://pypi.org/project/fableforge-14b/) | FableForge-14B model integration |
| `reason-critic` | [🔗](https://pypi.org/project/reason-critic/) | ReasonCritic-7B verification model |
| `fableforge-agent-swarm` | [🔗](https://pypi.org/project/fableforge-agent-swarm/) | Multi-agent orchestration |
| `fableforge-shell-whisperer` | [🔗](https://pypi.org/project/fableforge-shell-whisperer/) | ShellWhisperer-1.5B shell model |
| `agent-constitution` | [🔗](https://pypi.org/project/agent-constitution/) | Safety guardrails |
| `fableforge-anvil-agent` | [🔗](https://pypi.org/project/fableforge-anvil-agent/) | 🔨 Flagship agent (Anvil) |
| `agent-curriculum` | [🔗](https://pypi.org/project/agent-curriculum/) | Learning progression |
| `agent-fuzzer` | [🔗](https://pypi.org/project/agent-fuzzer/) | Adversarial testing |
| `fableforge-agent-profiler` | [🔗](https://pypi.org/project/fableforge-agent-profiler/) | Performance profiling |
| `fableforge-agent-telemetry` | [🔗](https://pypi.org/project/fableforge-agent-telemetry/) | Observability & tracing |
| `fableforge-bench-agent` | [🔗](https://pypi.org/project/fableforge-bench-agent/) | Benchmarking framework |
| `fableforge-agent-runtime` | [🔗](https://pypi.org/project/fableforge-agent-runtime/) | Execution sandbox |
| `fableforge-agent-skills` | [🔗](https://pypi.org/project/fableforge-agent-skills/) | Tool definitions |
| `fableforge-cost-optimizer` | [🔗](https://pypi.org/project/fableforge-cost-optimizer/) | Token cost management |
| `fableforge-trajectory-distiller` | [🔗](https://pypi.org/project/fableforge-trajectory-distiller/) | Pattern extraction |
| `fableforge-trace-compiler` | [🔗](https://pypi.org/project/fableforge-trace-compiler/) | Trace-to-pipeline compiler |
| `fableforge` | [🔗](https://pypi.org/project/fableforge/) | Meta-package (this one) |
| `fable5-dataset` | [🔗](https://pypi.org/project/fable5-dataset/) | Training dataset |

## The Stack

```
                    ┌─────────────────┐
                    │     Anvil       │  ← Flagship Agent
                    │  (fableforge-   │
                    │  anvil-agent)   │
                    └────────┬────────┘
                             │
          ┌──────────────────┼──────────────────┐
          │                  │                  │
    ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │ VerifyLoop │    │ Agent Swarm │    │ ErrorRecovery│
    │ (verifyloop)│   │ (agent-swarm)│   │ (error-recovery)│
    └─────┬─────┘    └──────┬──────┘    └──────┬──────┘
          │                  │                  │
    ┌─────▼─────┐    ┌──────▼──────┐    ┌──────▼──────┐
    │ReasonCritic│    │ Agent       │    │ Cost        │
    │ (reason-   │    │ Runtime     │    │ Optimizer   │
    │  critic)   │    │ (agent-     │    │ (cost-      │
    └────────────┘    │  runtime)   │    │  optimizer) │
                      └─────────────┘    └─────────────┘
```

## Models

| Model | Size | Task | HuggingFace |
|-------|------|------|-------------|
| FableForge-14B | 14B | Code generation | [🔗](https://huggingface.co/fableforge-ai/FableForge-14B) |
| ReasonCritic-7B | 7B | Verification & critique | [🔗](https://huggingface.co/fableforge-ai/ReasonCritic-7B) |
| ShellWhisperer-1.5B | 1.5B | Shell/bash specialist | [🔗](https://huggingface.co/fableforge-ai/ShellWhisperer-1.5B) |
| FableForge (collection) | — | All models | [🔗](https://huggingface.co/fableforge-ai/FableForge) |

## Quick Start

```python
# Install everything
!pip install fableforge

# Or install just what you need
!pip install verifyloop error-recovery fableforge-anvil-agent
```

## Docker

```bash
docker pull ghcr.io/kinglabsa/anvil:0.2.0
```

## Testing

```bash
# Run all 865+ tests across the ecosystem
pytest tests/ -v
```

## License

MIT © [KingLabs](https://github.com/KingLabsA)
