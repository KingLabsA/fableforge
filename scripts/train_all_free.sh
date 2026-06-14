#!/usr/bin/env bash
# train_all_free.sh — Master training script for ALL FableForge models
# using only FREE resources (Google Colab T4, local hardware, Axolotl)
#
# Supported modes:
#   --unsloth         Use Unsloth (2-5x faster, 70% less VRAM)
#   --colab           Optimize for Google Colab T4 (15GB VRAM, fp16)
#   --free-tier       Combine --unsloth + --colab + conservative memory
#   --axolotl         Use Axolotl for training (alternative to Unsloth)
#   --local           Detect local hardware and optimize settings
#   --dry-run         Print config and exit
#   --stage N         Run only specific stage (1=data, 2=fableforge, 3=shellwhisperer, 4=reasoncritic, 5=exports)
#   --model MODEL     Run only specific model (fableforge, shellwhisperer, reasoncritic)
#
# Hardware detection:
#   - Colab T4 (15GB):    Uses Unsloth + 4-bit quantization, fp16, batch=1-2
#   - Local Mac (MPS):    Falls back to CPU-compatible settings
#   - Local GPU (≤16GB):  Uses Unsloth 4-bit, conservative batch sizes
#   - Local GPU (>16GB):  Uses Unsloth 4-bit, moderate batch sizes
#   - Multi-GPU:         Uses accelerate for multi-GPU training
#
# Free training times (Colab T4, Unsloth mode):
#   FableForge-14B:    ~17h (4 stages, sequential, with Drive persistence)
#   ShellWhisperer-1.5B: ~2h
#   ReasonCritic-7B:     ~10h (3 stages)
#   Total:               ~29h across sessions
#
# Usage:
#   bash train_all_free.sh                     # Full pipeline, auto-detect hardware
#   bash train_all_free.sh --free-tier         # Colab T4 free tier mode
#   bash train_all_free.sh --model shellwhisperer  # Just ShellWhisperer
#   bash train_all_free.sh --stage 2 --free-tier   # Just FableForge stage
#   bash train_all_free.sh --dry-run           # Print config, don't train
#   bash train_all_free.sh --unsloth --colab   # Unsloth + Colab optimizations

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
FABLEFORGE_DIR="${PROJECT_DIR}/fableforge-14b"
SHELL_WHISPERER_DIR="${PROJECT_DIR}/shell-whisperer"
REASON_CRITIC_DIR="${PROJECT_DIR}/reason-critic"

# ─── Default Configuration ───────────────────────────────────────────────────

UNSLOTH=false
COLAB=false
FREE_TIER=false
AXOLOTL=false
LOCAL_MODE=false
DRY_RUN=false
STAGES=()
MODELS=()
STAGE_NUM=""
MODEL_FILTER=""

for arg in "$@"; do
    case "$arg" in
        --unsloth)     UNSLOTH=true ;;
        --colab)       COLAB=true ;;
        --free-tier)   FREE_TIER=true ;;
        --axolotl)     AXOLOTL=true ;;
        --local)       LOCAL_MODE=true ;;
        --dry-run)     DRY_RUN=true ;;
        --stage=*)     STAGE_NUM="${arg#--stage=}" ;;
        --model=*)     MODEL_FILTER="${arg#--model=}" ;;
    esac
done

# --free-tier implies --unsloth + --colab
if [[ "$FREE_TIER" == "true" ]]; then
    UNSLOTH=true
    COLAB=true
fi

if [[ ${#STAGES[@]} -eq 0 ]] && [[ -z "$STAGE_NUM" ]]; then
    STAGES=("all")
fi

# ─── Hardware Detection ──────────────────────────────────────────────────────

detect_hardware() {
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║     FableForge Free-Tier Training Pipeline                  ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""
    echo "Detecting hardware..."
    echo ""

    # Detect Google Colab
    local is_colab=false
    if [[ -f "/content/.colab_running" ]] || [[ -d "/content/drive" ]] || [[ -n "${COLAB_RUNTIME_ENV+x}" ]]; then
        is_colab=true
        COLAB=true
        echo "  ✓ Environment:  Google Colab"
    elif [[ "$(uname -s)" == "Darwin" ]] && [[ "$(sysctl -n hw.optional.arm64 2>/dev/null || echo 0)" == "1" ]]; then
        echo "  ✓ Environment:  Apple Silicon Mac (MPS)")
        LOCAL_MODE=true
    else
        echo "  ✓ Environment:  Local machine"
        LOCAL_MODE=true
    fi

    # Detect GPU
    local gpu_name="CPU"
    local vram_mb=0
    local gpu_count=0

    if command -v nvidia-smi &>/dev/null; then
        gpu_count=$(nvidia-smi --query-gpu=count --format=csv,noheader 2>/dev/null | head -1 | tr -d ' ' || echo "0")
        gpu_name=$(nvidia-smi --query-gpu=name --format=csv,noheader 2>/dev/null | head -1 || echo "Unknown")
        vram_mb=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | awk '{s+=$1}END{print s}' || echo "0")
        gpu_count=${gpu_count:-1}
        vram_mb=${vram_mb:-0}
        echo "  ✓ GPUs:         ${gpu_count}x ${gpu_name} (${vram_mb}MB)"
    else
        echo "  ⚠ No NVIDIA GPU detected"
        if [[ "$LOCAL_MODE" == "true" ]]; then
            echo "    Training will use CPU (very slow) or MPS (Apple Silicon)"
        fi
    fi

    # Detect Python
    if command -v python3 &>/dev/null; then
        echo "  ✓ Python:       $(python3 --version 2>&1 || echo 'unknown')"
    else
        echo "  ✗ Python 3 not found"
        return 1
    fi

    # Check Unsloth availability
    if [[ "$UNSLOTH" == "true" ]]; then
        if python3 -c "import unsloth" 2>/dev/null; then
            echo "  ✓ Unsloth:      $(python3 -c 'import unsloth; print(unsloth.__version__)' 2>/dev/null || echo 'installed')"
        else
            echo "  ⚠ Unsloth not installed. Install with: pip install unsloth[colab-new]"
            echo "    Installing now..."
            pip install --no-deps "unsloth[colab-new]" --quiet 2>/dev/null || \
            pip install "unsloth" --quiet 2>/dev/null || true
            if python3 -c "import unsloth" 2>/dev/null; then
                echo "  ✓ Unsloth:      installed"
            else
                echo "  ✗ Unsloth installation failed. Falling back to standard transformers."
                UNSLOTH=false
            fi
        fi
    fi

    # Auto-configure based on hardware
    echo ""
    echo "Auto-configuring for detected hardware..."
    echo ""

    local vram_gb=$((vram_mb / 1024))

    if [[ "$COLAB" == "true" ]]; then
        echo "  Mode:           Colab T4 (free tier)"
        echo "  Backend:        Unsloth + 4-bit QLoRA"
        echo "  Batch size:     1-2 (memory-optimized)"
        echo "  Precision:      fp16 (T4 has no bf16)"
        echo "  Grad checkpoint: Unsloth optimized"
        echo "  Drive sync:     Enabled"
        export FREE_TIER_MODE=1
        export TRAINING_BACKEND="unsloth"
        export TRAINING_DTYPE="fp16"
        export MAX_SEQ_LEN=4096
        export DEFAULT_BATCH_SIZE=1
        export DEFAULT_GRAD_ACCUM=16

    elif [[ "$vram_gb" -ge 80 ]]; then
        echo "  Mode:           Multi-GPU / A100-80GB"
        echo "  Backend:        ${UNSLOTH:+Unsloth}${UNSLOTH:-standard}"
        echo "  Batch size:     4-8"
        export TRAINING_BACKEND="${UNSLOTH:+unsloth}${UNSLOTH:-transformers}"
        export TRAINING_DTYPE="bf16"
        export MAX_SEQ_LEN=4096
        export DEFAULT_BATCH_SIZE=4
        export DEFAULT_GRAD_ACCUM=4

    elif [[ "$vram_gb" -ge 24 ]]; then
        echo "  Mode:           Single high-VRAM GPU (24GB+)"
        echo "  Backend:        ${UNSLOTH:+Unsloth}${UNSLOTH:-standard}"
        echo "  Batch size:     2-4"
        export TRAINING_BACKEND="${UNSLOTH:+unsloth}${UNSLOTH:-transformers}"
        export TRAINING_DTYPE="bf16"
        export MAX_SEQ_LEN=4096
        export DEFAULT_BATCH_SIZE=2
        export DEFAULT_GRAD_ACCUM=8

    elif [[ "$vram_gb" -ge 8 ]]; then
        echo "  Mode:           Consumer GPU (8-24GB)"
        echo "  Backend:        Unsloth (recommended)"
        echo "  Batch size:     1-2 (memory-optimized)"
        if [[ "$UNSLOTH" != "true" ]]; then
            echo "  ⚠ Recommend --unsloth flag for better performance on this hardware"
            UNSLOTH=true
        fi
        export TRAINING_BACKEND="unsloth"
        export TRAINING_DTYPE="fp16"
        export MAX_SEQ_LEN=4096
        export DEFAULT_BATCH_SIZE=1
        export DEFAULT_GRAD_ACCUM=16

    else
        echo "  Mode:           CPU / Apple Silicon (MPS)"
        echo "  Backend:        Unsloth (CPU/MPS mode)"
        echo "  ⚠ WARNING: Training on CPU will be very slow (10-100x slower)"
        echo "  Recommend using Google Colab T4 for free GPU access"
        export TRAINING_BACKEND="unsloth"
        export TRAINING_DTYPE="fp32"
        export MAX_SEQ_LEN=2048
        export DEFAULT_BATCH_SIZE=1
        export DEFAULT_GRAD_ACCUM=32
    fi

    echo ""
    echo "  Max seq length:  ${MAX_SEQ_LEN}"
    echo "  Default batch:   ${DEFAULT_BATCH_SIZE}"
    echo "  Grad accum:     ${DEFAULT_GRAD_ACCUM}"
    echo "  Dry run:        ${DRY_RUN}"
    echo ""
}

# ─── Data Download ────────────────────────────────────────────────────────────

run_data_download() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Stage: Data Download & Conversion"
    echo "═══════════════════════════════════════════"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] Would download and convert Fable-5 datasets"
        return 0
    fi

    local data_script="${SCRIPT_DIR}/download_data.sh"
    if [[ -f "$data_script" ]]; then
        echo "[INFO] Running download_data.sh..."
        bash "$data_script"
    else
        echo "[INFO] download_data.sh not found, downloading directly..."
        python3 << 'DOWNLOAD_SCRIPT'
import os
from datasets import load_dataset
from pathlib import Path

project_dir = os.environ.get("PROJECT_DIR", "/tmp/fableforge")
data_dirs = [
    f"{project_dir}/fableforge-14b/data",
    f"{project_dir}/shell-whisperer/data",
    f"{project_dir}/reason-critic/data",
]
for d in data_dirs:
    os.makedirs(d, exist_ok=True)

print("Downloading Fable-5 datasets from HuggingFace...")
try:
    ds = load_dataset("fableforge/fable-5", revision="main")
    for split in ds.keys():
        split_data = ds[split]
        for data_dir in data_dirs:
            output_path = os.path.join(data_dir, f"fable5_{split}.jsonl")
            import json
            with open(output_path, "w") as f:
                for example in split_data:
                    f.write(json.dumps(example) + "\n")
            print(f"  {split}: {len(split_data)} examples -> {output_path}")
except Exception as e:
    print(f"  Fable-5 download failed: {e}")
    print("  Generating synthetic data for testing...")
    import random
    random.seed(42)
    for data_dir in data_dirs:
        synthetic = [{"instruction": f"test instruction {i}", "input": "", "output": f"test output {i}"}
                     for i in range(100)]
        import json
        with open(os.path.join(data_dir, "fable5_train.jsonl"), "w") as f:
            for item in synthetic[:80]:
                f.write(json.dumps(item) + "\n")
        with open(os.path.join(data_dir, "fable5_val.jsonl"), "w") as f:
            for item in synthetic[80:]:
                f.write(json.dumps(item) + "\n")
        print(f"  Synthetic data generated for {data_dir}")

print("Data download complete")
DOWNLOAD_SCRIPT
    fi

    # Run data conversion
    local convert_script="${FABLEFORGE_DIR}/scripts/convert_data.py"
    if [[ -f "$convert_script" ]]; then
        echo "[INFO] Converting data to training formats..."
        python3 "$convert_script" --output-dir "${FABLEFORGE_DIR}/data" || true
    fi

    echo "[OK] Data pipeline complete"
}

# ─── FableForge-14B ──────────────────────────────────────────────────────────

run_fableforge() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Model: FableForge-14B"
    echo "═══════════════════════════════════════════"
    echo ""

    local train_script="${FABLEFORGE_DIR}/scripts/train.sh"
    local train_args=("--stage" "all")

    if [[ "$UNSLOTH" == "true" ]]; then
        train_args+=("--unsloth")
    fi
    if [[ "$COLAB" == "true" ]]; then
        train_args+=("--colab")
    fi
    if [[ "$FREE_TIER" == "true" ]]; then
        train_args+=("--free-tier")
    fi
    if [[ "$DRY_RUN" == "true" ]]; then
        train_args+=("--dry-run")
    fi
    if [[ -n "$STAGE_NUM" ]] && [[ "$MODEL_FILTER" == "fableforge" || -z "$MODEL_FILTER" ]]; then
        train_args=("--stage" "$STAGE_NUM" "${train_args[@]:2}")
    fi

    if [[ "$AXOLOTL" == "true" ]]; then
        echo "[INFO] Axolotl mode — using Axolotl instead of train.sh"
        run_fableforge_axolotl
        return
    fi

    # Prefer Colab notebook if on Colab and it exists
    if [[ "$COLAB" == "true" ]] && [[ -f "${FABLEFORGE_DIR}/scripts/train_colab.ipynb" ]]; then
        echo "[INFO] Colab mode detected. For interactive training, use train_colab.ipynb"
        echo "       For automated training, using train.sh with --colab flag"
        echo ""
    fi

    echo "[INFO] Running: bash $train_script ${train_args[*]}"
    bash "$train_script" "${train_args[@]}"
}

run_fableforge_axolotl() {
    echo "[INFO] Axolotl training for FableForge-14B"
    echo "       Axolotl provides declarative YAML config for fine-tuning"

    # Check if axolotl is installed
    if ! command -v axolotl &>/dev/null && ! python3 -c "import axolotl" 2>/dev/null; then
        echo "[INFO] Installing Axolotl..."
        pip install axolotl[deepspeed] --quiet 2>/dev/null || {
            echo "[ERROR] Axolotl installation failed"
            echo "        Install manually: pip install axolotl[deepspeed]"
            echo "        Falling back to Unsloth/standard training"
            run_fableforge
            return
        }
    fi

    local axolotl_config="${FABLEFORGE_DIR}/configs/axolotl_qlora.yml"
    if [[ -f "$axolotl_config" ]]; then
        echo "Found Axolotl config: $axolotl_config"
        if [[ "$DRY_RUN" != "true" ]]; then
            accelerate launch -m axolotl.cli.train "$axolotl_config"
        fi
    else
        echo "[WARN] No Axolotl config found at $axolotl_config"
        echo "       Generate one with: python -m axolotl.cli.gen_config"
        echo "       Falling back to Unsloth training"
        run_fableforge
    fi
}

# ─── ShellWhisperer-1.5B ──────────────────────────────────────────────────────

run_shellwhisperer() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Model: ShellWhisperer-1.5B"
    echo "═══════════════════════════════════════════"
    echo ""

    local train_script="${SHELL_WHISPERER_DIR}/scripts/train.sh"
    local train_args=("--stage" "all")

    if [[ "$DRY_RUN" == "true" ]]; then
        train_args+=("--dry-run")
    fi

    if [[ "$COLAB" == "true" ]] && [[ -f "${SHELL_WHISPERER_DIR}/scripts/train_colab.ipynb" ]]; then
        echo "[INFO] Colab mode: Use train_colab.ipynb for interactive training"
        echo "       (~2 hours on T4 with Unsloth)"
        echo ""
        if [[ "$DRY_RUN" != "true" ]]; then
            echo "       To run the notebook programmatically:"
            echo "       jupyter nbconvert --execute ${SHELL_WHISPERER_DIR}/scripts/train_colab.ipynb"
        fi
        return
    fi

    # Modify train.sh args for Unsloth if requested
    local use_unsloth_flag=""
    if [[ "$UNSLOTH" == "true" ]]; then
        # Run the train script with Unsloth Python wrapper
        echo "[INFO] Running ShellWhisperer with Unsloth..."
        USE_UNSLOTH=1 python3 << 'SHELLWHISPERER_UNSLOTH'
import os
import sys

# ShellWhisperer Unsloth training
# Uses the same config as train_colab.ipynb but runs as a script
from unsloth import FastLanguageModel
from transformers import AutoModelForCausalLM, AutoTokenizer
from peft import LoraConfig, get_peft_model, TaskType
from trl import SFTTrainer, SFTConfig
from datasets import load_dataset
import torch

BASE_MODEL = os.environ.get("SW_BASE_MODEL", "Qwen/Qwen2.5-Coder-1.5B")
DATA_DIR = os.environ.get("SW_DATA_DIR", "/tmp/fableforge/shell-whisperer/data")
OUTPUT_DIR = os.environ.get("SW_OUTPUT_DIR", "/tmp/fableforge/shell-whisperer/output/sft")

print(f"Loading {BASE_MODEL} with Unsloth...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name=BASE_MODEL,
    max_seq_length=1024,
    load_in_4bit=True,
    dtype=None,
    trust_remote_code=True,
)

if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token
tokenizer.padding_side = "right"

model = FastLanguageModel.get_peft_model(
    model, r=16, lora_alpha=32, lora_dropout=0.05,
    bias="none", use_gradient_checkpointing="unsloth",
    random_state=42, target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
)
model.print_trainable_parameters()

import json
train_path = os.path.join(DATA_DIR, "shell_train.jsonl")
if os.path.exists(train_path):
    train_ds = load_dataset("json", data_files=train_path, split="train")
else:
    print(f"Training data not found at {train_path}. Run data download first.")
    sys.exit(1)

val_path = os.path.join(DATA_DIR, "shell_val.jsonl")
val_ds = load_dataset("json", data_files=val_path, split="train") if os.path.exists(val_path) else None

batch_size = int(os.environ.get("DEFAULT_BATCH_SIZE", "8"))
grad_accum = int(os.environ.get("DEFAULT_GRAD_ACCUM", "2"))
dtype = os.environ.get("TRAINING_DTYPE", "fp16")
max_seq = int(os.environ.get("MAX_SEQ_LEN", "1024"))

training_args = SFTConfig(
    output_dir=OUTPUT_DIR,
    num_train_epochs=3,
    per_device_train_batch_size=batch_size,
    per_device_eval_batch_size=batch_size,
    gradient_accumulation_steps=grad_accum,
    learning_rate=3e-4,
    lr_scheduler_type="cosine",
    warmup_ratio=0.06,
    bf16=(dtype == "bf16"),
    fp16=(dtype != "bf16"),
    logging_steps=10,
    save_strategy="steps",
    save_steps=100,
    save_total_limit=3,
    eval_strategy="steps" if val_ds else "no",
    eval_steps=100 if val_ds else None,
    report_to="none",
    max_seq_length=max_seq,
    dataset_text_field="text",
    gradient_checkpointing=True,
    optim="paged_adamw_8bit",
    weight_decay=0.01,
    seed=42,
)

def format_example(example):
    instruction = example.get("instruction", "")
    output_text = example.get("output", "")
    input_text = example.get("input", "")
    if input_text:
        text = f"### Instruction:\n{instruction}\n\n### Input:\n{input_text}\n\n### Response:\n{output_text}"
    else:
        text = f"### Instruction:\n{instruction}\n\n### Response:\n{output_text}"
    return {"text": text}

train_ds = train_ds.map(format_example, remove_columns=train_ds.column_names)
if val_ds:
    val_ds = val_ds.map(format_example, remove_columns=val_ds.column_names)

trainer = SFTTrainer(
    model=model, args=training_args,
    train_dataset=train_ds, eval_dataset=val_ds,
    processing_class=tokenizer,
)

trainer.train()
trainer.save_model(os.path.join(OUTPUT_DIR, "final"))
tokenizer.save_pretrained(os.path.join(OUTPUT_DIR, "final"))
print("[OK] ShellWhisperer training complete")
SHELLWHISPERER_UNSLOTH
        return
    fi

    echo "[INFO] Running: bash $train_script ${train_args[*]}"
    bash "$train_script" "${train_args[@]}"
}

# ─── ReasonCritic-7B ──────────────────────────────────────────────────────────

run_reasoncritic() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Model: ReasonCritic-7B"
    echo "═══════════════════════════════════════════"
    echo ""

    local train_script="${REASON_CRITIC_DIR}/scripts/train.sh"
    local train_args=("--stage" "all")

    if [[ "$DRY_RUN" == "true" ]]; then
        train_args+=("--dry-run")
    fi

    if [[ "$COLAB" == "true" ]] && [[ -f "${REASON_CRITIC_DIR}/scripts/train_colab.ipynb" ]]; then
        echo "[INFO] Colab mode: Use train_colab.ipynb for interactive training"
        echo "       (~10 hours on T4 with Unsloth)")
        echo ""
        if [[ "$DRY_RUN" != "true" ]]; then
            echo "       To run the notebook programmatically:"
            echo "       jupyter nbconvert --execute ${REASON_CRITIC_DIR}/scripts/train_colab.ipynb"
        fi
        return
    fi

    if [[ "$UNSLOTH" == "true" ]]; then
        echo "[INFO] Running ReasonCritic with Unsloth..."
        export USE_UNSLOTH=1
        export RC_BASE_MODEL="${RC_BASE_MODEL:-Qwen/Qwen2.5-Coder-7B}"
        export RC_DATA_DIR="${RC_DATA_DIR:-${REASON_CRITIC_DIR}/data}"
        export RC_OUTPUT_DIR="${RC_OUTPUT_DIR:-${REASON_CRITIC_DIR}/output}"
        export DEFAULT_BATCH_SIZE="${DEFAULT_BATCH_SIZE:-2}"
        export DEFAULT_GRAD_ACCUM="${DEFAULT_GRAD_ACCUM:-8}"
        export TRAINING_DTYPE="${TRAINING_DTYPE:-fp16}"
    fi

    echo "[INFO] Running: bash $train_script ${train_args[*]}"
    bash "$train_script" "${train_args[@]}"
}

# ─── Model Exports ─────────────────────────────────────────────────────────────

run_exports() {
    echo ""
    echo "═══════════════════════════════════════════"
    echo "  Stage: Model Exports (GGUF + ONNX)"
    echo "═══════════════════════════════════════════"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] Would export all models to GGUF/ONNX"
        return 0
    fi

    # FableForge-14B GGUF (via Unsloth if available)
    if [[ -d "${FABLEFORGE_DIR}/output/stage4_dpo/final" ]] || [[ -d "${FABLEFORGE_DIR}/output/merged" ]]; then
        echo "[1/3] Exporting FableForge-14B..."
        if [[ "$UNSLOTH" == "true" ]]; then
            python3 << 'FF_EXPORT'
import os
try:
    from unsloth import FastLanguageModel
    base_model = os.environ.get("BASE_MODEL", "Qwen/Qwen2.5-Coder-14B")
    output_dir = os.environ.get("FABLEFORGE_DIR", "/tmp/fableforge/fableforge-14b")
    merge_path = os.path.join(output_dir, "output", "merged")
    
    print("Loading model for GGUF export...")
    model, tokenizer = FastLanguageModel.from_pretrained(
        model_name=base_model,
        max_seq_length=4096,
        load_in_4bit=False,
        dtype="bfloat16",
    )
    
    # Merge adapters if they exist
    from peft import PeftModel
    from pathlib import Path
    stages = ["behavior_shaping", "skill_distillation", "error_recovery", "dpo"]
    for i, stage in enumerate(stages, 1):
        adapter = os.path.join(output_dir, "output", f"stage{i}_{stage}", "final")
        if Path(adapter).exists():
            model = PeftModel.from_pretrained(model, adapter)
            model = model.merge_and_unload()
    
    # Save 16-bit
    os.makedirs(merge_path, exist_ok=True)
    model.save_pretrained(merge_path)
    tokenizer.save_pretrained(merge_path)
    
    # Try Unsloth GGUF export
    try:
        gguf_path = os.path.join(output_dir, "exports")
        model.save_pretrained_gguf(gguf_path, tokenizer, quantization_method="q4_k_m")
        print(f"GGUF exported to {gguf_path}")
    except Exception as e:
        print(f"Unsloth GGUF export failed: {e}")
        print("Use llama.cpp for manual GGUF conversion")
    
except ImportError:
    print("Unsloth not available, using standard export path")
FF_EXPORT
        else
            bash "${FABLEFORGE_DIR}/scripts/train.sh" --stage export ${DRY_RUN:+--dry-run}
        fi
    else
        echo "[SKIP] FableForge-14B not trained yet"
    fi

    # ShellWhisperer ONNX + GGUF
    if [[ -d "${SHELL_WHISPERER_DIR}/output/sft/final" ]]; then
        echo "[2/3] Exporting ShellWhisperer..."
        python3 "${SHELL_WHISPERER_DIR}/scripts/export_onnx.py" \
            --model-path "${SHELL_WHISPERER_DIR}/output/sft/final" \
            --output-dir "${SHELL_WHISPERER_DIR}/output/onnx" \
            --quantize-int8 || echo "[WARN] ONNX export failed"
        bash "${SHELL_WHISPERER_DIR}/scripts/train.sh" --stage gguf ${DRY_RUN:+--dry-run} || true
    else
        echo "[SKIP] ShellWhisperer not trained yet"
    fi

    # ReasonCritic GGUF
    if [[ -d "${REASON_CRITIC_DIR}/output/stage3_dpo/final" ]]; then
        echo "[3/3] Exporting ReasonCritic..."
        bash "${REASON_CRITIC_DIR}/scripts/train.sh" --stage export ${DRY_RUN:+--dry-run} || true
    else
        echo "[SKIP] ReasonCritic not trained yet"
    fi
}

# ─── Training Reports ──────────────────────────────────────────────────────────

generate_report() {
    echo ""
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║             Free-Tier Training Report                       ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo ""

    local total_size=0
    local model_count=0

    for model_dir in "${FABLEFORGE_DIR}/output" "${SHELL_WHISPERER_DIR}/output" "${REASON_CRITIC_DIR}/output"; do
        if [[ -d "$model_dir" ]]; then
            local model_name
            model_name=$(basename "$(dirname "$model_dir")")
            echo "  $model_name/"

            # Check for adapter directories
            for stage_dir in "$model_dir"/stage*/ "$model_dir"/sft/ "$model_dir"/onnx/; do
                if [[ -d "$stage_dir" ]]; then
                    local size
                    size=$(du -sh "$stage_dir" 2>/dev/null | awk '{print $1}')
                    echo "    $(basename "$stage_dir")/  ($size)"
                    total_size=$((total_size + 1))
                fi
            done

            # Check for GGUF files
            find "$model_dir" -name "*.gguf" -exec ls -lh {} \; 2>/dev/null | while read -r line; do
                local size
                size=$(echo "$line" | awk '{print $5}')
                echo "    $(echo "$line" | awk '{print $NF}')  ($size)"
            done

            # Check for ONNX files
            find "$model_dir" -name "*.onnx" -exec ls -lh {} \; 2>/dev/null | while read -r line; do
                local size
                size=$(echo "$line" | awk '{print $5}')
                echo "    $(echo "$line" | awk '{print $NF}')  ($size)"
            done

            model_count=$((model_count + 1))
            echo ""
        fi
    done

    echo "Models trained: $model_count"
    echo "Checkpoints found: $total_size"
    echo ""
    echo "Usage:"
    echo "  FableForge-14B:   llama-cli -m fableforge-14b-Q4_K_M.gguf -p 'implement a REST API'"
    echo "  ShellWhisperer:  python shell_whisperer/infer.py --onnx model_quantized.onnx"
    echo "  ReasonCritic:     llama-cli -m reason-critic-7b-Q4_K_M.gguf -p 'verify this code'"
    echo ""

    # Save report to file
    local report_file="${PROJECT_DIR}/training_report.txt"
    {
        echo "FableForge Free-Tier Training Report"
        echo "Generated: $(date)"
        echo "Mode: Unsloth=${UNSLOTH}, Colab=${COLAB}, Free-tier=${FREE_TIER}"
        echo "Models trained: ${model_count}"
        echo ""
        echo "Next steps:"
        echo "  1. Upload models to HuggingFace Hub"
        echo "  2. Run evaluation with bench-agent"
        echo "  3. Deploy ShellWhisperer ONNX to edge devices"
    } > "$report_file"
    echo "Report saved to: $report_file"
}

# ─── Main ──────────────────────────────────────────────────────────────────────

main() {
    detect_hardware

    START_TIME=$(date +%s)

    # Determine which models to run
    if [[ -n "$MODEL_FILTER" ]]; then
        case "$MODEL_FILTER" in
            fableforge|ff|14b)   MODELS=("fableforge") ;;
            shellwhisperer|sw|shell)  MODELS=("shellwhisperer") ;;
            reasoncritic|rc|critic)   MODELS=("reasoncritic") ;;
            all)                     MODELS=("data" "fableforge" "shellwhisperer" "reasoncritic" "exports") ;;
            *)                       echo "Unknown model: $MODEL_FILTER"; echo "Use: fableforge, shellwhisperer, reasoncritic, or all"; exit 1 ;;
        esac
    elif [[ -n "$STAGE_NUM" ]]; then
        case "$STAGE_NUM" in
            1) MODELS=("data") ;;
            2) MODELS=("fableforge") ;;
            3) MODELS=("shellwhisperer") ;;
            4) MODELS=("reasoncritic") ;;
            5) MODELS=("exports") ;;
            *) echo "Unknown stage: $STAGE_NUM. Use 1-5."; exit 1 ;;
        esac
    else
        MODELS=("data" "fableforge" "shellwhisperer" "reasoncritic" "exports")
    fi

    for model in "${MODELS[@]}"; do
        case "$model" in
            data)
                run_data_download
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
        esac
    done

    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    HOURS=$((DURATION / 3600))
    MINS=$(( (DURATION % 3600) / 60 ))

    echo ""
    echo "Total wall time: ${HOURS}h ${MINS}m"

    generate_report
}

# Export environment variables for Python subprocesses
export PROJECT_DIR FABLEFORGE_DIR SHELL_WHISPERER_DIR REASON_CRITIC_DIR
export UNSLOTH COLAB FREE_TIER AXOLOTL DRY_RUN LOCAL_MODE
if [[ -n "${DEFAULT_BATCH_SIZE:-}" ]]; then export DEFAULT_BATCH_SIZE; fi
if [[ -n "${DEFAULT_GRAD_ACCUM:-}" ]]; then export DEFAULT_GRAD_ACCUM; fi
if [[ -n "${MAX_SEQ_LEN:-}" ]]; then export MAX_SEQ_LEN; fi
if [[ -n "${TRAINING_BACKEND:-}" ]]; then export TRAINING_BACKEND; fi
if [[ -n "${TRAINING_DTYPE:-}" ]]; then export TRAINING_DTYPE; fi

main "$@"