# FableForge CLI Test Results

**Date:** 2026-06-15  
**Total Projects:** 18  
**Passed:** 17  
**Failed:** 0  
**Fixed:** 2  
**Created:** 1

---

## Summary Table

| # | Project | Package | Status | Commands Available |
|---|---------|---------|--------|-------------------|
| 1 | anvil | `anvil.cli` | PASS | chat, daemon, models, run, sessions, verify |
| 2 | verifyloop | `verifyloop.cli` | PASS | run |
| 3 | agent-swarm | `agent_swarm.cli` | PASS | build-matrix, run, status, visualize |
| 4 | error-recovery | `error_recovery.cli` | PASS | recover, analyze, build-index, serve |
| 5 | bench-agent | `bench_agent.cli` | PASS | export, leaderboard, list-tasks, run |
| 6 | shell-whisperer | `shell_whisperer.cli` | PASS (fixed) | predict, train, export, serve |
| 7 | reason-critic | `reason_critic.cli` | PASS (fixed) | verify, train, serve |
| 8 | trace-compiler | `trace_compiler.cli` | PASS | compile, evaluate, extract, inspect, parse |
| 9 | agent-runtime | `agent_runtime.cli` | PASS | create, list, pause, resume, start, stop, stop-session |
| 10 | agent-telemetry | `agent_telemetry.cli` | PASS | analyze, cost, dashboard, errors, tokens |
| 11 | cost-optimizer | `cost_optimizer.cli` | PASS | analyze, estimate, optimize |
| 12 | agent-profiler | `agent_profiler.cli` | PASS | classify, profile, visualize |
| 13 | trajectory-distiller | `trajectory_distiller.cli` | PASS | distill, filter, split |
| 14 | fable5-dataset | `fable5_dataset.cli` | PASS | benchmark, convert, load, split, stats |
| 15 | agent-constitution | `agent_constitution.cli` | PASS | check, extract, list-rules |
| 16 | agent-fuzzer | `agent_fuzzer.cli` | PASS | fuzz, report |
| 17 | agent-curriculum | `agent_curriculum.cli` | PASS (created) | score, build, schedule |
| 18 | agent-skills | `agent_skills.cli` | PASS | build, decompose, download, install, list, publish |

---

## Detailed Results

### 1. anvil — PASS
- **--help**: Works. Self-verified coding agent CLI.
- **models**: Lists available models (local, gpt-4o, claude-3.5-sonnet, etc.)
- **sessions**: Shows past sessions (4 test sessions found)

### 2. verifyloop — PASS
- **--help**: Works. Plan-Execute-Verify-Recover pipeline.
- **run --help**: Supports --task-file, --context, --model, --verify-model, --dry-run, --interactive, --sandbox

### 3. agent-swarm — PASS
- **--help**: Works. Micro-agent swarm orchestration with Markov transition matrices.
- **status**: Shows swarm status (0 tasks, 0 handoffs)
- Commands: build-matrix, run, status, visualize

### 4. error-recovery — PASS
- **--help**: Works (argparse-based). Self-healing agent middleware.
- **recover --error "ModuleNotFoundError"**: Successfully recovered, identified category `import_error`, similarity 0.88
- Commands: recover, analyze, build-index, serve

### 5. bench-agent — PASS
- **--help**: Works. HumanEval for tool use.
- **list-tasks**: Shows 107 tasks across bash, edit, read, write, multi_tool, error_recovery categories
- Commands: export, leaderboard, list-tasks, run

### 6. shell-whisperer — PASS (fixed)
- **Issue**: Top-level imports of `peft`, `transformers`, `datasets` in `cli.py` caused `ModuleNotFoundError: No module named 'peft'`
- **Fix**: Replaced eager imports with lazy imports inside each command function. Removed top-level imports of `trainer`, `exporter`, `inference`, `server`, `prompts`, `data_extractor` modules and moved them into the functions that use them.
- **--help**: Works after fix. Natural language to shell commands.
- Commands: predict, train, export, serve (+ REPL and one-shot modes)

### 7. reason-critic — PASS (fixed)
- **Issue**: Top-level imports of `peft`, `transformers`, `datasets` via `trainer.py` caused `ModuleNotFoundError`
- **Fix**: Replaced eager imports in `cli.py` with lazy imports inside each command. Removed top-level imports of `critic`, `data_prep`, `trainer`, `pipeline` and moved them into `verify()`, `train()`, `serve()` functions.
- **--help**: Works after fix. Self-verification model for agent output.
- Commands: verify, train, serve

### 8. trace-compiler — PASS
- **--help**: Works. Compile agent traces into distilled LoRA weights.
- **inspect --help**: Inspect trace files for format and content.
- Commands: compile, evaluate, extract, inspect, parse

### 9. agent-runtime — PASS
- **--help**: Works. Agent runtime management.
- **list**: Shows "No sessions found" (expected with no running sessions)
- Commands: create, list, pause, resume, start, stop, stop-session

### 10. agent-telemetry — PASS
- **--help**: Works. Datadog for AI agents.
- **tokens "hello world test"**: Returns "3 tokens (gpt-4), Input cost: $0.000090"
- Commands: analyze, cost, dashboard, errors, tokens

### 11. cost-optimizer — PASS
- **--help**: Works. Token waste analysis and LLM routing optimization.
- **estimate --tokens 1000 --model gpt-4o**: Returns cost estimate "$0.0055"
- Commands: analyze, estimate, optimize

### 12. agent-profiler — PASS
- **--help**: Works. Profile and classify agent behavior patterns.
- **classify --help**: Requires a TRACE_FILE argument.
- Commands: classify, profile, visualize

### 13. trajectory-distiller — PASS
- **--help**: Works. Convert agent traces to training datasets.
- **distill --help**: Supports --format, --input-format, --output options.
- Commands: distill, filter, split

### 14. fable5-dataset — PASS
- **--help**: Works. Load and manage agent trace datasets.
- **stats --help**: Supports --source option for dataset selection.
- Commands: benchmark, convert, load, split, stats

### 15. agent-constitution — PASS
- **--help**: Works. Extract safety patterns and enforce guardrails.
- **list-rules**: Shows 60 constitutional rules (safety, privacy, etc.)
- Commands: check, extract, list-rules

### 16. agent-fuzzer — PASS
- **--help**: Works. Adversarial scenario testing for coding agents.
- **fuzz --help**: Supports --model, --category, --count, --difficulty options.
- Commands: fuzz, report

### 17. agent-curriculum — PASS (created)
- **Issue**: `pyproject.toml` referenced `agent_curriculum.cli:cli` but no `cli.py` existed.
- **Fix**: Created `/tmp/fableforge/agent-curriculum/src/agent_curriculum/cli.py` with three commands: `score` (score traces by difficulty), `build` (build curriculum stages), `schedule` (show LR/batch schedule).
- **schedule**: Successfully shows 5-stage curriculum schedule.
- Commands: score, build, schedule

### 18. agent-skills — PASS
- **--help**: Works. Skill registry, decomposition, and LoRA building.
- **list**: Shows 6 core skills (bash, debug, edit, plan, recover, verify).
- Commands: build, decompose, download, install, list, publish

---

## Fixes Applied

### shell-whisperer (`cli.py`)
**Problem:** Eager imports of ML dependencies (`peft`, `transformers`, `datasets`) at module level caused `ModuleNotFoundError` when running `--help`.  
**Fix:** Replaced all top-level heavy imports with lazy imports inside each click command function. The `trainer`, `exporter`, `inference`, `server`, `prompts`, and `data_extractor` modules are now only imported when their specific command is invoked.

### reason-critic (`cli.py`)
**Problem:** Same as shell-whisperer — eager imports of `peft`, `transformers`, `datasets` via `trainer.py` caused `ModuleNotFoundError` on `--help`.  
**Fix:** Replaced all top-level imports with lazy imports inside each command function. Output file rewritten from scratch with lazy import pattern.

### agent-curriculum (`cli.py`)
**Problem**: `pyproject.toml` declared `acurriculum = "agent_curriculum.cli:cli"` entry point but no `cli.py` file existed.  
**Fix:** Created a new `cli.py` with three commands (`score`, `build`, `schedule`) that wrap the existing `difficulty_scorer`, `stage_builder`, and `scheduler` modules. Correctly used `StageBuilder` class (not `CurriculumStager` which doesn't exist).

---

## Remaining Issues

None. All 18 project CLIs are now functional.