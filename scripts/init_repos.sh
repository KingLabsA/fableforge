#!/usr/bin/env bash
set -euo pipefail

ORG="fableforge"
LICENSE="mit"

declare -A REPO_DESCRIPTIONS
REPO_DESCRIPTIONS=(
  [anvil]="FableForge's core agent orchestration engine — build, run, and debug LLM agents"
  [verifyloop]="Iterative verification loops that self-correct agent outputs until quality thresholds are met"
  [error-recovery]="Graceful error recovery and fallback strategies for LLM agent pipelines"
  [agent-swarm]="Multi-agent swarm coordination with dynamic task distribution and consensus"
  [fableforge-14b]="FableForge 14B — a fine-tuned open-weight model optimized for agentic reasoning"
  [shell-whisperer]="Natural language to shell commands — translate intent into safe, executable CLI invocations"
  [reason-critic]="Critique and improve chain-of-thought reasoning traces before execution"
  [trace-compiler]="Compile agent execution traces into reproducible, versioned pipelines"
  [agent-runtime]="Lightweight runtime for executing agent graphs with streaming and cancellation"
  [agent-telemetry]="Observability for agents — structured spans, metrics, and trace export"
  [bench-agent]="Benchmarking harness for evaluating agent performance across tasks"
  [agent-dev]="Developer toolkit: scaffolding, hot-reload, and local debugging for agents"
  [trace-viz]="Interactive visualization of agent execution traces and decision paths"
  [agent-skills]="Composable skill definitions and registries for FableForge agents"
  [agent-curriculum]="Curriculum generation and progressive task sequencing for agent training"
  [agent-fuzzer]="Fuzz testing for agent prompts and tool interfaces to find failure modes"
  [agent-constitution]="Constitutional AI constraints and value alignment specifications for agents"
  [cost-optimizer]="Token usage and latency optimizer — minimize cost without sacrificing quality"
  [agent-profiler]="Profile agent runs for latency, token usage, and tool call hotspots"
  [trajectory-distiller]="Distill high-quality agent trajectories into reusable few-shot examples"
  [fable5-dataset]="Fable5 — a curated dataset of 5k agent trajectories for research and fine-tuning"
)

declare -A REPO_TOPICS
REPO_TOPICS=(
  [anvil]="agents llm orchestration python"
  [verifyloop]="agents verification self-correction python"
  [error-recovery]="agents error-handling resilience python"
  [agent-swarm]="agents multi-agent swarm coordination python"
  [fableforge-14b]="llm model fine-tuned reasoning"
  [shell-whisperer]="agents cli shell natural-language python"
  [reason-critic]="agents reasoning critique python"
  [trace-compiler]="agents traces pipeline compilation python"
  [agent-runtime]="agents runtime execution python"
  [agent-telemetry]="agents observability tracing python"
  [bench-agent]="agents benchmarking evaluation python"
  [agent-dev]="agents developer-tools scaffolding python"
  [trace-viz]="agents visualization traces typescript"
  [agent-skills]="agents skills registry python"
  [agent-curriculum]="agents training curriculum python"
  [agent-fuzzer]="agents fuzz-testing python"
  [agent-constitution]="agents alignment constitutional-ai python"
  [cost-optimizer]="agents cost optimization python"
  [agent-profiler]="agents profiling performance python"
  [trajectory-distiller]="agents trajectories distillation python"
  [fable5-dataset]="dataset trajectories research python"
)

REPOS=(
  anvil
  verifyloop
  error-recovery
  agent-swarm
  fableforge-14b
  shell-whisperer
  reason-critic
  trace-compiler
  agent-runtime
  agent-telemetry
  bench-agent
  agent-dev
  trace-viz
  agent-skills
  agent-curriculum
  agent-fuzzer
  agent-constitution
  cost-optimizer
  agent-profiler
  trajectory-distiller
  fable5-dataset
)

log() { echo "[$(date +%T)] $*"; }

ensure_org() {
  if gh org view "$ORG" --json name --jq '.name' &>/dev/null; then
    log "Org $ORG already exists"
  else
    log "Creating org $ORG (requires manual creation in GitHub UI or GHES admin)"
    log "Attempting gh org edit as fallback..."
    log "WARN: If this is a personal account, repos will be created under your user. Set ORG accordingly."
  fi
}

repo_exists() {
  gh repo view "${ORG}/${1}" --json name --jq '.name' &>/dev/null
}

create_repo() {
  local repo="$1"
  local desc="${REPO_DESCRIPTIONS[$repo]}"
  local topics="${REPO_TOPICS[$repo]}"

  if repo_exists "$repo"; then
    log "Repo ${ORG}/${repo} already exists — skipping creation"
    return 0
  fi

  log "Creating repo ${ORG}/${repo}"
  gh repo create "${ORG}/${repo}" \
    --public \
    --description "$desc" \
    --license "$LICENSE" \
    --clone=false

  for topic in $topics; do
    gh repo edit "${ORG}/${repo}" --add-topic "$topic" 2>/dev/null || true
  done

  log "Created ${ORG}/${repo}"
}

init_and_push() {
  local repo="$1"
  local repo_dir
  repo_dir=$(mktemp -d "/tmp/fableforge-${repo}-XXXXXX")

  if repo_exists "$repo"; then
    local clone_url
    clone_url=$(gh repo view "${ORG}/${repo}" --json sshUrl --jq '.sshUrl' 2>/dev/null \
      || gh repo view "${ORG}/${repo}" --json url --jq '.url')

    if [ -d "$repo_dir" ] && [ -n "$(ls -A "$repo_dir" 2>/dev/null)" ]; then
      log "Repo ${ORG}/${repo} already has content — skipping init/push"
      rm -rf "$repo_dir"
      return 0
    fi
  fi

  log "Initializing local repo for ${ORG}/${repo}"
  pushd "$repo_dir" >/dev/null

  git init
  git checkout -b main

  cat > README.md <<README
# ${repo}

${REPO_DESCRIPTIONS[$repo]}

Part of the [FableForge](https://github.com/${ORG}) project.

## Installation

\`\`\`bash
pip install ${repo}
\`\`\`

## License

MIT
README

  cat > .gitignore <<GITIGNORE
__pycache__/
*.py[cod]
*$py.class
*.egg-info/
dist/
build/
.eggs/
*.egg
.pytest_cache/
.mypy_cache/
.ruff_cache/
htmlcov/
.coverage
coverage.xml
.env
.venv/
venv/
node_modules/
*.tsbuildinfo
.next/
out/
GITIGNORE

  cat > pyproject.toml <<PYPROJECT
[project]
name = "${repo}"
version = "0.1.0"
description = "${REPO_DESCRIPTIONS[$repo]}"
readme = "README.md"
license = {text = "MIT"}
requires-python = ">=3.10"
dependencies = []

[project.optional-dependencies]
dev = ["pytest>=7", "ruff>=0.4"]

[tool.ruff]
target-version = "py310"
line-length = 120

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "SIM"]

[tool.pytest.ini_options]
testpaths = ["tests"]
PYPROJECT

  mkdir -p tests
  cat > tests/__init__.py <<INIT
INIT

  cat > tests/test_placeholder.py <<TEST
def test_placeholder():
    assert True
TEST

  git add -A
  git commit -m "feat: initial project scaffold for ${repo}"
  git remote add origin "https://github.com/${ORG}/${repo}.git"
  git push -u origin main 2>/dev/null || {
    log "WARN: push failed for ${ORG}/${repo} — repo may already have content or remote issues"
  }

  popd >/dev/null
  rm -rf "$repo_dir"
  log "Initialized and pushed ${ORG}/${repo}"
}

main() {
  log "=== FableForge Repository Initialization ==="

  command -v gh >/dev/null 2>&1 || { log "ERROR: gh CLI not found. Install from https://cli.github.com"; exit 1; }
  command -v git >/dev/null 2>&1 || { log "ERROR: git not found."; exit 1; }

  gh auth status >/dev/null 2>&1 || { log "ERROR: gh not authenticated. Run 'gh auth login'."; exit 1; }

  ensure_org

  log "--- Creating repositories ---"
  for repo in "${REPOS[@]}"; do
    create_repo "$repo"
  done

  log "--- Initializing and pushing local repos ---"
  for repo in "${REPOS[@]}"; do
    init_and_push "$repo"
  done

  log "=== Done! All ${#REPOS[@]} repos initialized. ==="
}

main "$@"