#!/usr/bin/env bash
set -euo pipefail

# ============================================================================
# FableForge PyPI Publisher
#
# Publishes all pip-installable packages to PyPI using twine.
#
# Usage:
#   ./publish.sh              # Publish all packages (production)
#   ./publish.sh --dry-run    # Build and check without uploading
#   ./publish.sh --check      # Run twine check on built distributions
#   ./publish.sh <package>    # Publish a single package (e.g. ./publish.sh anvil)
#
# Prerequisites:
#   pip install build twine
#   Set PYPI_API_TOKEN or TWINE_PASSWORD in your environment
#
# Excluded:
#   - trace-viz (Node.js project, published via npm)
#   - agent-dev (VS Code extension, published via vsce)
# ============================================================================

DRY_RUN=false
CHECK_ONLY=false
SINGLE_PACKAGE=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run|-n)
            DRY_RUN=true
            shift
            ;;
        --check|-c)
            CHECK_ONLY=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [--dry-run] [--check] [<package-name>]"
            echo ""
            echo "  --dry-run    Build packages but skip upload"
            echo "  --check       Run twine check on built wheels"
            echo "  <package>    Publish a single package by directory name"
            echo ""
            echo "Packages (19 pip-installable):"
            echo "  anvil, verifyloop, error-recovery, agent-swarm,"
            echo "  fableforge-14b, shell-whisperer, reason-critic,"
            echo "  trace-compiler, agent-runtime, agent-telemetry,"
            echo "  bench-agent, agent-skills, agent-curriculum,"
            echo "  agent-fuzzer, agent-constitution, cost-optimizer,"
            echo "  agent-profiler, trajectory-distiller, fable5-dataset, cli"
            echo ""
            echo "Excluded (not pip packages):"
            echo "  trace-viz    (Node.js — use npm publish)"
            echo "  agent-dev    (VS Code extension — use vsce publish)"
            exit 0
            ;;
        -*)
            echo "Unknown flag: $1" >&2
            exit 1
            ;;
        *)
            SINGLE_PACKAGE="$1"
            shift
            ;;
    esac
done

# All 20 pip-installable packages (directory name, PyPI package name)
# Ordered by dependency: core packages first, then tooling, then data
PACKAGES=(
    "anvil:anvil-agent"
    "cli:fableforge"
    "verifyloop:verifyloop"
    "error-recovery:error-recovery"
    "agent-runtime:agent-runtime"
    "agent-swarm:agent-swarm"
    "agent-telemetry:agent-telemetry"
    "agent-skills:agent-skills"
    "agent-constitution:agent-constitution"
    "agent-curriculum:agent-curriculum"
    "agent-fuzzer:agent-fuzzer"
    "agent-profiler:agent-profiler"
    "shell-whisperer:shell-whisperer"
    "reason-critic:reason-critic"
    "bench-agent:bench-agent"
    "cost-optimizer:cost-optimizer"
    "trace-compiler:trace-compiler"
    "trajectory-distiller:trajectory-distiller"
    "fableforge-14b:fableforge-14b"
    "fable5-dataset:fable5-dataset"
)

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

log_info()  { echo -e "${BLUE}[INFO]${NC}  $*"; }
log_ok()    { echo -e "${GREEN}[OK]${NC}    $*"; }
log_warn()  { echo -e "${YELLOW}[WARN]${NC}  $*"; }
log_err()   { echo -e "${RED}[ERR]${NC}   $*"; }

REPO_ROOT="$(cd "$(dirname "$0")" && pwd)"
DIST_DIR="${REPO_ROOT}/dist"
FAILED=()
SUCCEEDED=()

cleanup() {
    if [[ -d "${DIST_DIR}" ]]; then
        log_info "Cleaning up dist directory: ${DIST_DIR}"
        rm -rf "${DIST_DIR}"
    fi
}

build_package() {
    local dir="$1"
    local pkg="$2"
    local pkg_dir="${REPO_ROOT}/${dir}"

    if [[ ! -d "${pkg_dir}" ]]; then
        log_err "Directory not found: ${pkg_dir}"
        return 1
    fi

    if [[ ! -f "${pkg_dir}/pyproject.toml" ]]; then
        log_warn "No pyproject.toml in ${dir}, skipping"
        return 1
    fi

    log_info "Building ${pkg} (${dir})..."

    # Clean previous builds
    rm -rf "${pkg_dir}/dist" "${pkg_dir}/build" "${pkg_dir}/src/"*.egg-info

    # Build the package
    (cd "${pkg_dir}" && python -m build --outdir "${DIST_DIR}" .) 2>&1

    if [[ $? -ne 0 ]]; then
        log_err "Build failed for ${pkg}"
        return 1
    fi

    log_ok "Built ${pkg}"
    return 0
}

check_package() {
    local dist_dir="$1"

    log_info "Running twine check on distributions..."
    twine check "${dist_dir}"/*

    if [[ $? -ne 0 ]]; then
        log_err "Twine check failed"
        return 1
    fi

    log_ok "Twine check passed"
    return 0
}

publish_package() {
    local pkg="$1"

    if [[ "${DRY_RUN}" == true ]]; then
        log_warn "[DRY RUN] Would publish ${pkg}"
        return 0
    fi

    log_info "Publishing ${pkg} to PyPI..."

    twine upload \
        --skip-existing \
        "${DIST_DIR}"/*

    if [[ $? -ne 0 ]]; then
        log_err "Publish failed for ${pkg}"
        return 1
    fi

    log_ok "Published ${pkg}"
    return 0
}

# Main
main() {
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  FableForge PyPI Publisher${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if [[ "${DRY_RUN}" == true ]]; then
        log_warn "DRY RUN MODE — packages will be built and checked but NOT uploaded"
    fi

    if [[ "${CHECK_ONLY}" == true ]]; then
        log_warn "CHECK ONLY MODE — packages will be built and checked but NOT uploaded"
    fi

    echo ""

    # Check prerequisites
    if ! command -v python &>/dev/null && ! command -v python3 &>/dev/null; then
        log_err "Python is required but not installed"
        exit 1
    fi

    if ! python -c "import build" 2>/dev/null; then
        log_err "The 'build' package is required. Install it with: pip install build"
        exit 1
    fi

    if [[ "${DRY_RUN}" != true ]] && [[ "${CHECK_ONLY}" != true ]]; then
        if ! command -v twine &>/dev/null; then
            log_err "twine is required for publishing. Install it with: pip install twine"
            exit 1
        fi

        if [[ -z "${TWINE_PASSWORD:-}" ]] && [[ -z "${PYPI_API_TOKEN:-}" ]]; then
            log_err "No PyPI credentials found. Set TWINE_PASSWORD or PYPI_API_TOKEN."
            log_err "Alternatively, set up ~/.pypirc or use: twine upload -u __token__ -p <token>"
            exit 1
        fi
    fi

    # Create dist directory
    mkdir -p "${DIST_DIR}"

    # Determine which packages to process
    local packages_to_process=()

    if [[ -n "${SINGLE_PACKAGE}" ]]; then
        local found=false
        for entry in "${PACKAGES[@]}"; do
            local dir="${entry%%:*}"
            local pkg="${entry##*:}"
            if [[ "${dir}" == "${SINGLE_PACKAGE}" ]] || [[ "${pkg}" == "${SINGLE_PACKAGE}" ]]; then
                packages_to_process+=("${entry}")
                found=true
                break
            fi
        done
        if [[ "${found}" == false ]]; then
            log_err "Package '${SINGLE_PACKAGE}' not found in package list"
            echo ""
            echo "Available packages:"
            for entry in "${PACKAGES[@]}"; do
                echo "  ${entry%%:*}  (${entry##*:})"
            done
            exit 1
        fi
    else
        packages_to_process=("${PACKAGES[@]}")
    fi

    echo -e "Publishing ${BLUE}${#packages_to_process[@]}${NC} package(s)"
    echo ""

    # Build each package
    local i=1
    local total=${#packages_to_process[@]}
    local build_failures=()

    for entry in "${packages_to_process[@]}"; do
        local dir="${entry%%:*}"
        local pkg="${entry##*:}"

        echo -e "${CYAN}[$i/$total]${NC} ${pkg}"

        # Clean dist dir for each package build
        rm -rf "${DIST_DIR:?}"/*

        if build_package "${dir}" "${pkg}"; then
            SUCCEEDED+=("${pkg}")

            # Run twine check
            if ! check_package "${DIST_DIR}"; then
                log_warn "Twine check warnings for ${pkg} (continuing)"
            fi

            # Publish (unless dry-run or check-only)
            if [[ "${DRY_RUN}" != true ]] && [[ "${CHECK_ONLY}" != true ]]; then
                if ! publish_package "${pkg}"; then
                    FAILED+=("${pkg}")
                    # Remove from succeeded
                    SUCCEEDED=("${SUCCEEDED[@]/$pkg}")
                fi
            fi
        else
            FAILED+=("${pkg}")
            build_failures+=("${pkg}")
        fi

        ((i++))
    done

    # Cleanup
    cleanup

    # Summary
    echo ""
    echo -e "${CYAN}========================================${NC}"
    echo -e "${CYAN}  Summary${NC}"
    echo -e "${CYAN}========================================${NC}"
    echo ""

    if [[ ${#SUCCEEDED[@]} -gt 0 ]]; then
        echo -e "${GREEN}Succeeded (${#SUCCEEDED[@]}):${NC}"
        for p in "${SUCCEEDED[@]}"; do
            echo -e "  ${GREEN}✓${NC} ${p}"
        done
    fi

    if [[ ${#FAILED[@]} -gt 0 ]]; then
        echo ""
        echo -e "${RED}Failed (${#FAILED[@]}):${NC}"
        for p in "${FAILED[@]}"; do
            echo -e "  ${RED}✗${NC} ${p}"
        done
    fi

    echo ""

    if [[ "${DRY_RUN}" == true ]]; then
        log_warn "Dry run complete. No packages were uploaded."
    elif [[ "${CHECK_ONLY}" == true ]]; then
        log_warn "Check complete. No packages were uploaded."
    else
        if [[ ${#FAILED[@]} -eq 0 ]]; then
            log_ok "All ${#SUCCEEDED[@]} packages published successfully!"
        else
            log_err "${#FAILED[@]} package(s) failed. Review output above."
        fi
    fi

    # Exit code
    if [[ ${#FAILED[@]} -gt 0 ]]; then
        exit 1
    fi
    exit 0
}

main
