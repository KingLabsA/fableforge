# AgentDev

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/) [![Tests](https://img.shields.io/badge/tests-0-yellow.svg)](tests/)


AI-powered development agent for VS Code with a verify-loop pattern for autonomous coding tasks.

## Features

- **Autonomous Task Execution** — Give AgentDev a task and it plans, executes, and verifies the result
- **Verify-Loop Pattern** — After each step, the agent verifies syntax, tests, and lint before proceeding
- **Automatic Recovery** — When verification fails, the agent attempts recovery through LLM-powered fixes
- **Multiple Providers** — Supports OpenAI, Anthropic, and local models (Ollama/llama.cpp)
- **Real-Time Panels** — Watch the plan, execution progress, and verification results in real time
- **Sidebar View** — Active tasks and history visible in the sidebar

## Installation

### From VSIX

```bash
npm install
npm run compile
npx vsce package
code --install-agent-dev-0.1.0.vsix
```

### From Source

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 in VS Code to launch the Extension Development Host

## Configuration

Open Settings → Extensions → AgentDev, or configure via `settings.json`:

| Setting | Default | Description |
|---------|---------|-------------|
| `agent-dev.provider` | `"openai"` | LLM provider: `openai`, `anthropic`, or `local` |
| `agent-dev.apiKey` | `""` | API key for cloud providers |
| `agent-dev.model` | `"gpt-4"` | Model identifier |
| `agent-dev.localEndpoint` | `"http://localhost:11434"` | Local inference endpoint (Ollama/llama.cpp) |
| `agent-dev.maxRetries` | `3` | Maximum verify-recover loop iterations |
| `agent-dev.verifyTests` | `true` | Run test verification after execution |
| `agent-dev.verifyLint` | `true` | Run lint verification after execution |
| `agent-dev.testCommand` | `"npm test"` | Shell command for running tests |
| `agent-dev.lintCommand` | `"npm run lint"` | Shell command for running lint |

## Usage

### Run a Task

`Cmd+Shift+P` → `AgentDev: Run Task`

Enter a natural-language description of what you want done. The agent will:

1. **Plan** — Break the task into concrete steps
2. **Execute** — Execute each step via the LLM
3. **Verify** — Run syntax checks, tests, and lint after each step
4. **Recover** — If verification fails, attempt to fix the code

### Plan Only

`Cmd+Shift+P` → `AgentDev: Plan Task`

Generate a plan without executing it. View the plan in the Plan panel.

### Execute a Plan

`Cmd+Shift+P` → `AgentDev: Execute Plan`

Execute a previously generated plan.

### Stop Agent

`Cmd+Shift+P` → `AgentDev: Stop Agent`

Stop the currently running agent.

### Configure Provider

`Cmd+Shift+P` → `AgentDev: Configure Provider`

Switch between OpenAI, Anthropic, and local providers interactively.

## Architecture

```
agent-dev/
├── src/
│   ├── extension.ts          # Extension entry point, commands, tree views
│   ├── agent.ts              # AgentController — plan, execute, verify, recover
│   ├── verify.ts             # VerifyPhase — syntax, test, and lint checks
│   ├── recover.ts            # RecoveryPhase — error classification and LLM recovery
│   ├── types.ts              # Shared types and configuration
│   ├── providers/
│   │   ├── api_provider.ts   # OpenAI/Anthropic API client
│   │   └── local_provider.ts # Ollama/llama.cpp local inference client
│   └── panels/
│       ├── plan_panel.ts     # Plan webview panel
│       ├── execution_panel.ts # Execution progress webview panel
│       └── verify_panel.ts   # Verification results webview panel
├── package.json
├── tsconfig.json
└── README.md
```

### Verify-Loop Pattern

The core loop:

```
plan(task) → execute(plan) → verify(result) → [pass] ✓
                                     ↓ [fail]
                              recover(error) → retry / modify / abort
```

Each step in the execution phase is verified. If verification fails, the RecoveryPhase classifies the error and decides whether to retry, apply an LLM-generated fix, skip, or abort.

## Local Models

### Ollama

```bash
# Install and run Ollama
ollama serve
ollama pull llama3

# Configure in VS Code
# Provider: local
# Endpoint: http://localhost:11434
# Model: llama3
```

### llama.cpp Server

```bash
# Start llama.cpp server
./server -m model.gguf --port 8080

# Configure in VS Code
# Provider: local
# Endpoint: http://localhost:8080
# Model: model
```

## Screenshots

### Plan Panel

The Plan view shows the task broken into steps, each with a status indicator (pending, running, completed, failed).

### Execution Panel

The Execution view shows real-time progress with a progress bar, step status, and live log output.

### Verification Panel

The Verification view shows syntax check results, test results, and lint results with pass/fail status and detailed output.

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
