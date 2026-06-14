# Anvil Architecture Guide

> Deep dive into the architecture of Anvil — the Plan→Execute→Verify→Recover agent framework.

---

## System Overview

Anvil implements a four-phase autonomous agent loop that transforms natural language tasks into verified, production-ready code changes. The system is designed around the principle that **execution without verification is unreliable** and **verification without recovery is incomplete**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        FableForge Ecosystem                      │
│  ┌──────────┐ ┌──────────┐ ┌───────────┐ ┌───────────────────┐ │
│  │ Verify   │ │ Error    │ │ Agent     │ │ Cost              │ │
│  │ Loop     │ │ Recovery │ │ Swarm     │ │ Optimizer         │ │
│  └────┬─────┘ └────┬─────┘ └─────┬─────┘ └────────┬──────────┘ │
│       │             │             │                 │            │
│       └─────────┬───┴─────────┬───┘                 │            │
│                 │             │                     │            │
│  ┌──────────────▼─────────────▼─────────────────────▼──────────┐│
│  │                      Bridge Layer                             ││
│  │  VerifyLoopBridge  ErrorRecoveryBridge                       ││
│  │  AgentSwarmBridge  CostOptimizerBridge                       ││
│  └──────────────────────────┬──────────────────────────────────┘│
│                              │                                    │
│  ┌──────────────────────────▼──────────────────────────────────┐│
│  │                      Anvil Engine                             ││
│  │                                                              ││
│  │   ┌─────────┐    ┌─────────┐    ┌──────────┐    ┌────────┐  ││
│  │   │  Plan   │───▶│Execute │───▶│  Verify  │───▶│Recover │  ││
│  │   │  Phase  │    │  Phase  │    │  Phase   │    │ Phase  │  ││
│  │   └────┬────┘    └────┬────┘    └────┬─────┘    └───┬────┘  ││
│  │        │              │              │               │        ││
│  │        │         ┌────▼────┐        │          ┌────▼────┐   ││
│  │        │         │  Tool   │        │          │  Model  │   ││
│  │        │         │Executor │        │          │ Backend │   ││
│  │        │         └────┬────┘        │          └────┬────┘   ││
│  │        │              │              │               │        ││
│  │        │    ┌─────────▼──────────┐  │          ┌────▼────┐   ││
│  │        │    │    Tool Registry     │  │          │ History │   ││
│  │        │    │ Bash│Read│Write     │  │          │ Manager │   ││
│  │        │    │ Search│Web│Python   │  │          └─────────┘   ││
│  │        │    │ Patch               │  │                         ││
│  │        │    └─────────────────────┘  │                         ││
│  │        │                             │                         ││
│  │        └────────── Loop ◄────────────┘                         ││
│  │               (if not converged)                               ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │                       Daemon Server                            ││
│  │  HTTP API │ SSE Events │ Session Mgmt │ Auth │ CORS          ││
│  └──────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## The Plan→Execute→Verify→Recover Loop

The core innovation of Anvil is its four-phase loop. Most agent frameworks stop at Execute. Anvil adds two critical phases that make the output reliable enough for production use.

### Phase 1: Plan

The Plan phase decomposes a natural language task into a structured execution plan. It uses the configured model backend to analyze the task, the workspace context, and any provided hints to produce a sequence of concrete steps.

**What happens:**
1. The task string is augmented with workspace context (file tree, git status, recent changes).
2. The model generates a `PlanResult` containing ordered `PlanStep` objects.
3. Each step specifies which tools it expects to use and a success criterion.
4. Risk assessment identifies potential failure modes before execution begins.

```python
# Internally, the Plan phase:
context = gather_context(workspace)  # file tree, git diff, README
plan_prompt = build_plan_prompt(task, context, available_tools)
plan_result = model.generate(plan_prompt)
# plan_result.steps = [
#   PlanStep(id=1, description="Read auth.py", tools=["file_read"], criterion="File loaded"),
#   PlanStep(id=2, description="Add rate limiter", tools=["file_write"], criterion="Code added"),
#   PlanStep(id=3, description="Run tests", tools=["bash"], criterion="All tests pass"),
# ]
```

**Key design decisions:**
- Planning is **model-agnostic** — any backend that can follow structured prompts works.
- Plans include **estimated iteration counts** so the engine can detect runaway loops.
- Risk assessment enables **preemptive recovery** (e.g., backing up files before risky changes).

### Phase 2: Execute

The Execute phase carries out each step in the plan using the ToolExecutor. This is where actual file I/O, command execution, and code generation happen.

**What happens:**
1. The engine iterates through plan steps sequentially.
2. For each step, it constructs tool calls and dispatches them through the ToolExecutor.
3. Results are collected and fed back into the conversation history.
4. After each step, the engine evaluates whether the step's success criterion was met.

```python
for step in plan.steps:
    tool_call = select_tool_for_step(step, available_tools)
    result = tool_executor.execute(tool_call.name, **tool_call.kwargs)
    history.append(Message(role="tool", content=result.output, name=tool_call.name))
    
    if not result.success:
        if step.is_critical:
            break  # Halt execution, move to Recovery
        else:
            continue  # Non-critical failure, proceed
```

**Tool sandboxing:**
- File tools are restricted to paths within the configured `workspace` and `sandbox_dirs`.
- Bash commands are filtered through a blocklist (e.g., `rm -rf /`, `mkfs`).
- Network access (WebFetchTool) respects domain allowlists when configured.
- PythonTool runs code in an isolated namespace with restricted builtins.

### Phase 3: Verify

The Verify phase runs a configurable pipeline of checkers against the execution result. This is what separates Anvil from fire-and-forget agents.

**What happens:**
1. The VerifyPipeline collects all file changes made during Execute.
2. Each registered checker runs independently (some in parallel where safe).
3. Results are aggregated into a `VerifyReport` with an overall score (0.0–1.0).
4. If the score is below the convergence threshold, the loop continues with a new Plan phase that incorporates the verification feedback.

```
Verify Pipeline:
  ┌─────────┐  ┌─────┐  ┌──────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐
  │ Syntax  │  │Tests│  │ Lint │  │TypeCheck  │  │ DiffReview │  │Security  │
  │ Checker │  │Chk  │  │ Chk  │  │  Checker   │  │  (LLM)     │  │ Checker  │
  └────┬────┘  └──┬──┘  └──┬───┘  └─────┬─────┘  └─────┬──────┘  └─────┬────┘
       │          │         │              │               │              │
       └──────────┴─────────┴──────────────┴───────────────┴──────────────┘
                                        │
                                  ┌─────▼─────┐
                                  │  Aggregate  │
                                  │  & Score    │
                                  └─────┬──────┘
                                        │
                              ┌─────────▼──────────┐
                              │  VerifyReport       │
                              │  score: 0.0 - 1.0  │
                              │  passed: bool       │
                              └────────────────────┘
```

**Strictness levels:**

| Level | Checkers Run | Threshold |
|-------|-------------|-----------|
| `relaxed` | syntax, tests | 0.6 |
| `balanced` | syntax, tests, lint, diff_review | 0.8 |
| `strict` | all 7 checkers | 0.95 |

**Custom checkers** can be added via `VerifyPipeline.add_checker()`. Each checker is a class implementing:

```python
class BaseChecker(ABC):
    name: str
    
    @abstractmethod
    def check(self, result: EngineResult, workspace: Path) -> list[CheckResult]:
        ...
```

### Phase 4: Recover

The Recover phase activates when verification fails or when execution encounters errors. It's the safety net that makes Anvil reliable in production.

**What happens:**
1. The error context (or verification failure) is gathered.
2. A recovery plan is generated — this may be a simple retry, a rewrite of the failing code, or a cascade through multiple recovery strategies.
3. The recovery is executed and the result is re-verified.
4. If recovery succeeds, the loop continues. If it exhausts `max_retries`, the task fails gracefully.

**Recovery strategies:**

| Strategy | When Used | Behavior |
|----------|-----------|----------|
| `retry` | Transient errors (network, timeout) | Re-execute the same step with backoff. |
| `rewrite` | Logic errors, test failures | Re-plan the failing step with error context. |
| `cascade` | Persistent failures | Try retry → rewrite → escalate to stronger model. |

```
Recovery Flow:
  
  Error Detected
       │
       ▼
  ┌──────────┐  Success  ┌──────────┐
  │  Retry   │─────────▶│ Verify  │─────────▶ Done ✓
  │ (1-3x)  │          └──────────┘
  └────┬─────┘
       │ Failed
       ▼
  ┌──────────┐  Success  ┌──────────┐
  │  Rewrite │─────────▶│ Verify  │─────────▶ Done ✓
  │ (replan) │          └──────────┘
  └────┬─────┘
       │ Failed
       ▼
  ┌──────────┐  Success  ┌──────────┐
  │ Escalate │─────────▶│ Verify  │─────────▶ Done ✓
  │ (stronger│          └──────────┘
  │  model)  │
  └────┬─────┘
       │ Failed
       ▼
  ┌──────────┐
  │   Fail   │ ──▶ EngineResult(success=False, error=...)
  └──────────┘
```

---

## Tool System Architecture

Anvil's tool system is built around a **registry pattern** with sandboxing, validation, and parallel execution.

### Tool Registry

```python
class ToolRegistry:
    """Central registry for all tools."""
    
    def __init__(self):
        self._tools: dict[str, BaseTool] = {}
    
    def register(self, tool: BaseTool) -> None:
        """Register a tool by name."""
        self._tools[tool.name] = tool
    
    def get(self, name: str) -> BaseTool:
        """Retrieve a tool by name."""
        return self._tools[name]
    
    def list_tools(self) -> list[ToolInfo]:
        """List all registered tools with metadata."""
        return [t.info() for t in self._tools.values()]
```

**Built-in tools (7):**

| Tool | Purpose | Sandboxed |
|------|---------|-----------|
| `BashTool` | Shell command execution | Yes — blocklist + path restrictions |
| `FileReadTool` | Read file contents | Yes — path must be within workspace |
| `FileWriteTool` | Write/append to files | Yes — path must be within workspace |
| `FileSearchTool` | Search files by name or content | Yes — search rooted at workspace |
| `WebFetchTool` | Fetch URLs | Partially — domain allowlist |
| `PythonTool` | Execute Python code in isolated namespace | Yes — restricted builtins + sandbox |
| `PatchTool` | Apply unified diffs | Yes — target must be within workspace |

### Tool Execution Flow

```
Engine calls tool
       │
       ▼
┌─────────────────┐
│  Validate Call   │ ◄── Schema validation, sandbox checks
└────────┬────────┘
         │ Valid
         ▼
┌─────────────────┐
│  Check Timeout   │ ◄── Set per-tool timeout
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Execute Tool   │ ◄── Run in subprocess (Bash) or
└────────┬────────┘     isolated namespace (Python)
         │
         ▼
┌─────────────────┐
│  Capture Output  │ ◄── stdout, stderr, exit code
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Return Result   │ ◄── ToolResult(output, success, error, duration)
└─────────────────┘
```

### Batch Execution

The `ToolExecutor.execute_batch()` method runs independent tool calls in parallel using a thread pool. This dramatically speeds up tasks that need to read multiple files or run multiple queries.

```python
results = executor.execute_batch([
    {"tool": "file_read", "kwargs": {"path": "src/auth.py"}},
    {"tool": "file_read", "kwargs": {"path": "src/models.py"}},
    {"tool": "file_read", "kwargs": {"path": "src/routes.py"}},
])
# All three files read in parallel
```

---

## Model Backend Architecture

Anvil supports multiple model backends through a common interface, enabling seamless switching between local models, OpenAI, and Anthropic.

### Backend Abstraction

```
┌──────────────────────────────────────────────┐
│              AnvilEngine                      │
│                                              │
│  ┌────────────┐    ┌────────────────────┐   │
│  │  Plan Phase │────│   Model Router     │   │
│  └────────────┘    │                    │   │
│  ┌────────────┐    │  ┌──────────────┐   │   │
│  │ Exec Phase  │────│  │ LocalModel   │   │   │
│  └────────────┘    │  ├──────────────┤   │   │
│  ┌────────────┐    │  │ OpenAIModel  │   │   │
│  │Verify Phase │────│  ├──────────────┤   │   │
│  └────────────┘    │  │AnthropicModel│   │   │
│  ┌────────────┐    │  ├──────────────┤   │   │
│  │Recover Phase│────│  │Custom Model  │   │   │
│  └────────────┘    │  └──────────────┘   │   │
│                    └────────────────────┘   │
└──────────────────────────────────────────────┘
```

### Backend Selection

The backend is selected at engine initialization:

```python
# Quick-select via string
engine = AnvilEngine(model_backend="local")        # Ollama on localhost
engine = AnvilEngine(model_backend="openai")       # OpenAI API
engine = AnvilEngine(model_backend="anthropic")    # Anthropic API

# Full configuration
engine = AnvilEngine(config=AnvilConfig(
    model_backend="openai",
    model_name="gpt-4o",
    api_key_env="OPENAI_API_KEY",
))
```

### Cost-Aware Routing

When the CostOptimizerBridge is active, the model router can dynamically select the cheapest adequate model for each phase:

| Phase | Default Model | Cost-Optimized Strategy |
|-------|--------------|------------------------|
| Plan | Full capability | Use local model for simple tasks, cloud for complex |
| Execute | Full capability | Use task-appropriate model |
| Verify | Compact/fast | Prefer local model for syntax/lint, cloud for diff_review |
| Recover | Strongest available | Escalate to most capable model on failure |

### Streaming Support

All backends support streaming via `run_stream()`:

```python
async for event in engine.run_stream(task):
    match event.phase:
        case "plan":
            print(f"[PLAN] {event.content}")
        case "execute":
            print(f"[{event.tool}] {event.content[:80]}")
        case "verify":
            status = "✓" if event.result else "✗"
            print(f"  {status} {event.check_name}")
        case "recover":
            print(f"[RECOVER] Strategy: {event.content}")
```

---

## Integration Architecture

Anvil connects to the broader FableForge ecosystem through four bridge classes. Each bridge encapsulates the protocol and data format for communicating with its respective project.

### Bridge Overview

```
┌─────────────────────────────────────────────────────────┐
│                    FableForge Ecosystem                    │
│                                                           │
│  ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────┐│
│  │verify-loop  │ │error-      │ │agent-swarm │ │cost-   ││
│  │             │ │recovery    │ │            │ │optimizer││
│  │ Iterative   │ │ Intelligent│ │ Multi-agent│ │ Model  ││
│  │ verification│ │ error      │ │ delegation │ │routing ││
│  │ loops       │ │ healing    │ │ & routing  │ │by cost ││
│  └──────┬─────┘ └──────┬─────┘ └──────┬─────┘ └───┬────┘│
│         │               │              │            │     │
│  ┌──────▼───────────────▼──────────────▼────────────▼──┐│
│  │              Integration Bridge Layer                  ││
│  │                                                       ││
│  │  VerifyLoopBridge   ErrorRecoveryBridge               ││
│  │  AgentSwarmBridge   CostOptimizerBridge                ││
│  └──────────────────────┬───────────────────────────────┘│
│                         │                                 │
│  ┌──────────────────────▼───────────────────────────────┐│
│  │                   Anvil Engine                         ││
│  └──────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────┘
```

### VerifyLoopBridge

**Connected project:** `verify-loop`

The VerifyLoopBridge wraps the iterative verification pattern: plan → execute → verify → fix → re-verify until convergence. It manages the convergence check and feeds verification results back into the engine as new planning context.

```python
bridge = VerifyLoopBridge(max_rounds=5, convergence_threshold=0.95)
result = await bridge.run("Add input validation to handlers", engine=engine)
# Internally:
# Round 1: engine.run() → verify score 0.7 → feed errors back
# Round 2: engine.run(with_errors) → verify score 0.85 → feed errors back
# Round 3: engine.run(with_errors) → verify score 0.97 → CONVERGED
```

**Data flow:**
1. Receives `EngineResult` and `VerifyReport` from engine.
2. If `score < convergence_threshold`, extracts checker failures as new context.
3. Feeds context back to engine for a new Plan→Execute→Verify cycle.
4. Repeats until convergence or `max_rounds` is exhausted.

### ErrorRecoveryBridge

**Connected project:** `error-recovery`

The ErrorRecoveryBridge provides intelligent error healing. Instead of simple retries, it classifies errors and applies targeted recovery strategies.

**Error classification hierarchy:**

```
Error
├── TransientError          → retry with backoff
│   ├── NetworkError
│   ├── TimeoutError
│   └── RateLimitError
├── LogicError              → rewrite the failing step
│   ├── AssertionError
│   ├── TestFailureError
│   └── TypeMismatchError
├── SandboxViolation       → rewrite with path constraints
└── UnknownError           → cascade (retry → rewrite → escalate)
```

**Cascade strategy:**
1. **Retry**: Same plan, same model, with exponential backoff (1s, 2s, 4s).
2. **Rewrite**: Generate a new plan incorporating the error context.
3. **Escalate**: Switch to a stronger model (e.g., local → cloud) for the recovery attempt.

### AgentSwarmBridge

**Connected project:** `agent-swarm`

The AgentSwarmBridge enables multi-agent collaboration by delegating subtasks to specialized agents.

**Agent roles:**

| Role | Specialization | Use Case |
|------|---------------|----------|
| `coder` | Code generation and editing | Primary implementation tasks |
| `reviewer` | Code review and quality | Verifying changes before commit |
| `planner` | Task decomposition | Complex multi-step tasks |
| `tester` | Test generation and fixing | Ensuring test coverage |
| `architect` | System design | Large structural changes |

**Routing strategies:**

| Strategy | Description |
|----------|-------------|
| `auto` | Engine analyzes the task and selects the best agent for each subtask. |
| `round_robin` | Tasks are distributed evenly across agents. |
| `manual` | Caller specifies which agent handles which subtask. |

```python
bridge = AgentSwarmBridge(agents=["coder", "reviewer", "tester"])
result = await bridge.delegate(
    task="Implement user authentication with tests",
    engine=engine,
)
# Internally:
# 1. planner decomposes task into: [implement auth, write tests, review code]
# 2. coder handles "implement auth"
# 3. tester handles "write tests"
# 4. reviewer handles "review code"
# 5. Results are aggregated and verified
```

### CostOptimizerBridge

**Connected project:** `cost-optimizer`

The CostOptimizerBridge transparently routes model calls to the cheapest adequate backend based on task complexity.

**Routing strategies:**

| Strategy | Behavior |
|----------|----------|
| `cheapest` | Always use the cheapest model that can handle the task. |
| `best_value` | Balance cost and quality — use local for simple tasks, cloud for complex. |
| `quality_first` | Always use the best model regardless of cost. |

**Complexity classification:**
1. The model router classifies each prompt as `simple`, `medium`, or `complex`.
2. Based on strategy and classification, it selects the appropriate backend.
3. Token costs are tracked and deducted from the budget.

```
Task complexity: simple
  → Local model (fableforge-14b via Ollama)
  → Cost: ~$0.0001

Task complexity: medium  
  → Cloud model (gpt-4o)
  → Cost: ~$0.01

Task complexity: complex
  → Strongest model (claude-sonnet-4-20250514)
  → Cost: ~$0.03

With budget_usd=1.0:
  After 50 simple + 20 medium + 5 complex tasks: $0.005 + $0.20 + $0.15 = $0.355
  Remaining budget: $0.645
```

---

## Daemon Mode and HTTP API

Anvil can run as a persistent HTTP server using the `DaemonServer`, enabling integration with web apps, CI/CD pipelines, and other services.

### Architecture

```
┌──────────────┐     HTTP/SSE     ┌──────────────────┐
│  Client      │ ◀──────────────▶ │  DaemonServer     │
│  (curl, SDK) │                  │  (FastAPI/UVicorn)│
└──────────────┘                  └────────┬─────────┘
                                           │
                                           │ Internal
                                           ▼
                                  ┌──────────────────┐
                                  │  AnvilEngine     │
                                  │  (single instance)│
                                  └──────────────────┘
```

### Task Lifecycle

1. **Submit**: Client POSTs a task to `/v1/tasks`.
2. **Queue**: Task is enqueued for the engine.
3. **Stream**: Client connects to `/v1/tasks/{id}/stream` for real-time updates via SSE.
4. **Poll**: Alternatively, client GETs `/v1/tasks/{id}` for status.
5. **Complete**: Result is stored and returned.

### Session Management

The daemon maintains session state across requests:
- Sessions persist conversation history in SQLite (configurable).
- Clients can resume interrupted tasks via session IDs.
- Old sessions are cleaned up automatically (configurable TTL).

---

## Session Management and History

Anvil's session system provides persistence across runs and crash recovery.

### History Backends

| Backend | Storage | Use Case |
|---------|---------|----------|
| `sqlite` | SQLite database file | Production, daemon mode |
| `json` | JSON files per session | Debugging, manual inspection |
| `memory` | In-memory dict | Testing, ephemeral runs |

```python
# SQLite (default) — persistent, crash-safe
config = AnvilConfig(history_backend="sqlite", history_path="~/.anvil/history.db")

# JSON — human-readable, easy to inspect
config = AnvilConfig(history_backend="json", history_path="./sessions/")

# Memory — no persistence, fastest
config = AnvilConfig(history_backend="memory")
```

### Session Lifecycle

```
Create Session (session_id auto-generated)
       │
       ▼
┌──────────────┐
│ Plan Phase   │ ◄── Conversation history starts here
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Execute Phase│ ── Each tool call appended to history
└──────┬───────┘
       │
       ▼
┌──────────────┐
│ Verify Phase  │ ── Verification results appended
└──────┬───────┘
       │
       ▼
┌──────────────┐
│Recover Phase │ ── Recovery attempts appended (if needed)
└──────┬───────┘
       │
       ▼
   Session Complete
   (history persisted for resume)
```

### Multi-turn Conversations

Sessions enable multi-turn interactions where context from previous runs is preserved:

```python
# First turn
result1 = engine.run("Add a User model to models.py", session_id="sess_abc123")

# Second turn — engine remembers previous context
result2 = engine.run("Now add CRUD endpoints for the User model", session_id="sess_abc123")

# Resume after interruption
result3 = engine.resume("sess_abc123")
```

---

## Configuration System

Anvil's configuration is layered: defaults < config file < environment variables < constructor params.

### Priority Order (highest wins)

1. **Constructor parameters** — `AnvilEngine(model_backend="openai")`
2. **Environment variables** — `ANVIL_MODEL_BACKEND=openai`
3. **Config file** — `anvil.config.yaml`
4. **Defaults** — Built-in sensible defaults

### Config File Format

```yaml
# anvil.config.yaml
model:
  backend: openai
  name: gpt-4o
  api_key_env: OPENAI_API_KEY
  temperature: 0.7
  max_tokens: 4096

engine:
  max_iterations: 15
  max_retries: 3
  verify: true
  sandbox: true

verify:
  strictness: balanced
  checkers:
    - syntax
    - tests
    - lint
    - diff_review

daemon:
  host: 127.0.0.1
  port: 8420
  cors: true

history:
  backend: sqlite
  path: ~/.anvil/history.db

cost:
  limit_usd: 1.0
  warn_at_usd: 0.5
```

### Environment Variables

All config options can be set via environment variables with the `ANVIL_` prefix:

```bash
export ANVIL_MODEL_BACKEND=openai
export ANVIL_MODEL_NAME=gpt-4o
export ANVIL_MAX_ITERATIONS=20
export ANVIL_VERIFY=true
export ANVIL_SANDBOX=true
export ANVIL_COST_LIMIT_USD=1.0
```

---

## Security Model

Anvil's security model is built around the principle of **least privilege**: by default, the agent can only do what's explicitly allowed.

### Sandboxing

**Path sandboxing:**
- File tools (read, write, search, patch) are restricted to `workspace` and `sandbox_dirs`.
- Any path traversal attempt (`../../etc/passwd`) is rejected.
- Symlinks are resolved before checking to prevent escape via symlinks.

```python
# Safe: workspace is /projects/myapp
engine = AnvilEngine(workspace="/projects/myapp")
# engine can read/write: /projects/myapp/src/auth.py ✓
# engine CANNOT read/write: /etc/passwd ✗
# engine CANNOT read/write: /projects/otherapp/data.json ✗ (outside sandbox)
```

**Command sandboxing:**
- BashTool checks against a blocklist of dangerous commands.
- Patterns like `rm -rf /`, `mkfs`, `dd if=/dev/zero`, `chmod 777 /` are blocked.
- Additional patterns can be added via configuration.

```python
# Blocked by default:
# rm -rf /
# mkfs.ext4 /dev/sda1
# dd if=/dev/zero of=/dev/sda
# chmod 777 /
# curl ... | bash
# wget ... | sh
```

**Python sandboxing:**
- PythonTool runs in a restricted namespace with limited builtins.
- Imports of `os`, `subprocess`, `socket`, `sys` are blocked by default.
- The restriction list is configurable.

### API Key Management

- API keys are **never** stored in config files or code.
- Keys are read from environment variables referenced by name (`api_key_env`).
- The daemon supports Bearer token authentication for its own API.
- Keys can be rotated without restart (environment variable re-read on each call).

### Audit Logging

All tool calls, model requests, and session changes are logged:

```python
# Enable audit logging
config = AnvilConfig(
    audit_log="~/.anvil/audit.log",  # Log file path
    audit_format="json",              # "json" or "text"
)
```

Log entries include:
- Timestamp
- Task description
- Tool calls made (with parameters and outputs)
- Model requests (with token counts)
- Verification results
- Any errors encountered

---

## Performance Considerations

### Streaming

For real-time UIs, use `run_stream()` instead of `run()`. Streaming reduces perceived latency by delivering results incrementally.

### Batch Execution

When reading multiple files or making independent tool calls, use `execute_batch()` to parallelize:

```python
# Sequential (slow):
for path in files:
    executor.execute("file_read", path=path)

# Parallel (fast):
executor.execute_batch([{"tool": "file_read", "kwargs": {"path": p}} for p in files])
```

### Model Caching

LocalModel caches model loading between calls. For Ollama backends, models stay warm in memory after the first request, reducing latency from seconds to milliseconds.

### History Compression

For long sessions, Anvil automatically compresses older history entries to reduce token usage:

```python
config = AnvilConfig(
    history_compression=True,       # Enable compression
    history_max_tokens=8000,        # Maximum tokens to keep uncompressed
    history_compression_model="local",  # Use local model for summarization
)
```
