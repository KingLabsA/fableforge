#!/usr/bin/env bash
# train_all.sh — Master orchestration for all FableForge model training
#
# Runs the full 3-model pipeline:
#   1. Data download + conversion
#   2. FableForge-14B (4-stage SFT + DPO)
#   3. ShellWhisperer-1.5B (SFT + ONNX + GGUF export)
#   4. ReasonCritic-7B (3-stage: contrastive + LoRA + DPO)
#
# Requirements:
#   - Multi-GPU setup recommended (2+ A100-80GB)
#   - ~500GB disk for all models + data
#   - Python 3.10+ with PyTorch, transformers, peft, trl, bitsandbytes
#
# Estimated total time (4x A100-80GB):
#   Data:      ~30min (download + convert)
#   FF-14B:    ~45h
#   SW-1.5B:   ~4h
#   RC-7B:     ~10h
#   Exports:   ~4h
#   TOTAL:     ~63h (~2.6 days)
#
# Estimated costs (AWS p4d.24xlarge, 8x A100-80GB, $32.77/hr):
#   ~$170 total for complete pipeline
#
# Usage:
#   bash train_all.sh [--dry-run] [--stage {data,fableforge,shellwhisperer,reasoncritic,exports}]
#   bash train_all.sh --stage fableforge --stage 1   # Run just FableForge stage 1

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FABLEFORGE_DIR="${PROJECT_DIR}/fableforge-14b"
SHELL_WHISPERER_DIR="${PROJECT_DIR}/shell-whisperer"
REASON_CRITIC_DIR="${PROJECT_DIR}/reason-critic"
DATA_DIR="${FABLEFORGE_DIR}/data"

DRY_RUN=false
STAGES=()
SKIP_DATA=false

for arg in "$@"; do
    case "$arg" in
        --dry-run)   DRY_RUN=true ;;
        --skip-data) SKIP_DATA=true ;;
        --stage=*)
            stage="${arg#--stage=}"
            STAGES+=("$stage")
            ;;
        --stage)
            ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [--skip-data] [--stage {data,fableforge,shellwhisperer,reasoncritic,exports,all}]"
            echo ""
            echo "Stages:"
            echo "  data            Download and convert Fable-5 datasets"
            echo "  fableforge      Train FableForge-14B (all 4 sub-stages)"
            echo "  shellwhisperer  Train ShellWhisperer-1.5B"
            echo "  reasoncritic    Train ReasonCritic-7B"
            echo "  exports         Export all models to GGUF/ONNX"
            echo "  all             Run everything (default)"
            echo ""
            echo "Options:"
            echo "  --dry-run       Print commands without executing"
            echo "  --skip-data     Skip data download/conversion"
            exit 0
            ;;
    esac
done

if [[ ${#STAGES[@]} -eq 0 ]]; then
    STAGES=("all")
fi

# ─── Preflight Checks ───────────────────────────────────────────────────────

preflight() {
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║          FableForge Ecosystem Training Pipeline             ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Preflight checks..."
    echo ""

    # Check Python
    if ! command -v python3 &>/dev/null; then
        echo "[FAIL] Python 3 not found"
        exit 1
    fi
    echo "[OK]   Python: $(python3 --version)"

    # Check GPU
    if command -v nvidia-smi &>/dev/null; then
        GPU_COUNT=$(nvidia-smi --query-gpu=count --format=csv,noheader | head -1 | tr -d ' ')
        TOTAL_VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits | awk '{s+=$1}END{print s}')
        GPU_NAMES=$(nvidia-smi --query-gpu=name --format=csv,noheader | head -1)
        echo "[OK]   GPUs:    ${GPU_COUNT}x ${GPU_NAMES} (${TOTAL_VRAM}MB total)"
    else
        echo "[WARN] nvidia-smi not found — no GPU detected"
        echo "       Training will not work without CUDA GPUs"
        GPU_COUNT=0
        TOTAL_VRAM=0
    fi

    # Check disk
    DISK_AVAIL=$(df -h "$PROJECT_DIR" | awk 'NR==2{print $4}')
    DISK_AVAIL_GB=$(echo "$DISK_AVAIL" | sed 's/G//' | sed 's/T/000/' | awk '{printf "%.0f", $1}')
    echo "[OK]   Disk:    ${DISK_AVAIL} available"
    if [[ "${DISK_AVAIL_GB:-0}" -lt 200 ]] 2>/dev/null; then
        echo "[WARN] Low disk space. Recommended: 500GB+ for full pipeline"
    fi

    # Check Python packages
    echo ""
    echo "Checking Python packages..."
    python3 -c "
pkgs = {
    'torch': 'PyTorch',
    'transformers': 'Transformers',
    'peft': 'PEFT',
    'trl': 'TRL',
    'bitsandbytes': 'bitsandbytes',
    'datasets': 'Datasets',
    'accelerate': 'Accelerate',
    'wandb': 'Weights & Biases',
    'onnxruntime': 'ONNX Runtime',
    'scipy': 'SciPy',
}
missing = []
for pkg, name in pkgs.items():
    try:
        mod = __import__(pkg)
        ver = getattr(mod, '__version__', 'unknown')
        print(f'  [OK] {name}: {ver}')
    except ImportError:
        print(f'  [MISS] {name}: not installed')
        missing.append(pkg)
if missing:
    print(f'\\nInstall missing: pip install {\" \".join(missing)}')
" 2>/dev/null

    # Check wandb authentication
    if python3 -c "import wandb; wandb.login()" 2>/dev/null; then
        echo "[OK]   W&B:    authenticated"
    else
        echo "[WARN] W&B:       not authenticated. Run: wandb login"
    fi

    echo ""
    echo "Estimated resource requirements:"
    echo "  FableForge-14B:    80GB+ VRAM, ~200h GPU-time, ~200GB disk"
    echo "  ShellWhisperer-1.5B:  8GB+ VRAM, ~8h GPU-time, ~20GB disk"
    echo "  ReasonCritic-7B:     40GB+ VRAM, ~15h GPU-time, ~80GB disk"
    echo "  Data:                ~2GB download, ~10GB converted"
    echo "  Total disk:          ~310GB"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] Preflight complete (dry run mode)"
        return 0
    fi

    TOTAL_VRAM_NUM=${TOTAL_VRAM:-0}
    if [[ "${TOTAL_VRAM_NUM}" -lt 40000 ]] 2>/dev/null; then
        echo "[WARN] Insufficient VRAM (${TOTAL_VRAM_NUM}MB) for 14B model"
        echo "       Consider using Qwen/Qwen2.5-Coder-7B as an alternative"
        echo "       Or training models sequentially on a single GPU"
    fi
}

# ─── Stage: Data ─────────────────────────────────────────────────────────────

run_data() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Stage: Data Download & Conversion"
    echo "═══════════════════════════════════════════"
    echo ""

    if [[ "$SKIP_DATA" == "true" ]]; then
        echo "[SKIP] Data download skipped (--skip-data)"
        return 0
    fi

    # Download raw data
    echo "[1/2] Downloading Fable-5 datasets..."
    bash "${SCRIPT_DIR}/download_data.sh" ${DRY_RUN:+--dry-run}

    # Convert data
    echo ""
    echo "[2/2] Converting data to training formats..."
    python3 "${FABLEFORGE_DIR}/scripts/convert_data.py" \
        --output-dir "$DATA_DIR" \
        ${DRY_RUN:+--dry-run}

    echo ""
    echo "[OK] Data pipeline complete"
}

# ─── Stage: FableForge-14B ───────────────────────────────────────────────────

run_fableforge() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Stage: FableForge-14B"
    echo "═══════════════════════════════════════════"
    echo ""

    local ff_stage="${1:-all}"

    bash "${FABLEFORGE_DIR}/scripts/train.sh" \
        --stage "$ff_stage" \
        --data-dir "$DATA_DIR" \
        --output-dir "${FABLEFORGE_DIR}/output" \
        ${DRY_RUN:+--dry-run}
}

# ─── Stage: ShellWhisperer ──────────────────────────────────────────────────

run_shellwhisperer() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Stage: ShellWhisperer-1.5B"
    echo "═══════════════════════════════════════════"
    echo ""

    bash "${SHELL_WHISPERER_DIR}/scripts/train.sh" \
        --stage all \
        --data-dir "${SHELL_WHISPERER_DIR}/data" \
        --output-dir "${SHELL_WHISPERER_DIR}/output" \
        ${DRY_RUN:+--dry-run}
}

# ─── Stage: ReasonCritic ────────────────────────────────────────────────────

run_reasoncritic() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Stage: ReasonCritic-7B"
    echo "═══════════════════════════════════════════"
    echo ""

    local rc_stage="${1:-all}"

    bash "${REASON_CRITIC_DIR}/scripts/train.sh" \
        --stage "$rc_stage" \
        --data-dir "${REASON_CRITIC_DIR}/data" \
        --output-dir "${REASON_CRITIC_DIR}/output" \
        ${DRY_RUN:+--dry-run}
}

# ─── Stage: Exports ──────────────────────────────────────────────────────────

run_exports() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Stage: Model Exports (GGUF + ONNX)"
    echo "═══════════════════════════════════════════"
    echo ""

    # FableForge-14B GGUF
    if [[ -d "${FABLEFORGE_DIR}/output/stage4_dpo/final" ]]; then
        echo "[1/3] Exporting FableForge-14B to GGUF..."
        bash "${FABLEFORGE_DIR}/scripts/train.sh" \
            --stage export \
            ${DRY_RUN:+--dry-run}
    else
        echo "[SKIP] FableForge-14B not trained yet, skipping GGUF export"
    fi

    # ShellWhisperer ONNX + GGUF
    if [[ -d "${SHELL_WHISPERER_DIR}/output/sft/final" ]]; then
        echo "[2/3] Exporting ShellWhisperer to ONNX..."
        python3 "${SHELL_WHISPERER_DIR}/scripts/export_onnx.py" \
            --model-path "${SHELL_WHISPERER_DIR}/output/sft/final" \
            --output-dir "${SHELL_WHISPERER_DIR}/output/onnx" \
            --quantize-int8 \
            ${DRY_RUN:+--skip-benchmark}
    else
        echo "[SKIP] ShellWhisperer not trained yet, skipping ONNX export"
    fi

    # ReasonCritic GGUF
    if [[ -d "${REASON_CRITIC_DIR}/output/stage3_dpo/final" ]]; then
        echo "[3/3] Exporting ReasonCritic to GGUF..."
        bash "${REASON_CRITIC_DIR}/scripts/train.sh" \
            --stage export \
            ${DRY_RUN:+--dry-run}
    else
        echo "[SKIP] ReasonCritic not trained yet, skipping GGUF export"
    fi
}

# ─── Summary ─────────────────────────────────────────────────────────────────

print_summary() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║             Training Pipeline Complete                      ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Model artifacts:"
    echo ""

    for model_dir in "${FABLEFORGE_DIR}/output" "${SHELL_WHISPERER_DIR}/output" "${REASON_CRITIC_DIR}/output"; do
        model_name=$(basename "$(dirname "$model_dir")")
        if [[ -d "$model_dir" ]]; then
            echo "  $model_name/"
            find "$model_dir" -name "*.gguf" -o -name "*.onnx" -o -name "final" -type d | head -10 | while read -r f; do
                if [[ -d "$f" ]]; then
                    size=$(du -sh "$f" 2>/dev/null | awk '{print $1}')
                    echo "    $(basename "$f")/  ($size)"
                else
                    size=$(ls -lh "$f" 2>/dev/null | awk '{print $5}')
                    echo "    $(basename "$f")  ($size)"
                fi
            done
            echo ""
        fi
    done

    echo "Usage:"
    echo ""
    echo "  FableForge-14B (GGUF):"
    echo "    llama.cpp/main -m fableforge-14b-Q4_K_M.gguf -p \"implement a REST API\""
    echo ""
    echo "  ShellWhisperer-1.5B (ONNX):"
    echo "    python shell_whisperer/infer.py --onnx model_quantized.onnx"
    echo ""
    echo "  ReasonCritic-7B (GGUF):"
    echo "    llama.cpp/main -m reason-critic-7b-Q4_K_M.gguf -p \"verify this code\""
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
    preflight

    START_TIME=$(date +%s)

    for stage in "${STAGES[@]}"; do
        case "$stage" in
            all)
                run_data
                run_fableforge
                run_shellwhisperer
                run_reasoncritic
                run_exports
                ;;
            data)
                run_data
                ;;
            fableforge)
                run_fableforge
                ;;
            shellwhisperer)
                run_shellwhisperer
                ;;
            reasoncritic)
                run_reasoncritic
                ;;
            exports)
                run_exports
                ;;
            *)
                echo "Unknown stage: $stage"
                echo "Use: data, fableforge, shellwhisperer, reasoncritic, exports, or all"
                exit 1
                ;;
        esac
    done

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    HOURS=$((DURATION / 3600))
    MINS=$(((DURATION % 3600) / 60))

    echo ""
    echo "Total wall time: ${HOURS}h ${MINS}m"
    print_summary
}

main "$@"