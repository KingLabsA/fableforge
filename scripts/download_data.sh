#!/usr/bin/env bash
# download_data.sh — Download all 6 Fable-5 datasets from HuggingFace
# Usage: ./download_data.sh [--dry-run] [--force]
# This script is idempotent: it skips files that already exist and pass checksum validation.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DATA_DIR="${FABLE5_RAW_DATA:-/tmp/fable5_analysis/raw_data}"
MANIFEST="${SCRIPT_DIR}/download_manifest.json"
HF_ENDPOINT="${HF_ENDPOINT:-https://huggingface.co}"
DRY_RUN=false
FORCE=false

for arg in "$@"; do
    case "$arg" in
        --dry-run) DRY_RUN=true ;;
        --force)  FORCE=true ;;
        -h|--help)
            echo "Usage: $0 [--dry-run] [--force]"
            echo "  --dry-run  Show what would be downloaded without downloading"
            echo "  --force     Re-download even if files exist"
            exit 0
            ;;
    esac
done

mkdir -p "$DATA_DIR"

declare -A DATASETS=(
    ["vfable"]="summerMC/v-Fable|v_fable.jsonl|100000"
    ["coding_excellence"]="summerMC/coding-excellence|coding_excellence.jsonl|100000"
    ["armand0e"]="armand0e/claude-fable-5-claude-code|all_sessions.jsonl|63"
    ["opencoven"]="OpenCoven/fable-forge-10k|train.jsonl|10000"
    ["victor"]="victor/fable-5-boeing-747-trace|trace.jsonl|1"
    ["glint"]="Glint-Research/Fable-5-traces|data.parquet|4665"
)

declare -A SHA256_CHECKSUMS
SHA256_CHECKSUMS=(
    # These checksums will be populated on first successful download.
    # Set to empty string to skip verification until real checksums are known.
)

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $*"; }

check_sha256() {
    local filepath="$1"
    local expected="$2"
    if [[ -z "$expected" ]]; then
        log "  SHA256: No checksum provided, skipping verification for $(basename "$filepath")"
        return 0
    fi
    local actual
    actual=$(shasum -a 256 "$filepath" 2>/dev/null | awk '{print $1}' || true)
    if [[ "$actual" == "$expected" ]]; then
        log "  SHA256: OK ($actual)"
        return 0
    else
        log "  SHA256: MISMATCH (expected $expected, got $actual)"
        return 1
    fi
}

download_hf_dataset() {
    local name="$1"
    local repo_id="$2"
    local filename="$3"
    local expected_rows="$4"
    local dest_dir="${DATA_DIR}/${name}"
    local dest_file="${dest_dir}/${filename}"

    if [[ -f "$dest_file" ]] && [[ "$FORCE" != "true" ]]; then
        local expected_cksum="${SHA256_CHECKSUMS[$name]:-}"
        if check_sha256 "$dest_file" "$expected_cksum"; then
            log "SKIP: $name already exists at $dest_file"
            return 0
        else
            log "WARN: $name exists but checksum failed, re-downloading"
        fi
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY: Would download $repo_id/$filename -> $dest_file (~${expected_rows} rows)"
        return 0
    fi

    mkdir -p "$dest_dir"
    log "DOWNLOAD: $repo_id/$filename -> $dest_file"

    local url="${HF_ENDPOINT}/datasets/${repo_id}/resolve/main/${filename}"
    local http_code
    http_code=$(curl -L -w "%{http_code}" -o "$dest_file" "$url" 2>/dev/null || echo "000")

    if [[ "$http_code" != "200" ]]; then
        log "ERROR: Failed to download $url (HTTP $http_code)"
        rm -f "$dest_file"
        return 1
    fi

    local file_size
    file_size=$(stat -f%z "$dest_file" 2>/dev/null || stat -c%s "$dest_file" 2>/dev/null || echo "0")
    if [[ "$file_size" -eq 0 ]]; then
        log "ERROR: Downloaded file is empty: $dest_file"
        rm -f "$dest_file"
        return 1
    fi

    log "  Downloaded $(numfmt --to=iec "$file_size" 2>/dev/null || echo "${file_size} bytes")"

    local expected_cksum="${SHA256_CHECKSUMS[$name]:-}"
    check_sha256 "$dest_file" "$expected_cksum" || true

    local actual_checksum
    actual_checksum=$(shasum -a 256 "$dest_file" | awk '{print $1}')
    log "  SHA256: $actual_checksum"

    echo "$actual_checksum" > "${dest_file}.sha256"
    log "  Saved checksum to ${dest_file}.sha256"

    log "DONE: $name"
    return 0
}

download_glint_parquet() {
    local name="glint"
    local repo_id="Glint-Research/Fable-5-traces"
    local filename="data.parquet"
    local expected_rows="4665"
    local dest_dir="${DATA_DIR}/${name}"
    local dest_file="${dest_dir}/${filename}"

    if [[ -f "$dest_file" ]] && [[ "$FORCE" != "true" ]]; then
        local expected_cksum="${SHA256_CHECKSUMS[$name]:-}"
        if check_sha256 "$dest_file" "$expected_cksum"; then
            log "SKIP: $name already exists at $dest_file"
            return 0
        fi
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY: Would download $repo_id/$filename -> $dest_file (~${expected_rows} rows)"
        return 0
    fi

    mkdir -p "$dest_dir"
    log "DOWNLOAD: $repo_id/$filename -> $dest_file (parquet)"

    local url="${HF_ENDPOINT}/datasets/${repo_id}/resolve/main/${filename}"
    local http_code
    http_code=$(curl -L -w "%{http_code}" -o "$dest_file" "$url" 2>/dev/null || echo "000")

    if [[ "$http_code" != "200" ]]; then
        log "ERROR: Failed to download $url (HTTP $http_code)"
        rm -f "$dest_file"
        return 1
    fi

    local file_size
    file_size=$(stat -f%z "$dest_file" 2>/dev/null || stat -c%s "$dest_file" 2>/dev/null || echo "0")
    log "  Downloaded $(numfmt --to=iec "$file_size" 2>/dev/null || echo "${file_size} bytes")"

    if command -v python3 &>/dev/null; then
        log "  Converting parquet to JSONL..."
        python3 -c "
import sys
try:
    import pandas as pd
    df = pd.read_parquet('${dest_file}')
    df.to_json('${dest_dir}/glint_traces.jsonl', orient='records', lines=True)
    print(f'  Converted {len(df)} rows to glint_traces.jsonl')
except ImportError:
    print('  python pandas not available, skipping parquet conversion', file=sys.stderr)
except Exception as e:
    print(f'  Parquet conversion failed: {e}', file=sys.stderr)
" || true
    fi

    local actual_checksum
    actual_checksum=$(shasum -a 256 "$dest_file" | awk '{print $1}')
    echo "$actual_checksum" > "${dest_file}.sha256"

    log "DONE: $name"
    return 0
}

download_armand0e_session_files() {
    local name="armand0e"
    local repo_id="armand0e/claude-fable-5-claude-code"
    local dest_dir="${DATA_DIR}/${name}"

    if [[ -d "$dest_dir" ]] && ls "$dest_dir"/*.jsonl &>/dev/null && [[ "$FORCE" != "true" ]]; then
        log "SKIP: $name directory already has JSONL files"
        return 0
    fi

    if [[ "$DRY_RUN" == "true" ]]; then
        log "DRY: Would download individual session files from $repo_id"
        return 0
    fi

    mkdir -p "$dest_dir"

    log "DOWNLOAD: $repo_id (multiple session files)"
    local api_url="${HF_ENDPOINT}/api/datasets/${repo_id}"
    local listing
    listing=$(curl -s "$api_url" 2>/dev/null || echo "{}")

    python3 -c "
import json, sys, urllib.request, os, subprocess

repo_id = '${repo_id}'
dest_dir = '${dest_dir}'
endpoint = '${HF_ENDPOINT}'

try:
    url = f'{endpoint}/api/datasets/{repo_id}/tree?recursive=true'
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        files = json.loads(resp.read().decode())

    for f in files:
        if f.get('type') == 'file' and f['path'].endswith('.jsonl'):
            dl_url = f'{endpoint}/datasets/{repo_id}/resolve/main/{f[\"path\"]}'
            dest = os.path.join(dest_dir, os.path.basename(f['path']))
            if os.path.exists(dest):
                continue
            print(f'  Downloading {f[\"path\"]}...')
            urllib.request.urlretrieve(dl_url, dest)
except Exception as e:
    print(f'  Download via API failed: {e}', file=sys.stderr)
    print('  Trying huggingface_hub...', file=sys.stderr)
    try:
        from huggingface_hub import snapshot_download
        snapshot_download(repo_id=repo_id, local_dir=dest_dir, repo_type='dataset')
    except ImportError:
        print('  huggingface_hub not available. Install: pip install huggingface_hub', file=sys.stderr)
        sys.exit(1)
    except Exception as e2:
        print(f'  huggingface_hub also failed: {e2}', file=sys.stderr)
        sys.exit(1)
" || {
        log "WARN: Could not download armand0e dataset automatically."
        log "      Install huggingface_hub: pip install huggingface_hub"
        log "      Then run: from huggingface_hub import snapshot_download; snapshot_download('armand0e/claude-fable-5-claude-code', local_dir='$dest_dir', repo_type='dataset')"
    }

    log "DONE: $name"
    return 0
}

main() {
    log "=== Fable-5 Data Download ==="
    log "Data directory: $DATA_DIR"
    log ""

    local total_expected=234346
    local downloaded=0
    local failed=0

    for name in vfable coding_excellence opencoven victor; do
        local IFS='|'
        read -r repo_id filename expected_rows <<< "${DATASETS[$name]}"
        if download_hf_dataset "$name" "$repo_id" "$filename" "$expected_rows"; then
            ((downloaded++)) || true
        else
            ((failed++)) || true
        fi
    done

    download_armand0e_session_files && ((downloaded++)) || ((failed++)) || true
    download_glint_parquet && ((downloaded++)) || ((failed++)) || true

    log ""
    log "=== Download Summary ==="
    log "  Downloaded: $downloaded / 6 datasets"
    log "  Failed:     $failed"
    log "  Total expected rows: ~$total_expected"
    log ""

    if [[ "$failed" -gt 0 ]]; then
        log "WARN: Some downloads failed. Re-run with --force to retry."
        log "      For armand0e, install: pip install huggingface_hub"
    fi

    log "=== Generating Combined Manifest ==="
    python3 -c "
import json, os, glob

data_dir = '$DATA_DIR'
manifest = {
    'name': 'fable5-raw',
    'version': '1.0',
    'datasets': {},
    'total_rows': 0
}

for dataset_dir in sorted(glob.glob(os.path.join(data_dir, '*'))):
    if not os.path.isdir(dataset_dir):
        continue
    name = os.path.basename(dataset_dir)
    files = glob.glob(os.path.join(dataset_dir, '*.jsonl')) + glob.glob(os.path.join(dataset_dir, '*.parquet'))
    rows = 0
    for f in files:
        if f.endswith('.jsonl'):
            with open(f) as fh:
                rows += sum(1 for _ in fh)
        elif f.endswith('.parquet'):
            try:
                import pandas as pd
                rows += len(pd.read_parquet(f))
            except Exception:
                pass
    manifest['datasets'][name] = {
        'files': [os.path.basename(f) for f in files],
        'rows': rows
    }
    manifest['total_rows'] += rows

with open(os.path.join(data_dir, 'manifest.json'), 'w') as f:
    json.dump(manifest, f, indent=2)
print(f'  Manifest written: {manifest[\"total_rows\"]} total rows across {len(manifest[\"datasets\"])} datasets')
" || log "WARN: Could not generate manifest (pandas may be needed)"

    log "=== Done ==="
}

main "$@"