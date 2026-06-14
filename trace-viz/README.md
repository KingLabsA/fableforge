# TraceViz

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE) [![Python 3.10+](https://img.shields.io/badge/python-3.10%2B-blue.svg)](https://www.python.org/downloads/) [![Tests](https://img.shields.io/badge/tests-0-yellow.svg)](tests/)

Replay agent traces like a video. Step through tool calls, see reasoning, visualize transitions.

## Features

- **Step-by-Step Replay** — Play, pause, step forward/backward through agent traces at adjustable speeds (0.5×–4×)
- **Reasoning Visibility** — Collapsible sections for planning, execution, and verification reasoning
- **Transition Graphs** — D3 Markov transition graphs showing tool-to-tool call probabilities
- **Diff Viewer** — Side-by-side diffs for Edit and Write operations
- **Token Analytics** — Per-step token charts, cumulative usage, and cost estimation
- **Multi-Format** — Auto-detects and parses Glint, Armand0e, and V-Fable JSONL trace formats
- **Compare Mode** — Side-by-side comparison of two traces with synchronized scrolling

## Quick Start

```bash
cd /tmp/fableforge/trace-viz
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Loading Traces

### Drag & Drop

Drag any `.jsonl` trace file onto the upload area on the home page. TraceViz auto-detects the format.

### Demo Traces

Three demo traces are embedded for immediate exploration:

| Demo | Description | Steps | Tools |
|------|-------------|-------|-------|
| Refactor Auth Module | Session → JWT migration | 13 | Read, Edit, Write, Bash, Grep |
| Fix Memory Leak | WebSocket handler leak investigation | 8 | Read, Grep, Bash, Edit |
| Add Redis Caching | GET caching with invalidation | 13 | Read, Write, Edit, Bash, Grep |

### Supported Formats

#### Glint Format

```jsonl
{"type": "session_start", "title": "My Trace", "timestamp": 1700000000}
{"type": "user_message", "content": "Refactor auth", "timestamp": 1700000001}
{"type": "assistant_message", "content": "I'll analyze...", "reasoning": "First I need...", "usage": {"input_tokens": 850, "output_tokens": 120}}
{"type": "tool_call", "name": "Read", "input": {"file_path": "src/auth.ts"}, "timestamp": 1700000002}
{"type": "tool_result", "tool_name": "Read", "output": "file contents...", "timestamp": 1700000003}
```

#### Armand0e Format

```jsonl
{"event": "message", "sender": "user", "text": "Fix the bug", "ts": 1700000000}
{"event": "message", "sender": "assistant", "text": "Looking into it", "thinking": "The issue is...", "ts": 1700000001}
{"event": "tool_use", "tool": "Read", "args": {"file_path": "src/bug.ts"}, "ts": 1700000002}
{"event": "tool_result", "tool_name": "Read", "result": "file contents", "ts": 1700000003}
```

#### V-Fable Format

```jsonl
{"kind": "session", "title": "My Trace"}
{"kind": "prompt", "text": "Add caching", "t": 1700000000}
{"kind": "response", "text": "I'll add Redis.", "chain_of_thought": "Need to...", "tokens_in": 1100, "tokens_out": 180}
{"kind": "tool_invoke", "tool": "Write", "args": {"file_path": "src/cache.ts"}, "t": 1700000001}
{"kind": "tool_return", "tool": "Write", "value": "Created file", "t": 1700000002}
```

## Trace Viewer

The trace viewer has four panels:

### Left Sidebar — Step List
- Color-coded by role (user, assistant, tool, error)
- Duration indicators per step
- Click to jump to any step

### Center — Step Detail
- **ReasoningView**: Shows the current step with role-appropriate styling
  - User input in cyan
  - Assistant responses in purple
  - Tool calls with input/output panels
  - Collapsible reasoning sections with copy buttons
- **DiffViewer**: Shows before/after for Edit and Write operations

### Right Sidebar — Metadata
- **Info tab**: Current step details (role, tool, tokens, duration)
- **Tools tab**: Tool usage summary with counts and timing
- **Transitions tab**: Raw transition counts between steps

### Bottom — Playback Controls
- Play/Pause with auto-advance
- Step forward/backward
- Speed control (0.5×, 1×, 2×, 4×)
- Reset to beginning

## Transition Graph

The Markov transition graph shows:

- **Nodes** = tools and roles (Read, Edit, Bash, user, assistant, etc.)
- **Edges** = transition probabilities between steps
- Node size reflects call frequency
- Edge thickness reflects probability
- Hover a node to highlight its connections
- Toggle node visibility with filter buttons
- Drag nodes to rearrange the layout
- Probability labels on edges

## Compare Mode

Navigate to `/compare` to load two traces side by side with synchronized scrolling.

## Architecture

```
src/
├── app/
│   ├── layout.tsx          # Root layout with dark theme
│   ├── page.tsx            # Landing page with upload & demos
│   ├── globals.css         # Global styles & Tailwind
│   ├── trace/[id]/
│   │   └── page.tsx        # Main trace viewer
│   └── compare/
│       └── page.tsx        # Side-by-side compare
├── lib/
│   ├── trace_parser.ts     # Multi-format JSONL parser
│   └── playback.ts         # Playback controller class
├── components/
│   ├── TraceTimeline.tsx   # Horizontal step timeline
│   ├── ReasoningView.tsx   # Step content with collapsible sections
│   ├── TransitionGraph.tsx # D3 Markov graph
│   ├── DiffViewer.tsx      # Side-by-side code diff
│   └── TokenCounter.tsx    # Token usage visualization
└── data/
    └── sample_traces.ts    # 3 embedded demo traces
```

## Tech Stack

- **Next.js 14** — App Router with TypeScript
- **Tailwind CSS** — Custom dark theme
- **Framer Motion** — Smooth step transitions
- **D3.js** — Force-directed transition graphs
- **Lucide React** — Icons

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
