# Anvil API Reference

> Complete API reference for the Anvil agent framework — the execution engine of the FableForge ecosystem.

**Version:** 2.4.0  
**Python:** 3.10+  
**License:** Apache 2.0

---

## Table of Contents

- [Engine](#engine)
  - [AnvilEngine](#anvilengine)
  - [EngineResult](#engineresult)
  - [AnvilConfig](#anvilconfig)
- [Tools](#tools)
  - [ToolExecutor](#toolexecutor)
  - [ToolResult](#toolresult)
  - [BashTool](#bashtool)
  - [FileReadTool](#filereadtool)
  - [FileWriteTool](#filewritetool)
  - [FileSearchTool](#filesearchtool)
  - [WebFetchTool](#webfetchtool)
  - [PythonTool](#pythontool)
  - [PatchTool](#patchtool)
- [Verification](#verification)
  - [VerifyPipeline](#verifypipeline)
  - [VerifyReport](#verifyreport)
  - [VerifyResult](#verifyresult)
  - [Checkers](#checkers)
- [Models](#models)
  - [BaseModel](#basemodel)
  - [LocalModel](#localmodel)
  - [OpenAIModel](#openaimodel)
  - [AnthropicModel](#anthropicmodel)
  - [Message](#message)
  - [ModelResponse](#modelresponse)
- [Daemon](#daemon)
  - [DaemonServer](#daemonserver)
  - [Endpoints](#endpoints)
- [Integrations](#integrations)
  - [VerifyLoopBridge](#verifyloopbridge)
  - [ErrorRecoveryBridge](#errorrecoverybridge)
  - [AgentSwarmBridge](#agentswarmbridge)
  - [CostOptimizerBridge](#costoptimizerbridge)
- [CLI](#cli)

---

## Engine

### AnvilEngine

The central orchestrator that drives the Plan→Execute→Verify→Recover loop.

```python
from anvil.engine import AnvilEngine, AnvilConfig

engine = AnvilEngine(config=AnvilConfig(model_backend="local"))
result = engine.run("Refactor the auth module to use OAuth2")
```

#### Constructor

```python
AnvilEngine(
    config: AnvilConfig | None = None,
    *,
    model_backend: str | None = None,
    tools: list[BaseTool] | None = None,
    verify: bool = True,
    max_iterations: int = 15,
    max_retries: int = 3,
    workspace: str | Path | None = None,
    session_id: str | None = None,
    history: list[dict] | None = None,
    on_step: Callable[[str, dict], None] | None = None,
    on_error: Callable[[Exception], None] | None = None,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | `AnvilConfig \| None` | `None` | Full configuration object. Overrides individual params. |
| `model_backend` | `str \| None` | `None` | Quick-select model backend: `"local"`, `"openai"`, `"anthropic"`. |
| `tools` | `list[BaseTool] \| None` | `None` | Custom tool list. Defaults to all 7 built-in tools. |
| `verify` | `bool` | `True` | Enable Verification phase after execution. |
| `max_iterations` | `int` | `15` | Maximum Plan→Execute loop iterations before terminating. |
| `max_retries` | `int` | `3` | Maximum Recovery attempts before giving up. |
| `workspace` | `str \| Path \| None` | `None` | Root directory for file operations. Defaults to `cwd`. |
| `session_id` | `str \| None` | `None` | Persist session across runs. Auto-generated if omitted. |
| `history` | `list[dict] \| None` | `None` | Pre-seed conversation history for multi-turn tasks. |
| `on_step` | `Callable \| None` | `None` | Callback fired after each iteration. Receives `(phase, metadata)`. |
| `on_error` | `Callable \| None` | `None` | Callback fired on unhandled errors. Receives `(exception)`. |

#### Methods

##### `run(task: str, **kwargs) -> EngineResult`

Execute a task through the full Plan→Execute→Verify→Recover pipeline.

```python
result = engine.run(
    "Add rate limiting to the /api/users endpoint",
    context="The API uses FastAPI with Redis backend",
    max_iterations=10,
)
print(result.summary)
print(result.iterations)   # list of iteration records
print(result.verification) # VerifyReport
print(result.cost)         # CostReport
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task` | `str` | required | Natural language task description. |
| `context` | `str \| None` | `None` | Additional context for the planner. |
| `max_iterations` | `int \| None` | `None` | Override engine-level max_iterations. |
| `continue_on_error` | `bool` | `False` | Keep running after non-fatal errors. |
| `dry_run` | `bool` | `False` | Plan only — no tool execution. |

**Returns:** `EngineResult`

---

##### `run_stream(task: str, **kwargs) -> AsyncIterator[StepEvent]`

Stream execution steps in real-time. Ideal for dashboards and TUIs.

```python
async for event in engine.run_stream("Fix the flaky test in tests/auth_test.py"):
    if event.phase == "execute":
        print(f"[{event.tool}] {event.content[:80]}")
    elif event.phase == "verify":
        print(f"  ✓ {event.check_name}: {event.result}")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task` | `str` | required | Natural language task description. |
| `**kwargs` | — | — | Same as `run()`. |

**Yields:** `StepEvent(phase, tool, content, check_name, result, metadata)`

---

##### `plan(task: str, **kwargs) -> PlanResult`

Run the Planning phase only. Returns a structured plan without execution.

```python
plan_result = engine.plan("Migrate database from SQLite to PostgreSQL")
for step in plan_result.steps:
    print(f"  {step.id}. {step.description} — tools: {step.tools}")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `task` | `str` | required | Natural language task description. |
| `context` | `str \| None` | `None` | Additional context for the planner. |

**Returns:** `PlanResult(steps: list[PlanStep], estimated_iterations: int, risks: list[str])`

---

##### `resume(session_id: str) -> EngineResult`

Resume a previously interrupted session.

```python
result = engine.resume(session_id="sess_abc123")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `session_id` | `str` | required | Session ID from a prior `run()` call. |

**Returns:** `EngineResult`

---

##### `add_tool(tool: BaseTool) -> None`

Register a custom tool at runtime.

```python
from anvil.tools import BaseTool

class WeatherTool(BaseTool):
    name = "weather"
    description = "Get current weather for a city"
    
    def run(self, city: str) -> str:
        return f"Weather in {city}: Sunny, 72°F"

engine.add_tool(WeatherTool())
```

---

##### `remove_tool(name: str) -> None`

Unregister a tool by name.

```python
engine.remove_tool("bash")
```

---

### EngineResult

Returned by `AnvilEngine.run()`.

```python
@dataclass
class EngineResult:
    task: str
    summary: str
    iterations: list[IterationRecord]
    verification: VerifyReport
    cost: CostReport
    session_id: str
    duration_seconds: float
    success: bool
    error: Exception | None
```

| Field | Type | Description |
|-------|------|-------------|
| `task` | `str` | Original task description. |
| `summary` | `str` | Human-readable result summary. |
| `iterations` | `list[IterationRecord]` | Detailed record of every loop iteration. |
| `verification` | `VerifyReport` | Verification results from the Verify phase. |
| `cost` | `CostReport` | Token usage and cost breakdown. |
| `session_id` | `str` | Session identifier for `resume()`. |
| `duration_seconds` | `float` | Total wall-clock time. |
| `success` | `bool` | Whether the task completed without fatal errors. |
| `error` | `Exception \| None` | Fatal error, if any. |

#### Methods

##### `to_dict() -> dict`

Serialize result to a plain dictionary.

```python
result.to_dict()  # JSON-serializable dict
```

##### `save(path: str | Path) -> None`

Persist result to a JSON file.

```python
result.save("results/task_001.json")
```

##### `classmethod load(path: str | Path) -> EngineResult`

Load a previously saved result.

```python
loaded = EngineResult.load("results/task_001.json")
```

---

### AnvilConfig

Configuration object for `AnvilEngine`.

```python
from anvil.engine import AnvilConfig

config = AnvilConfig(
    model_backend="openai",
    model_name="gpt-4o",
    api_key_env="OPENAI_API_KEY",
    verify=True,
    verify_strictness="balanced",
    max_iterations=15,
    sandbox=True,
    sandbox_dirs=["/projects/myapp"],
    cost_limit_usd=1.0,
    history_backend="sqlite",
    history_path="~/.anvil/history.db",
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_backend` | `str` | `"local"` | Model provider: `"local"`, `"openai"`, `"anthropic"`, or custom. |
| `model_name` | `str \| None` | `None` | Specific model identifier (e.g. `"gpt-4o"`, `"claude-sonnet-4-20250514"`). |
| `api_key_env` | `str \| None` | `None` | Environment variable name for the API key. |
| `api_base_url` | `str \| None` | `None` | Custom API base URL (for self-hosted models). |
| `verify` | `bool` | `True` | Enable Verification phase. |
| `verify_strictness` | `str` | `"balanced"` | Verification level: `"relaxed"`, `"balanced"`, `"strict"`. |
| `verify_checkers` | `list[str] \| None` | `None` | Specific checkers to run. `None` = all default. |
| `max_iterations` | `int` | `15` | Maximum Plan→Execute iterations. |
| `max_retries` | `int` | `3` | Maximum Recovery attempts. |
| `sandbox` | `bool` | `True` | Enable filesystem sandbox. |
| `sandbox_dirs` | `list[str] \| None` | `None` | Allowed directories. Defaults to workspace. |
| `cost_limit_usd` | `float \| None` | `None` | Stop execution if cost exceeds this limit. |
| `history_backend` | `str` | `"sqlite"` | Session history backend: `"sqlite"`, `"json"`, `"memory"`. |
| `history_path` | `str \| Path \| None` | `None` | Path for history storage. |
| `daemon_port` | `int` | `8420` | Port for daemon HTTP server. |
| `daemon_host` | `str` | `"127.0.0.1"` | Host binding for daemon. |

#### Methods

##### `classmethod from_file(path: str | Path) -> AnvilConfig`

Load configuration from a YAML or TOML file.

```python
config = AnvilConfig.from_file("anvil.config.yaml")
```

##### `save(path: str | Path) -> None`

Serialize config to file.

```python
config.save("anvil.config.yaml")
```

##### `to_env() -> dict[str, str]`

Export config as environment variable mapping.

```python
env_vars = config.to_env()
# {"ANVIL_MODEL_BACKEND": "openai", "ANVIL_MODEL_NAME": "gpt-4o", ...}
```

---

## Tools

### ToolExecutor

Dispatches tool calls to registered tools with validation, timeout, and sandboxing.

```python
from anvil.tools import ToolExecutor

executor = ToolExecutor(tools=[BashTool(), FileReadTool()])
result = executor.execute("bash", command="ls -la /tmp")
```

#### Constructor

```python
ToolExecutor(
    tools: list[BaseTool] | None = None,
    timeout: int = 120,
    sandbox: bool = True,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `tools` | `list[BaseTool] \| None` | `None` | Tool instances. `None` loads all built-in tools. |
| `timeout` | `int` | `120` | Per-call timeout in seconds. |
| `sandbox` | `bool` | `True` | Enable path sandboxing for file tools. |

#### Methods

##### `execute(tool_name: str, **kwargs) -> ToolResult`

Execute a single tool call.

```python
result = executor.execute("file_read", path="/tmp/data.json")
print(result.output)    # file contents
print(result.success)   # True
result.raise_on_error() # raise if failed
```

##### `execute_batch(calls: list[dict]) -> list[ToolResult]`

Execute multiple independent tool calls in parallel.

```python
results = executor.execute_batch([
    {"tool": "file_read", "kwargs": {"path": "/tmp/a.py"}},
    {"tool": "file_read", "kwargs": {"path": "/tmp/b.py"}},
])
```

##### `list_tools() -> list[ToolInfo]`

Return metadata for all registered tools.

```python
for info in executor.list_tools():
    print(f"{info.name}: {info.description}")
    print(f"  Parameters: {info.parameters}")
```

##### `validate_call(tool_name: str, **kwargs) -> bool`

Validate a tool call without executing it.

```python
executor.validate_call("bash", command="rm -rf /")  # False — blocked
executor.validate_call("bash", command="ls /tmp")    # True
```

---

### ToolResult

```python
@dataclass
class ToolResult:
    tool: str
    output: str
    success: bool
    error: str | None
    duration_ms: float
    metadata: dict[str, Any]
```

| Field | Type | Description |
|-------|------|-------------|
| `tool` | `str` | Name of the tool that was called. |
| `output` | `str` | Tool output (stdout for Bash, file contents for file tools). |
| `success` | `bool` | Whether execution completed without errors. |
| `error` | `str \| None` | Error message if the tool call failed. |
| `duration_ms` | `float` | Execution wall time in milliseconds. |
| `metadata` | `dict` | Extra tool-specific metadata (exit code, file size, etc.). |

#### Methods

##### `raise_on_error() -> None`

Raise `ToolExecutionError` if `success` is `False`.

```python
result.raise_on_error()  # raises ToolExecutionError if failed
```

---

### BashTool

Execute shell commands with safety restrictions.

```python
from anvil.tools import BashTool

tool = BashTool(timeout=60, allowed_commands=None, blocked_commands=["rm -rf /"])
result = tool.run(command="python -m pytest tests/")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `command` | `str` | required | Shell command to execute. |
| `timeout` | `int` | `120` | Timeout in seconds. |
| `cwd` | `str \| None` | `None` | Working directory. Defaults to sandbox root. |
| `env` | `dict \| None` | `None` | Extra environment variables. |

**Safety features:**
- Blocked command patterns: `rm -rf /`, `mkfs`, `dd if=/dev/zero`, etc.
- Path sandboxing: commands cannot write outside allowed directories.
- Timeout enforcement via subprocess.

---

### FileReadTool

Read file contents with line-range support.

```python
from anvil.tools import FileReadTool

tool = FileReadTool()
result = tool.run(path="src/auth.py", start_line=10, end_line=50)
result = tool.run(path="README.md")  # entire file
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `str` | required | File path (relative to workspace root). |
| `start_line` | `int \| None` | `None` | Start line (1-indexed, inclusive). |
| `end_line` | `int \| None` | `None` | End line (1-indexed, inclusive). |
| `encoding` | `str` | `"utf-8"` | File encoding. |

---

### FileWriteTool

Write or append to files with automatic backup.

```python
from anvil.tools import FileWriteTool

tool = FileWriteTool(backup=True)
result = tool.run(path="src/auth.py", content="def login():\n    pass")
result = tool.run(path="notes.txt", content="\nAppended line", mode="append")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `path` | `str` | required | Target file path. |
| `content` | `str` | required | Content to write. |
| `mode` | `str` | `"write"` | `"write"` or `"append"`. |
| `backup` | `bool` | `True` | Create `.bak` before overwriting. |

---

### FileSearchTool

Search files by name pattern or content regex.

```python
from anvil.tools import FileSearchTool

tool = FileSearchTool()
result = tool.run(pattern="*.py", directory="src")
result = tool.run(content_regex="TODO|FIXME", directory="src", file_pattern="*.py")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `pattern` | `str \| None` | `None` | Glob pattern for filename search. |
| `content_regex` | `str \| None` | `None` | Regex pattern for content search. |
| `directory` | `str` | `"."` | Root directory to search. |
| `file_pattern` | `str \| None` | `None` | Filter files by glob when using `content_regex`. |
| `max_results` | `int` | `100` | Maximum results to return. |

---

### WebFetchTool

Fetch and extract text from URLs.

```python
from anvil.tools import WebFetchTool

tool = WebFetchTool()
result = tool.run(url="https://docs.python.org/3/library/json.html")
result = tool.run(url="https://api.example.com/data", format="json")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `url` | `str` | required | URL to fetch. |
| `format` | `str` | `"text"` | Output format: `"text"`, `"json"`, `"html"`, `"markdown"`. |
| `timeout` | `int` | `30` | Fetch timeout in seconds. |

---

### PythonTool

Execute Python code in an isolated namespace.

```python
from anvil.tools import PythonTool

tool = PythonTool()
result = tool.run(code="import math; print(math.pi * 2)")
result = tool.run(code="df.describe()", setup="import pandas as pd\n\ndf = pd.read_csv('data.csv')")
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `code` | `str` | required | Python code to execute. |
| `setup` | `str \| None` | `None` | Setup code to run before `code` (imports, data loading). |
| `timeout` | `int` | `30` | Execution timeout in seconds. |

---

### PatchTool

Apply unified diffs to files.

```python
from anvil.tools import PatchTool

tool = PatchTool()
result = tool.run(
    target="src/auth.py",
    diff="""--- a/src/auth.py
+++ b/src/auth.py
@@ -10,3 +10,4 @@
 def login():
+    logger.info("Login attempt")
     return authenticate(request)
"""
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `target` | `str` | required | File to patch. |
| `diff` | `str` | required | Unified diff content. |
| `dry_run` | `bool` | `False` | Preview without applying. |

---

## Verification

### VerifyPipeline

Runs configurable checkers against the execution result to verify correctness.

```python
from anvil.verify import VerifyPipeline, VerifyConfig

pipeline = VerifyPipeline(VerifyConfig(
    strictness="strict",
    checkers=["syntax", "tests", "lint", "diff_review", "idempotency"],
))
report = pipeline.verify(result, workspace=".")
```

#### Constructor

```python
VerifyPipeline(config: VerifyConfig | None = None)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `config` | `VerifyConfig \| None` | `None` | Verification configuration. Defaults to balanced strictness. |

#### Methods

##### `verify(result: EngineResult, workspace: str | Path) -> VerifyReport`

Run all configured checkers and produce a report.

```python
report = pipeline.verify(
    result=engine_result,
    workspace="/projects/myapp",
)
print(report.passed)  # True if all checkers pass
```

##### `add_checker(checker: BaseChecker) -> None`

Register a custom checker.

```python
from anvil.verify import BaseChecker

class NoTodoChecker(BaseChecker):
    name = "no_todos"
    
    def check(self, result, workspace) -> list[CheckResult]:
        # Scan changed files for TODO comments
        ...

pipeline.add_checker(NoTodoChecker())
```

---

### VerifyReport

```python
@dataclass
class VerifyReport:
    passed: bool
    checkers: list[CheckResult]
    summary: str
    details: list[dict]
    score: float  # 0.0 - 1.0
    duration_ms: float
```

| Field | Type | Description |
|-------|------|-------------|
| `passed` | `bool` | Overall pass/fail. |
| `checkers` | `list[CheckResult]` | Individual checker results. |
| `summary` | `str` | Human-readable summary. |
| `details` | `list[dict]` | Detailed output per checker. |
| `score` | `float` | Aggregate score (0.0 – 1.0). |
| `duration_ms` | `float` | Total verification time. |

---

### VerifyResult

Individual checker result within a `VerifyReport`.

```python
@dataclass
class VerifyResult:
    checker: str
    passed: bool
    message: str
    evidence: dict[str, Any]
    severity: str  # "info", "warning", "error"
```

---

### Checkers

Built-in verification checkers:

| Checker | Description |
|---------|-------------|
| `syntax` | Validates Python syntax of all changed files. |
| `tests` | Runs the project's test suite. |
| `lint` | Runs linter (ruff/flake8) on changed files. |
| `typecheck` | Runs mypy/pyright type checking. |
| `diff_review` | LLM-powered review of the diff for logic errors. |
| `idempotency` | Verifies running the same task twice produces the same result. |
| `security` | Checks for common security issues (hardcoded secrets, SQL injection patterns). |

```python
from anvil.verify import SyntaxChecker, TestChecker, LintChecker

pipeline = VerifyPipeline(VerifyConfig(
    checkers=["syntax", "tests", "lint"],
    # Or pass checker instances:
    # checkers=[SyntaxChecker(), TestChecker(), LintChecker()],
))
```

---

## Models

### BaseModel

Abstract base class for all model backends.

```python
from anvil.models import BaseModel

class CustomModel(BaseModel):
    def __init__(self, model_name: str, **kwargs):
        super().__init__(model_name=model_name, **kwargs)
    
    def generate(self, messages: list[Message], **kwargs) -> ModelResponse:
        # Your implementation here
        ...
    
    def count_tokens(self, text: str) -> int:
        # Your token counting logic
        ...
```

#### Abstract Methods

| Method | Signature | Description |
|--------|-----------|-------------|
| `generate` | `(messages: list[Message], **kwargs) -> ModelResponse` | Generate a completion. |
| `count_tokens` | `(text: str) -> int` | Count tokens in text. |
| `validate_connection` | `() -> bool` | Test connectivity to model backend. |

---

### LocalModel

Backend for locally-hosted models via Ollama or vLLM server.

```python
from anvil.models import LocalModel

model = LocalModel(
    model_name="fableforge-14b",
    base_url="http://localhost:11434",
    timeout=120,
)
response = model.generate([Message(role="user", content="Hello")])
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_name` | `str` | `"fableforge-14b"` | Model identifier in Ollama/vLLM. |
| `base_url` | `str` | `"http://localhost:11434"` | API endpoint URL. |
| `timeout` | `int` | `120` | Request timeout in seconds. |
| `api_type` | `str` | `"ollama"` | API format: `"ollama"` or `"vllm"`. |
| `context_length` | `int` | `8192` | Maximum context window. |

---

### OpenAIModel

Backend for OpenAI-compatible APIs.

```python
from anvil.models import OpenAIModel

model = OpenAIModel(
    model_name="gpt-4o",
    api_key_env="OPENAI_API_KEY",
    organization="org-abc",
    base_url="https://api.openai.com/v1",  # or custom endpoint
)
response = model.generate([Message(role="user", content="Hello")])
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_name` | `str` | `"gpt-4o"` | Model identifier. |
| `api_key_env` | `str` | `"OPENAI_API_KEY"` | Environment variable for API key. |
| `organization` | `str \| None` | `None` | OpenAI organization ID. |
| `base_url` | `str` | `"https://api.openai.com/v1"` | API base URL. |
| `max_tokens` | `int` | `4096` | Maximum response tokens. |
| `temperature` | `float` | `0.7` | Sampling temperature. |

---

### AnthropicModel

Backend for Anthropic's Claude API.

```python
from anvil.models import AnthropicModel

model = AnthropicModel(
    model_name="claude-sonnet-4-20250514",
    api_key_env="ANTHROPIC_API_KEY",
)
response = model.generate([Message(role="user", content="Hello")])
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `model_name` | `str` | `"claude-sonnet-4-20250514"` | Model identifier. |
| `api_key_env` | `str` | `"ANTHROPIC_API_KEY"` | Environment variable for API key. |
| `max_tokens` | `int` | `4096` | Maximum response tokens. |
| `temperature` | `float` | `0.7` | Sampling temperature. |

---

### Message

```python
@dataclass
class Message:
    role: str          # "system", "user", "assistant", "tool"
    content: str
    name: str | None   # Tool name when role="tool"
    tool_call_id: str | None
    metadata: dict = field(default_factory=dict)
```

---

### ModelResponse

```python
@dataclass
class ModelResponse:
    content: str
    model: str
    usage: TokenUsage
    finish_reason: str
    tool_calls: list[ToolCall] | None
    raw: dict  # Original API response
```

| Field | Type | Description |
|-------|------|-------------|
| `content` | `str` | Generated text content. |
| `model` | `str` | Model identifier used. |
| `usage` | `TokenUsage` | Token counts (`prompt_tokens`, `completion_tokens`, `total_tokens`). |
| `finish_reason` | `str` | Why generation stopped (`"stop"`, `"length"`, `"tool_call"`). |
| `tool_calls` | `list[ToolCall] \| None` | Structured tool call requests, if any. |
| `raw` | `dict` | Full API response for debugging. |

---

## Daemon

### DaemonServer

HTTP server mode for running Anvil as a persistent service.

```python
from anvil.daemon import DaemonServer

server = DaemonServer(host="127.0.0.1", port=8420)
server.start()  # Blocking — runs until stopped
```

#### Constructor

```python
DaemonServer(
    host: str = "127.0.0.1",
    port: int = 8420,
    config: AnvilConfig | None = None,
    engine: AnvilEngine | None = None,
    cors: bool = True,
    api_key: str | None = None,
)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `host` | `str` | `"127.0.0.1"` | Bind address. |
| `port` | `int` | `8420` | Bind port. |
| `config` | `AnvilConfig \| None` | `None` | Engine configuration. |
| `engine` | `AnvilEngine \| None` | `None` | Pre-configured engine instance. |
| `cors` | `bool` | `True` | Enable CORS headers. |
| `api_key` | `str \| None` | `None` | Bearer token for authentication. |

---

### Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/v1/tasks` | Submit a new task. |
| `GET` | `/v1/tasks/{id}` | Get task status and result. |
| `POST` | `/v1/tasks/{id}/cancel` | Cancel a running task. |
| `GET` | `/v1/tasks/{id}/stream` | SSE stream of task events. |
| `GET` | `/v1/health` | Health check. |
| `GET` | `/v1/tools` | List available tools. |
| `POST` | `/v1/tools/execute` | Execute a single tool call. |
| `GET` | `/v1/sessions` | List sessions. |
| `GET` | `/v1/sessions/{id}` | Get session details. |
| `DELETE` | `/v1/sessions/{id}` | Delete a session. |

#### Submit a task

```bash
curl -X POST http://localhost:8420/v1/tasks \
  -H "Content-Type: application/json" \
  -d '{"task": "Add rate limiting to the /api/users endpoint"}'
```

Response:
```json
{
  "task_id": "task_abc123",
  "status": "running",
  "created_at": "2026-06-15T10:30:00Z"
}
```

#### Stream task events

```bash
curl -N http://localhost:8420/v1/tasks/task_abc123/stream
```

---

## Integrations

### VerifyLoopBridge

Connects Anvil to FableForge's `verify-loop` project for iterative verification cycles.

```python
from anvil.integrations import VerifyLoopBridge

bridge = VerifyLoopBridge(
    max_rounds=5,
    convergence_threshold=0.95,
)
result = await bridge.run(task="Refactor auth module", engine=engine)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `max_rounds` | `int` | `5` | Maximum verify→fix rounds. |
| `convergence_threshold` | `float` | `0.95` | Verification score to stop iterating. |
| `checkers` | `list[str] \| None` | `None` | Override default checkers. |

---

### ErrorRecoveryBridge

Connects Anvil to `error-recovery` for intelligent error healing.

```python
from anvil.integrations import ErrorRecoveryBridge

bridge = ErrorRecoveryBridge(
    strategy="cascade",  # "retry", "rewrite", "cascade"
    max_attempts=3,
)
result = await bridge.heal(error=exc, context=engine_result, engine=engine)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `strategy` | `str` | `"cascade"` | Recovery strategy: `"retry"`, `"rewrite"`, `"cascade"`. |
| `max_attempts` | `int` | `3` | Maximum recovery attempts. |
| `model_override` | `str \| None` | `None` | Use a different model for recovery planning. |

---

### AgentSwarmBridge

Connects Anvil to `agent-swarm` for multi-agent orchestration.

```python
from anvil.integrations import AgentSwarmBridge

bridge = AgentSwarmBridge(
    agents=["coder", "reviewer", "planner"],
    routing="auto",  # "auto", "round_robin", "manual"
)
result = await bridge.delegate(task="Implement feature X", engine=engine)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `agents` | `list[str]` | `["coder"]` | Available agent roles. |
| `routing` | `str` | `"auto"` | Task routing strategy. |
| `max_agents` | `int` | `5` | Maximum concurrent agents. |

---

### CostOptimizerBridge

Connects Anvil to `cost-optimizer` for intelligent model routing by cost.

```python
from anvil.integrations import CostOptimizerBridge

bridge = CostOptimizerBridge(
    default_model="fableforge-14b",
    budget_usd=1.0,
    strategy="best_value",  # "cheapest", "best_value", "quality_first"
)
engine_with_optimizer = bridge.attach(engine)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `default_model` | `str` | `"fableforge-14b"` | Fallback model. |
| `budget_usd` | `float \| None` | `None` | Total budget cap. |
| `strategy` | `str` | `"best_value"` | Routing strategy. |

---

## CLI

Anvil provides a full CLI under the `anvil` command.

### Global Options

| Flag | Description |
|------|-------------|
| `--config FILE` | Path to config file. |
| `--model-backend BACKEND` | Model backend (`local`, `openai`, `anthropic`). |
| `--model-name NAME` | Specific model name. |
| `--verbose` / `-v` | Verbose output. |
| `--quiet` / `-q` | Suppress non-essential output. |
| `--no-verify` | Disable verification. |
| `--version` | Show version. |

### `anvil run TASK`

Run a task through the full pipeline.

```bash
anvil run "Add rate limiting to the /api/users endpoint" \
  --model-backend openai \
  --max-iterations 10 \
  --workspace /projects/myapp
```

| Flag | Default | Description |
|------|---------|-------------|
| `--max-iterations N` | `15` | Maximum loop iterations. |
| `--max-retries N` | `3` | Maximum recovery retries. |
| `--workspace DIR` | `cwd` | Project directory. |
| `--context TEXT` | — | Additional context. |
| `--dry-run` | `False` | Plan only, no execution. |
| `--no-verify` | `False` | Skip verification. |
| `--session ID` | — | Resume a session. |

### `anvil plan TASK`

Run the Planning phase only.

```bash
anvil plan "Migrate from SQLite to PostgreSQL"
```

### `anvil verify RESULT_FILE`

Run verification on a saved result.

```bash
anvil verify results/task_001.json --strictness strict
```

### `anvil daemon`

Start the Anvil HTTP daemon.

```bash
anvil daemon --port 8420 --host 127.0.0.1
```

| Flag | Default | Description |
|------|---------|-------------|
| `--port PORT` | `8420` | Listen port. |
| `--host HOST` | `127.0.0.1` | Listen address. |
| `--api-key KEY` | — | Bearer token for auth. |
| `--no-cors` | `False` | Disable CORS. |

### `anvil session list`

List saved sessions.

```bash
anvil session list --limit 10
```

### `anvil session show ID`

Show details of a session.

```bash
anvil session show sess_abc123
```

### `anvil tools list`

List available tools and their descriptions.

```bash
anvil tools list
```

### `anvil config init`

Generate a starter configuration file.

```bash
anvil config init --backend openai --output anvil.config.yaml
```

---

## Error Types

| Exception | When Raised |
|-----------|-------------|
| `AnvilError` | Base exception for all Anvil errors. |
| `ToolExecutionError` | A tool call failed. |
| `ModelError` | Model backend error (auth, rate limit, timeout). |
| `VerificationError` | Verification phase detected critical issues. |
| `SandboxViolationError` | Attempted file/command access outside sandbox. |
| `CostLimitExceededError` | Execution cost exceeded `cost_limit_usd`. |
| `MaxIterationsExceededError` | Hit `max_iterations` without convergence. |
| `SessionNotFoundError` | Referenced session ID does not exist. |

```python
from anvil.errors import AnvilError, ToolExecutionError

try:
    result = engine.run("Fix the tests")
except ToolExecutionError as e:
    print(f"Tool {e.tool_name} failed: {e.detail}")
except AnvilError as e:
    print(f"Anvil error: {e}")
```
