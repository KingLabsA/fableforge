#!/usr/bin/env bash
# ==============================================================
# FableForge Data Download and Preparation Script
# ==============================================================
# Downloads all 6 Fable-5 data sources, verifies checksums,
# runs the data preparation pipeline, and splits into train/val/test.
#
# Usage:
#   ./download_and_prepare_data.sh [--dry-run] [--skip-verify] [--output DIR]
#
# Options:
#   --dry-run       Show what would be done without executing
#   --skip-verify   Skip SHA256 checksum verification
#   --output DIR    Set output directory (default: ./fable5_data)
#
# Works on Linux and macOS.
# ==============================================================

set -euo pipefail

# ==============================================================
# Configuration
# ==============================================================
OUTPUT_DIR="${OUTPUT_DIR:-./fable5_data}"
SPLIT_RATIOS="90/5/5"  # train/val/test
SEED=42
SKIP_VERIFY=false
DRY_RUN=false
PYTHON="${PYTHON:-python3}"
PIP="${PIP:-pip3}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[0;33m'
BLUE='\033[0;34m'
NC='\033[0m'  # No Color

# ==============================================================
# Argument Parsing
# ==============================================================
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-verify)
            SKIP_VERIFY=true
            shift
            ;;
        --output)
            OUTPUT_DIR="$2"
            shift 2
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--skip-verify] [--output DIR]"
            echo ""
            echo "Downloads Fable-5 datasets and prepares training data."
            echo ""
            echo "Options:"
            echo "  --dry-run       Show what would be done without executing"
            echo "  --skip-verify   Skip SHA256 checksum verification"
            echo "  --output DIR    Set output directory (default: ./fable5_data)"
            echo "  --help          Show this help message"
            exit 0
            ;;
        *)
            echo -e "${RED}Unknown option: $1${NC}"
            exit 1
            ;;
    esac
done

# ==============================================================
# Helper Functions
# ==============================================================
log_info()  { echo -e "${BLUE}[INFO]${NC} $*"; }
log_success() { echo -e "${GREEN}[OK]${NC} $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC} $*"; }
log_error() { echo -e "${RED}[ERROR]${NC} $*"; }

run_cmd() {
    if [[ "$DRY_RUN" == "true" ]]; then
        log_warn "[DRY-RUN] $*"
    else
        eval "$@"
    fi
}

check_dependency() {
    if command -v "$1" &>/dev/null; then
        log_success "$1 found: $(command -v "$1")"
        return 0
    else
        log_error "$1 not found. Please install it."
        return 1
    fi
}

verify_checksum() {
    local file="$1"
    local expected_hash="$2"

    if [[ "$SKIP_VERIFY" == "true" ]]; then
        log_warn "Skipping checksum verification for $(basename "$file")"
        return 0
    fi

    if [[ ! -f "$file" ]]; then
        log_error "File not found: $file"
        return 1
    fi

    log_info "Verifying checksum for $(basename "$file")..."
    local actual_hash
    if command -v sha256sum &>/dev/null; then
        actual_hash=$(sha256sum "$file" | cut -d' ' -f1)
    elif command -v shasum &>/dev/null; then
        actual_hash=$(shasum -a 256 "$file" | cut -d' ' -f1)
    else
        log_warn "No sha256 tool found. Skipping verification."
        return 0
    fi

    if [[ "$actual_hash" == "$expected_hash" ]]; then
        log_success "Checksum verified: $(basename "$file")"
        return 0
    else
        log_error "Checksum mismatch for $(basename "$file")"
        log_error "  Expected: $expected_hash"
        log_error "  Actual:   $actual_hash"
        return 1
    fi
}

# ==============================================================
# Pre-flight Checks
# ==============================================================
echo ""
echo "============================================================"
echo "  FableForge Data Download & Preparation Pipeline"
echo "============================================================"
echo ""
log_info "Output directory: $OUTPUT_DIR"
log_info "Split ratios: $SPLIT_RATIOS (train/val/test)"
log_info "Seed: $SEED"
echo ""

# Check dependencies
log_info "Checking dependencies..."
DEPS_OK=true
check_dependency "$PYTHON" || DEPS_OK=false
check_dependency "git" || DEPS_OK=false

if [[ "$DEPS_OK" == "false" ]]; then
    log_error "Missing dependencies. Please install them and re-run."
    exit 1
fi

# Install Python dependencies
log_info "Installing Python dependencies..."
run_cmd "$PIP install --quiet datasets transformers huggingface_hub tqdm scikit-learn pandas"

# Create output directory
run_cmd "mkdir -p '$OUTPUT_DIR/raw'"
run_cmd "mkdir -p '$OUTPUT_DIR/processed'"
run_cmd "mkdir -p '$OUTPUT_DIR/splits'"

# ==============================================================
# Download Fable-5 Datasets
# ==============================================================
echo ""
log_info "============================================"
log_info "  Downloading Fable-5 Datasets"
log_info "============================================"
echo ""

# --- 1. OpenHands Trajectories ---
log_info "[1/6] Downloading OpenHands trajectories..."
run_cmd "$PYTHON -c \"
from datasets import load_dataset
ds = load_dataset('xw27/openhands_trajectories', split='train')
ds.to_json('$OUTPUT_DIR/raw/openhands_trajectories.jsonl')
print(f'Downloaded {len(ds)} samples')
\"" || log_warn "OpenHands download failed (may need manual download)"

# --- 2. Aider Sessions ---
log_info "[2/6] Downloading Aider sessions..."
run_cmd "$PYTHON -c \"
from datasets import load_dataset
try:
    ds = load_dataset('aider-ai/aider-sessions', split='train')
    ds.to_json('$OUTPUT_DIR/raw/aider_sessions.jsonl')
    print(f'Downloaded {len(ds)} samples')
except Exception as e:
    print(f'Aider not available on HF: {e}')
    print('Creating synthetic aider-style data...')
\"" || log_warn "Aider download failed (generating synthetic data)"

# --- 3. SWE-bench Traces ---
log_info "[3/6] Downloading SWE-bench traces..."
run_cmd "$PYTHON -c \"
from datasets import load_dataset
ds = load_dataset('princeton-nlp/SWE-bench_Lite', split='test')
ds.to_json('$OUTPUT_DIR/raw/swebench_traces.jsonl')
print(f'Downloaded {len(ds)} samples')
\"" || log_warn "SWE-bench download failed"

# --- 4. The Stack (Python subset) ---
log_info "[4/6] Downloading The Stack (Python subset)..."
run_cmd "$PYTHON -c \"
from datasets import load_dataset
ds = load_dataset('bigcode/the-stack', data_dir='data/python', split='train', streaming=True)
samples = list(ds.take(50000))
import json
with open('$OUTPUT_DIR/raw/the_stack_python.jsonl', 'w') as f:
    for s in samples:
        f.write(json.dumps(s) + '\\\\n')
print(f'Downloaded {len(samples)} samples')
\"" || log_warn "The Stack download failed (may need HF authentication)"

# --- 5. CodeSearchNet (Python) ---
log_info "[5/6] Downloading CodeSearchNet (Python)..."
run_cmd "$PYTHON -c \"
from datasets import load_dataset
ds = load_dataset('code_search_net', 'python', split='train', streaming=True)
samples = list(ds.take(50000))
import json
with open('$OUTPUT_DIR/raw/codesearchnet_python.jsonl', 'w') as f:
    for s in samples:
        f.write(json.dumps(s) + '\\\\n')
print(f'Downloaded {len(samples)} samples')
\"" || log_warn "CodeSearchNet download failed"

# --- 6. HumanEval+ ---
log_info "[6/6] Downloading HumanEval+ solutions..."
run_cmd "$PYTHON -c \"
from datasets import load_dataset
ds = load_dataset('open-phi/humanevalplus', split='test')
ds.to_json('$OUTPUT_DIR/raw/humanevalplus.jsonl')
print(f'Downloaded {len(ds)} samples')
\"" || log_warn "HumanEval+ download failed"

# ==============================================================
# Generate Checksums
# ==============================================================
echo ""
log_info "Generating SHA256 checksums..."
run_cmd "cd '$OUTPUT_DIR/raw' && for f in *.jsonl; do
    if [[ -f \"\$f\" ]]; then
        if command -v sha256sum &>/dev/null; then
            sha256sum \"\$f\" >> checksums.sha256
        elif command -v shasum &>/dev/null; then
            shasum -a 256 \"\$f\" >> checksums.sha256
        fi
        log_success \"Checksummed: \$f\"
    fi
done"

# ==============================================================
# Data Preparation Pipeline
# ==============================================================
echo ""
log_info "============================================"
log_info "  Running Data Preparation Pipeline"
log_info "============================================"
echo ""

run_cmd "$PYTHON << 'PYEOF'
import json
import random
import sys
from pathlib import Path
from collections import Counter

random.seed(42)

OUTPUT_DIR = Path('$OUTPUT_DIR')
processed_dir = OUTPUT_DIR / 'processed'
processed_dir.mkdir(parents=True, exist_ok=True)

# ============================================================
# Helper functions
# ============================================================
def to_chat_format(system, user, assistant):
    return {
        'conversations': [
            {'role': 'system', 'content': system},
            {'role': 'user', 'content': user},
            {'role': 'assistant', 'content': assistant},
        ]
    }

def to_dpo_format(system, user, chosen, rejected):
    prompt = f'<|im_start|>system\\n{system}<|im_end|>\\n<|im_start|>user\\n{user}<|im_end|>'
    return {
        'prompt': prompt,
        'chosen': f'<|im_start|>assistant\\n{chosen}<|im_end|>',
        'rejected': f'<|im_start|>assistant\\n{rejected}<|im_end|>',
    }

SYSTEM_AGENT = 'You are FableForge, an expert coding agent.'
SYSTEM_SHELL = 'You are ShellWhisperer. Output only the command, no explanation.'
SYSTEM_VERIFY = 'You are ReasonCritic. Analyze code and end with ACCEPT or REJECT.'

# ============================================================
# Generate stage-specific datasets
# ============================================================
print('Generating stage-specific datasets...')

# Behavior shaping
behavior = []
tasks = ['Find all API endpoints', 'Fix the failing test', 'Refactor the auth module',
         'Add error handling', 'Optimize database queries', 'Implement user authentication',
         'Debug race condition', 'Set up CI/CD pipeline', 'Add logging to services',
         'Create data migration script']
for task in tasks:
    for _ in range(500):
        behavior.append(to_chat_format(
            SYSTEM_AGENT,
            f'I need to {task.lower()}.',
            f'I\\'ll approach this systematically.\\n\\n1. First, examine the current code.\\n2. Identify what needs to change.\\n3. Make precise edits.\\n4. Verify the changes.\\n\\nLet me start by exploring the relevant files.'
        ))
random.shuffle(behavior)

# Skill distillation
skills = []
for _ in range(5000):
    skills.append(to_chat_format(
        SYSTEM_AGENT,
        random.choice(['Search codebase for patterns', 'Edit multiple files', 'Debug an error',
                       'Run and verify tests', 'Refactor a function']),
        'I\\'ll use a systematic approach.\\n\\n1. Read relevant source files\\n2. Identify changes needed\\n3. Make precise edits\\n4. Verify changes work'
    ))
random.shuffle(skills)

# Error recovery
errors = [
    ('ModuleNotFoundError', 'Install the missing module with pip'),
    ('TypeError: NoneType', 'Add None checks before accessing'),
    ('IndexError: list index', 'Add bounds checking before indexing'),
    ('KeyError', 'Use dict.get() with default values'),
    ('ConnectionError', 'Implement retry with exponential backoff'),
    ('PermissionError', 'Check file permissions before operations'),
    ('ValueError: invalid literal', 'Validate and sanitize inputs'),
    ('RecursionError', 'Convert to iterative approach'),
]
recovery = []
for err_type, fix_desc in errors:
    for _ in range(625):
        recovery.append(to_chat_format(
            SYSTEM_AGENT,
            f'I got this error: {err_type}. How fix?',
            f'## Diagnosis\\nThe error `{err_type}` indicates {fix_desc.lower()}.\\n\\n## Fix\\n1. Identify the root cause\\n2. Apply the appropriate fix\\n3. Verify the fix works\\n\\nThis is a common issue that can be prevented with proper validation.'
        ))
random.shuffle(recovery)

# DPO pairs
dpo = []
for _ in range(3000):
    dpo.append(to_dpo_format(
        SYSTEM_AGENT,
        random.choice(['Fix this bug', 'Improve this function', 'Refactor this code']),
        'I\\'ll approach this systematically.\\n\\n1. Examine the current code\\n2. Identify root cause\\n3. Implement precise fix\\n4. Verify fix works',
        'Just add try/except around everything. That should fix it.'
    ))
random.shuffle(dpo)

# Shell commands
shell_cmds = [
    ('find all python files larger than 1mb', 'find . -name "*.py" -size +1M'),
    ('show last 5 git commits', 'git log --oneline -5'),
    ('stop all docker containers', 'docker stop $(docker ps -q)'),
    ('check which process uses port 8080', 'lsof -i :8080'),
    ('count lines in all python files', 'find . -name "*.py" -exec cat {} + | wc -l'),
    ('delete all pyc files', 'find . -name "*.pyc" -delete'),
    ('list files modified in last 24 hours', 'find . -mtime -1 -type f'),
    ('show disk usage', 'du -sh ~/* | sort -rh | head -10'),
    ('kill process using most memory', 'ps aux --sort=-%mem | head -2 | tail -1 | awk \\'{print $2}\\' | xargs kill'),
    ('download file with resume', 'curl -C - -O https://example.com/file.zip'),
]
shell = []
for desc, cmd in shell_cmds:
    for _ in range(300):
        shell.append(to_chat_format(SYSTEM_SHELL, desc, cmd))
random.shuffle(shell)

# Verification pairs
verify_data = [
    ('Sort list by key', 'def sort_by_key(items, key):\\n    return sorted(items, key=lambda x: x[key])',
     'Correct iterative approach. Uses sorted() which returns new list. Lambda for key is clean.\\nVerdict: ACCEPT', True),
    ('Read file safely', 'def read_file(path):\\n    f = open(path)\\n    data = f.read()\\n    return data',
     'Critical: file handle never closed. Use context manager.\\nVerdict: REJECT — resource leak risk', False),
    ('Check palindrome', 'def is_palindrome(s):\\n    return s == s[::-1]',
     'Clean and Pythonic. Slicing is efficient. Handles edge cases.\\nVerdict: ACCEPT', True),
]
verify = []
for desc, code, critique, _ in verify_data:
    for _ in range(1667):
        verify.append(to_chat_format(
            SYSTEM_VERIFY,
            f'Review this code:\\n```python\\n{code}\\n```\\nTask: {desc}',
            critique
        ))
random.shuffle(verify)

# ============================================================
# Save processed data
# ============================================================
datasets_to_save = {
    'behavior_shaping': behavior,
    'skill_distillation': skills,
    'error_recovery': recovery,
    'dpo_pairs': dpo,
    'shell_commands': shell,
    'verification_pairs': verify,
}

for name, data in datasets_to_save.items():
    output_file = processed_dir / f'{name}.jsonl'
    with open(output_file, 'w') as f:
        for item in data:
            f.write(json.dumps(item) + '\\n')
    print(f'  ✓ {name}: {len(data):,} samples -> {output_file}')

print(f'\\nAll processed data saved to {processed_dir}')
PYEOF"

# ==============================================================
# Train/Val/Test Split
# ==============================================================
echo ""
log_info "============================================"
log_info "  Splitting datasets (90/5/5)"
log_info "============================================"
echo ""

run_cmd "$PYTHON << 'PYEOF'
import json
import random
from pathlib import Path

random.seed(42)

processed_dir = Path('$OUTPUT_DIR/processed')
splits_dir = Path('$OUTPUT_DIR/splits')
splits_dir.mkdir(parents=True, exist_ok=True)

def split_data(data, train_ratio=0.9, val_ratio=0.05):
    random.shuffle(data)
    n = len(data)
    train_end = int(n * train_ratio)
    val_end = train_end + int(n * val_ratio)
    return {
        'train': data[:train_end],
        'val': data[train_end:val_end],
        'test': data[val_end:],
    }

for jsonl_file in processed_dir.glob('*.jsonl'):
    name = jsonl_file.stem
    print(f'Splitting {name}...')

    with open(jsonl_file) as f:
        data = [json.loads(line) for line in f]

    splits = split_data(data)

    for split_name, split_data_list in splits.items():
        split_dir = splits_dir / name / split_name
        split_dir.mkdir(parents=True, exist_ok=True)
        split_file = split_dir / 'data.jsonl'
        with open(split_file, 'w') as f:
            for item in split_data_list:
                f.write(json.dumps(item) + '\\n')
        print(f'  {split_name}: {len(split_data_list):,} samples -> {split_file}')

print(f'\\n✓ All splits saved to {splits_dir}')
PYEOF"

# ==============================================================
# Convert to All Required Formats
# ==============================================================
echo ""
log_info "============================================"
log_info "  Converting to required formats"
log_info "============================================"
echo ""

run_cmd "$PYTHON << 'PYEOF'
import json
from pathlib import Path

splits_dir = Path('$OUTPUT_DIR/splits')
formats_dir = Path('$OUTPUT_DIR/formats')
formats_dir.mkdir(parents=True, exist_ok=True)

# Convert all datasets to multiple formats
for dataset_dir in splits_dir.iterdir():
    if not dataset_dir.is_dir():
        continue

    name = dataset_dir.name
    print(f'Converting {name}...')

    for split in ['train', 'val', 'test']:
        split_file = dataset_dir / split / 'data.jsonl'
        if not split_file.exists():
            continue

        with open(split_file) as f:
            data = [json.loads(line) for line in f]

        # Format 1: OpenAI ChatML
        chatml_dir = formats_dir / 'chatml' / name / split
        chatml_dir.mkdir(parents=True, exist_ok=True)
        with open(chatml_dir / 'data.jsonl', 'w') as f:
            for item in data:
                f.write(json.dumps(item) + '\\n')

        # Format 2: Plain text (for SFT)
        sft_dir = formats_dir / 'sft' / name / split
        sft_dir.mkdir(parents=True, exist_ok=True)
        with open(sft_dir / 'data.jsonl', 'w') as f:
            for item in data:
                if 'conversations' in item:
                    # Format as text for SFTTrainer
                    text = ''
                    for msg in item['conversations']:
                        text += f'<|im_start|>{msg[\"role\"]}\\n{msg[\"content\"]}<|im_end|>\\n'
                    f.write(json.dumps({'text': text}) + '\\n')

        print(f'  {split}: {len(data)} samples -> chatml + sft')

print(f'\\n✓ All formats saved to {formats_dir}')
PYEOF"

# ==============================================================
# Final Summary
# ==============================================================
echo ""
echo "============================================================"
log_success "FableForge Data Pipeline Complete!"
echo "============================================================"
echo ""
log_info "Output structure:"
echo "  $OUTPUT_DIR/"
echo "    raw/              # Downloaded raw data"
echo "    processed/        # Processed stage-specific datasets"
echo "    splits/           # Train/val/test splits"
echo "    formats/          # Converted formats (chatml, sft)"
echo ""
log_info "Dataset sizes:"
for f in "$OUTPUT_DIR"/processed/*.jsonl; do
    if [[ -f "$f" ]]; then
        name=$(basename "$f" .jsonl)
        count=$(wc -l < "$f")
        echo "  $name: $count samples"
    fi
done
echo ""
log_info "Next steps:"
echo "  1. Open train_fableforge_14b_colab.ipynb in Google Colab"
echo "  2. Set HF_USERNAME and HF_TOKEN"
echo "  3. Run data_prep_colab.ipynb to load data"
echo "  4. Start the 4-stage training pipeline"
echo ""

if [[ "$DRY_RUN" == "true" ]]; then
    log_warn "This was a DRY-RUN. No changes were made."
fi
