#!/usr/bin/env bash
# train.sh — QLoRA fine-tuning pipeline for ShellWhisperer 1.5B
#
# Model: Qwen/Qwen2.5-Coder-1.5B (or TinyLlama/TinyLlama-1.1B-Chat-v1.0)
# Target: 50ms inference on edge (phone/RPi)
# Data:  Shell commands extracted from Fable-5 traces (Bash tool calls only)
#
# Memory: ~8GB VRAM for 1.5B QLoRA (single GPU)
# Time:  ~3-4h on A100, ~8h on RTX 3090
#
# Usage:
#   bash train.sh [--stage {sft,onnx,gguf,all}] [--dry-run] [--base-model MODEL]

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

BASE_MODEL="${BASE_MODEL:-Qwen/Qwen2.5-Coder-1.5B}"
DATA_DIR="${DATA_DIR:-${PROJECT_DIR}/data}"
OUTPUT_DIR="${OUTPUT_DIR:-${PROJECT_DIR}/output}"
LOG_DIR="${OUTPUT_DIR}/logs"
GPUS="${GPUS:-1}"
STAGE="${STAGE:-all}"
DRY_RUN="${DRY_RUN:-false}"

for arg in "$@"; do
    case "$arg" in
        --stage=*)    STAGE="${arg#--stage=}" ;;
        --dry-run)    DRY_RUN="true" ;;
        --base-model=*) BASE_MODEL="${arg#--base-model=}" ;;
        --data-dir=*) DATA_DIR="${arg#--data-dir=}" ;;
        --output-dir=*) OUTPUT_DIR="${arg#--output-dir=}" ;;
        --gpus=*)     GPUS="${arg#--gpus=}" ;;
    esac
done

mkdir -p "$OUTPUT_DIR" "$LOG_DIR"

echo "=== ShellWhisperer 1.5B Training Pipeline ==="
echo "  Base model:  $BASE_MODEL"
echo "  Data:        $DATA_DIR"
echo "  Output:      $OUTPUT_DIR"
echo "  GPUs:        $GPUS"
echo ""

TOTAL_VRAM=$(nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>/dev/null | awk '{s+=$1}END{print s}' || echo "0")
echo "  Total VRAM: ${TOTAL_VRAM}MB"

# ─── Step 1: Data preparation ────────────────────────────────────────────────

prepare_data() {
    echo "[INFO] Checking training data..."

    local train_path="${DATA_DIR}/shell_train.jsonl"
    local val_path="${DATA_DIR}/shell_val.jsonl"

    if [[ ! -f "$train_path" ]]; then
        echo "[INFO] Running data conversion from Fable-5 raw data..."
        python3 "${PROJECT_DIR}/../fableforge-14b/scripts/convert_data.py" \
            --stage shell_whisperer \
            --output-dir "$DATA_DIR" \
            || {
                echo "[ERROR] Data conversion failed. Ensure Fable-5 raw data is available."
                echo "        Run download_data.sh first, or convert_data.py --stage shell_whisperer"
                return 1
            }
    fi

    local train_examples
    train_examples=$(wc -l < "$train_path" 2>/dev/null | tr -d ' ' || echo "0")
    echo "[OK] Training data: $train_examples examples ($train_path)"

    if [[ "$train_examples" -lt 100 ]]; then
        echo "[WARN] Very few training examples ($train_examples). Consider adding more data."
    fi
}

# ─── Step 2: SFT Training ────────────────────────────────────────────────────

run_sft() {
    local sft_output="${OUTPUT_DIR}/sft"
    local train_path="${DATA_DIR}/shell_train.jsonl"
    local val_path="${DATA_DIR}/shell_val.jsonl"

    if [[ ! -f "$train_path" ]]; then
        echo "[ERROR] Training data not found: $train_path"
        return 1
    fi

    local train_examples
    train_examples=$(wc -l < "$train_path" | tr -d ' ')
    local steps_per_epoch=$(( (train_examples + 15) / 16 ))
    local save_steps=$(( steps_per_epoch / 2 ))
    save_steps=$(( save_steps < 10 ? 10 : save_steps ))

    echo ""
    echo "=== Step 1: SFT Training ==="
    echo "  Training examples:  $train_examples"
    echo "  LoRA r:             16, alpha: 32"
    echo "  Learning rate:      3e-4"
    echo "  Epochs:             3"
    echo "  Batch size:         4, gradient accumulation: 4 (effective: 16)"
    echo "  Max sequence len:   1024"
    echo "  Steps per epoch:    $steps_per_epoch"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] Would run SFT training"
        return 0
    fi

    python3 << 'SFT_SCRIPT'
import os
import sys

def main():
    from transformers import AutoModelForCausalLM, AutoTokenizer
    from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training, TaskType
    from trl import SFTTrainer, SFTConfig
    from datasets import load_dataset

    base_model = os.environ.get("SW_BASE_MODEL", "Qwen/Qwen2.5-Coder-1.5B")
    data_dir = os.environ.get("SW_DATA_DIR", "")
    output_dir = os.environ.get("SW_SFT_OUTPUT", "")
    train_path = os.path.join(data_dir, "shell_train.jsonl") if data_dir else sys.argv[1]
    val_path = os.path.join(data_dir, "shell_val.jsonl") if data_dir else sys.argv[2]

    print(f"Loading tokenizer: {base_model}")
    tokenizer = AutoTokenizer.from_pretrained(base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"

    print(f"Loading model: {base_model}")
    model = AutoModelForCausalLM.from_pretrained(
        base_model,
        load_in_4bit=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype="bfloat16",
        bnb_4bit_use_double_quant=True,
        trust_remote_code=True,
        device_map="auto",
    )
    model = prepare_model_for_kbit_training(model)

    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        lora_dropout=0.05,
        bias="none",
        task_type=TaskType.CAUSAL_LM,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    def format_example(example):
        instruction = example.get("instruction", "")
        input_text = example.get("input", "")
        output_text = example.get("output", "")
        if input_text:
            prompt = f"### Instruction:\n{instruction}\n\n### Input:\n{input_text}\n\n### Response:\n{output_text}"
        else:
            prompt = f"### Instruction:\n{instruction}\n\n### Response:\n{output_text}"
        return {"text": prompt}

    print(f"Loading dataset: {train_path}")
    train_dataset = load_dataset("json", data_files=train_path, split="train")
    train_dataset = train_dataset.map(format_example, remove_columns=train_dataset.column_names)

    eval_dataset = None
    if os.path.exists(val_path):
        eval_dataset = load_dataset("json", data_files=val_path, split="train")
        eval_dataset = eval_dataset.map(format_example, remove_columns=eval_dataset.column_names)

    training_args = SFTConfig(
        output_dir=output_dir,
        num_train_epochs=3,
        per_device_train_batch_size=4,
        per_device_eval_batch_size=4,
        gradient_accumulation_steps=4,
        learning_rate=3e-4,
        lr_scheduler_type="cosine",
        warmup_ratio=0.06,
        bf16=True,
        logging_steps=10,
        save_strategy="steps",
        save_steps=max(10, len(train_dataset) // 32),
        save_total_limit=3,
        eval_strategy="steps" if eval_dataset else "no",
        eval_steps=max(10, len(train_dataset) // 32) if eval_dataset else None,
        report_to="wandb",
        run_name="shell-whisperer-sft",
        max_seq_length=1024,
        gradient_checkpointing=True,
        optim="paged_adamw_8bit",
        weight_decay=0.01,
        max_grad_norm=1.0,
        seed=42,
        dataset_text_field="text",
    )

    trainer = SFTTrainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        processing_class=tokenizer,
    )

    print("Starting SFT training...")
    trainer.train()

    print("Saving final model...")
    trainer.save_model(os.path.join(output_dir, "final"))
    tokenizer.save_pretrained(os.path.join(output_dir, "final"))

    print("[OK] SFT training complete")

if __name__ == "__main__":
    main()
SFT_SCRIPT
}

# ─── Step 3: ONNX Export ─────────────────────────────────────────────────────

export_onnx() {
    local sft_final="${OUTPUT_DIR}/sft/final"
    local onnx_output="${OUTPUT_DIR}/onnx"

    echo ""
    echo "=== Step 2: ONNX Export ==="
    echo "  Model:       $sft_final"
    echo "  Output:      $onnx_output"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] Would export to ONNX"
        return 0
    fi

    python3 "${SCRIPT_DIR}/export_onnx.py" \
        --model-path "$sft_final" \
        --output-dir "$onnx_output" \
        --quantize-int8 \
        --max-seq-length 256 \
        || {
            echo "[ERROR] ONNX export failed"
            return 1
        }

    echo "[OK] ONNX model exported to $onnx_output"
    echo ""
    echo "=== Model Sizes ==="
    ls -lh "$onnx_output"/*.onnx 2>/dev/null || true
}

# ─── Step 4: GGUF Export ─────────────────────────────────────────────────────

export_gguf() {
    local sft_final="${OUTPUT_DIR}/sft/final"
    local gguf_output="${OUTPUT_DIR}/shell-whisperer-1.5b-Q4_K_M.gguf"

    echo ""
    echo "=== Step 3: GGUF Export ==="
    echo "  Model:       $sft_final"
    echo "  Output:      $gguf_output"
    echo ""

    if [[ "$DRY_RUN" == "true" ]]; then
        echo "[DRY-RUN] Would export to GGUF"
        return 0
    fi

    echo "[INFO] Merging LoRA adapter into base model..."
    python3 << 'MERGE_SCRIPT'
import os, sys
output_dir = os.environ.get("SW_OUTPUT_DIR", "")
sft_final = os.path.join(output_dir, "sft", "final") if output_dir else sys.argv[1] if len(sys.argv) > 1 else ""
merged_path = os.path.join(output_dir, "merged") if output_dir else ""

if not sft_final or not os.path.exists(sft_final):
    print(f"[ERROR] SFT model not found at {sft_final}")
    sys.exit(1)

from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer
import torch

base_model = os.environ.get("SW_BASE_MODEL", "Qwen/Qwen2.5-Coder-1.5B")

print(f"Loading base model: {base_model}")
model = AutoModelForCausalLM.from_pretrained(
    base_model,
    torch_dtype=torch.bfloat16,
    device_map="cpu",
)
tokenizer = AutoTokenizer.from_pretrained(base_model)

print(f"Loading adapter: {sft_final}")
model = PeftModel.from_pretrained(model, sft_final)
model = model.merge_and_unload()

print(f"Saving merged model to: {merged_path}")
model.save_pretrained(merged_path)
tokenizer.save_pretrained(merged_path)
print("[OK] Merge complete")
MERGE_SCRIPT

    local merged_path="${OUTPUT_DIR}/merged"

    if command -v llama-quantize &>/dev/null || [[ -f "${OUTPUT_DIR}/llama.cpp/llama-quantize" ]]; then
        echo "[INFO] Converting to GGUF..."

        if [[ ! -d "${OUTPUT_DIR}/llama.cpp" ]]; then
            git clone https://github.com/ggerganov/llama.cpp.git "${OUTPUT_DIR}/llama.cpp" --depth 1
            make -C "${OUTPUT_DIR}/llama.cpp" -j$(nproc) llama-quantize 2>/dev/null || true
        fi

        python3 "${OUTPUT_DIR}/llama.cpp/convert_hf_to_gguf.py" \
            "$merged_path" \
            --outfile "${OUTPUT_DIR}/shell-whisperer-1.5b-f16.gguf" \
            --outtype f16 2>/dev/null || true

        "${OUTPUT_DIR}/llama.cpp/llama-quantize" \
            "${OUTPUT_DIR}/shell-whisperer-1.5b-f16.gguf" \
            "$gguf_output" \
            Q4_K_M 2>/dev/null || true

        echo "[OK] GGUF exported to: $gguf_output"
    else
        echo "[INFO] llama.cpp not found. Install it and run:"
        echo "  python llama.cpp/convert_hf_to_gguf.py $merged_path --outfile ${gguf_output} --outtype q4_k_m"
    fi
}

# ─── Benchmark ──────────────────────────────────────────────────────────────

benchmark() {
    echo ""
    echo "=== Edge Inference Benchmark ==="

    local onnx_path="${OUTPUT_DIR}/onnx/model_quantized.onnx"
    if [[ -f "$onnx_path" ]]; then
        python3 << 'BENCH_SCRIPT'
import os, time, json

onnx_path = os.environ.get("SW_ONNX_PATH", "")
if not os.path.exists(onnx_path):
    print(f"[SKIP] ONNX model not found: {onnx_path}")
    exit(0)

try:
    import onnxruntime as ort

    sess = ort.InferenceSession(onnx_path, providers=["CPUExecutionProvider"])

    import numpy as np
    input_ids = np.array([[1, 2, 3, 4, 5]], dtype=np.int64)

    warmup = 5
    for _ in range(warmup):
        sess.run(None, {"input_ids": input_ids})

    runs = 50
    times = []
    for _ in range(runs):
        start = time.perf_counter()
        sess.run(None, {"input_ids": input_ids})
        times.append((time.perf_counter() - start) * 1000)

    avg = sum(times) / len(times)
    p50 = sorted(times)[len(times) // 2]
    p95 = sorted(times)[int(len(times) * 0.95)]

    results = {
        "avg_ms": round(avg, 1),
        "p50_ms": round(p50, 1),
        "p95_ms": round(p95, 1),
        "runs": runs,
    }
    print(json.dumps(results, indent=2))

    if p50 < 50:
        print("[PASS] p50 latency < 50ms target!")
    else:
        print(f"[WARN] p50 latency {p50:.1f}ms exceeds 50ms target")
        print("       Consider further quantization or distillation")

except ImportError:
    print("[SKIP] onnxruntime not installed. pip install onnxruntime")
except Exception as e:
    print(f"[ERROR] Benchmark failed: {e}")
BENCH_SCRIPT
    else
        echo "[SKIP] ONNX model not found at $onnx_path"
    fi
}

# ─── Main ─────────────────────────────────────────────────────────────────────

main() {
    prepare_data

    case "$STAGE" in
        sft)
            run_sft
            ;;
        onnx)
            export_onnx
            ;;
        gguf)
            export_gguf
            ;;
        all)
            run_sft
            export_onnx
            export_gguf
            benchmark
            ;;
        *)
            echo "Unknown stage: $STAGE. Use: sft, onnx, gguf, all"
            exit 1
            ;;
    esac

    echo ""
    echo "=== ShellWhisperer training pipeline complete ==="
}

export SW_BASE_MODEL="$BASE_MODEL" SW_DATA_DIR="$DATA_DIR" SW_OUTPUT_DIR="$OUTPUT_DIR" SW_SFT_OUTPUT="${OUTPUT_DIR}/sft"
main "$@"