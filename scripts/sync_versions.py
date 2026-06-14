#!/usr/bin/env python3
"""Synchronize versions across the FableForge monorepo.

Reads the canonical version from anvil/src/anvil/__init__.py and propagates
it to all pyproject.toml files and __init__.py files across the ecosystem.

Usage:
    python scripts/sync_versions.py              # Sync from anvil version
    python scripts/sync_versions.py --dry-run     # Preview changes without writing
    python scripts/sync_versions.py --version 0.3.0  # Override to specific version
    python scripts/sync_versions.py --check      # Exit 1 if versions are out of sync
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

CANONICAL_INIT = ROOT / "anvil" / "src" / "anvil" / "__init__.py"

PROJECTS = [
    "anvil",
    "verifyloop",
    "error-recovery",
    "agent-swarm",
    "agent-runtime",
    "agent-skills",
    "agent-constitution",
    "agent-curriculum",
    "agent-fuzzer",
    "agent-profiler",
    "agent-telemetry",
    "bench-agent",
    "cost-optimizer",
    "shell-whisperer",
    "reason-critic",
    "fableforge-14b",
    "fable5-dataset",
    "trace-compiler",
    "trajectory-distiller",
    "cli",
]

# Map project directory name -> Python package name
PACKAGE_NAMES: dict[str, str] = {
    "anvil": "anvil",
    "verifyloop": "verifyloop",
    "error-recovery": "error_recovery",
    "agent-swarm": "agent_swarm",
    "agent-runtime": "agent_runtime",
    "agent-skills": "agent_skills",
    "agent-constitution": "agent_constitution",
    "agent-curriculum": "agent_curriculum",
    "agent-fuzzer": "agent_fuzzer",
    "agent-profiler": "agent_profiler",
    "agent-telemetry": "agent_telemetry",
    "bench-agent": "bench_agent",
    "cost-optimizer": "cost_optimizer",
    "shell-whisperer": "shell_whisperer",
    "reason-critic": "reason_critic",
    "fableforge-14b": "fableforge_14b",
    "fable5-dataset": "fable5_dataset",
    "trace-compiler": "trace_compiler",
    "trajectory-distiller": "trajectory_distiller",
    "cli": "fableforge",
}


def read_canonical_version() -> str:
    """Read the version from the canonical __init__.py file."""
    content = CANONICAL_INIT.read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
    if not match:
        print(f"ERROR: Could not find __version__ in {CANONICAL_INIT}", file=sys.stderr)
        sys.exit(1)
    return match.group(1)


def write_canonical_version(version: str) -> None:
    """Write the version to the canonical __init__.py file."""
    content = CANONICAL_INIT.read_text(encoding="utf-8")
    new_content = re.sub(
        r'^__version__\s*=\s*["\'][^"\']+["\']',
        f'__version__ = "{version}"',
        content,
        flags=re.MULTILINE,
    )
    CANONICAL_INIT.write_text(new_content, encoding="utf-8")
    print(f"  Updated {CANONICAL_INIT.relative_to(ROOT)} → {version}")


def find_init_file(project: str) -> Path | None:
    """Find the __init__.py for a project's main package."""
    package_name = PACKAGE_NAMES.get(project)
    if not package_name:
        return None

    # Standard monorepo layout: project/src/package/__init__.py
    src_init = ROOT / project / "src" / package_name / "__init__.py"
    if src_init.exists():
        return src_init

    # Flat layout: project/__init__.py (at project root)
    flat_init = ROOT / project / "__init__.py"
    if flat_init.exists():
        return flat_init

    return None


def read_project_version(project: str) -> str | None:
    """Read the version from a project's __init__.py, if it has one."""
    init_file = find_init_file(project)
    if not init_file:
        return None

    content = init_file.read_text(encoding="utf-8")
    match = re.search(r'^__version__\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
    return match.group(1) if match else None


def read_pyproject_version(project: str) -> str | None:
    """Read the version from a project's pyproject.toml."""
    pyproject = ROOT / project / "pyproject.toml"
    if not pyproject.exists():
        return None

    content = pyproject.read_text(encoding="utf-8")
    match = re.search(r'^version\s*=\s*["\']([^"\']+)["\']', content, re.MULTILINE)
    if match:
        return match.group(1)

    # Dynamic version via __init__.py
    match = re.search(r'dynamic\s*=\s*\[.*"version".*\]', content, re.MULTILINE)
    if match:
        return read_project_version(project)

    return None


def update_pyproject_version(project: str, version: str, dry_run: bool = False) -> bool:
    """Update the version in a project's pyproject.toml. Returns True if changed."""
    pyproject = ROOT / project / "pyproject.toml"
    if not pyproject.exists():
        print(f"  SKIP {project}/pyproject.toml (not found)")
        return False

    content = pyproject.read_text(encoding="utf-8")

    # Check if version is dynamic (set from __init__.py)
    dynamic_match = re.search(r'dynamic\s*=\s*\[.*"version".*\]', content, re.MULTILINE)
    if dynamic_match:
        print(f"  SKIP {project}/pyproject.toml (dynamic version — set via __init__.py)")
        return False

    # Replace static version
    new_content = re.sub(
        r'^version\s*=\s*["\'][^"\']+["\']',
        f'version = "{version}"',
        content,
        flags=re.MULTILINE,
    )

    if new_content == content:
        print(f"  OK   {project}/pyproject.toml (already {version})")
        return False

    if not dry_run:
        pyproject.write_text(new_content, encoding="utf-8")

    rel_path = pyproject.relative_to(ROOT)
    action = "WOULD UPDATE" if dry_run else "Updated"
    print(f"  {action} {rel_path} → {version}")
    return True


def update_init_version(project: str, version: str, dry_run: bool = False) -> bool:
    """Update the version in a project's __init__.py. Returns True if changed."""
    init_file = find_init_file(project)
    if not init_file:
        return False

    content = init_file.read_text(encoding="utf-8")

    new_content = re.sub(
        r'^__version__\s*=\s*["\'][^"\']+["\']',
        f'__version__ = "{version}"',
        content,
        flags=re.MULTILINE,
    )

    if new_content == content:
        return False

    if not dry_run:
        init_file.write_text(new_content, encoding="utf-8")

    rel_path = init_file.relative_to(ROOT)
    action = "WOULD UPDATE" if dry_run else "Updated"
    print(f"  {action} {rel_path} → {version}")
    return True


def update_changelog(version: str, dry_run: bool = False) -> bool:
    """Add an Unreleased section header to CHANGELOG.md if version changed."""
    changelog = ROOT / "CHANGELOG.md"
    if not changelog.exists():
        print("  SKIP CHANGELOG.md (not found)")
        return False

    content = changelog.read_text(encoding="utf-8")

    # Check if this version already has a section
    if re.search(rf"^##\s+\[{re.escape(version)}\]", content, re.MULTILINE):
        print(f"  OK   CHANGELOG.md (section for {version} already exists)")
        return False

    # Add Unreleased section pointing to new version
    new_section = f"\n## [{version}] - UNRELEASED\n\nSee individual project CHANGELOGs for details.\n"
    insertion_point = content.find("\n## [")
    if insertion_point == -1:
        insertion_point = len(content)

    new_content = content[:insertion_point] + new_section + content[insertion_point:]

    if not dry_run:
        changelog.write_text(new_content, encoding="utf-8")

    action = "WOULD ADD" if dry_run else "Added"
    print(f"  {action} CHANGELOG.md section for {version}")
    return True


def sync_versions(target_version: str | None = None, dry_run: bool = False) -> list[str]:
    """Synchronize versions across all projects. Returns list of changed files."""
    if target_version:
        version = target_version
        if not dry_run:
            write_canonical_version(version)
        else:
            print(f"  WOULD SET canonical version → {version}")
    else:
        version = read_canonical_version()

    print(f"\nSyncing version: {version}")
    print(f"Mode: {'DRY RUN' if dry_run else 'LIVE'}")
    print("=" * 60)

    changed: list[str] = []

    # Update Anvil's own pyproject.toml
    if update_pyproject_version("anvil", version, dry_run):
        changed.append("anvil/pyproject.toml")

    # Update all other projects
    for project in PROJECTS:
        if project == "anvil":
            continue

        if update_pyproject_version(project, version, dry_run):
            changed.append(f"{project}/pyproject.toml")

        if update_init_version(project, version, dry_run):
            pkg = PACKAGE_NAMES.get(project, project)
            init_path = find_init_file(project)
            if init_path:
                changed.append(str(init_path.relative_to(ROOT)))

    # Update root CHANGELOG
    if update_changelog(version, dry_run):
        changed.append("CHANGELOG.md")

    print("=" * 60)
    if changed:
        print(f"\n{'Would change' if dry_run else 'Changed'} {len(changed)} file(s):")
        for f in changed:
            print(f"  - {f}")
    else:
        print("\nAll versions already in sync.")

    return changed


def check_versions() -> bool:
    """Check if all versions are in sync. Returns True if they are."""
    canonical = read_canonical_version()
    print(f"Canonical version: {canonical}")
    print("=" * 60)

    mismatches: list[tuple[str, str, str]] = []

    # Check Anvil's pyproject.toml
    pyproject_v = read_pyproject_version("anvil")
    if pyproject_v and pyproject_v != canonical:
        mismatches.append(("anvil/pyproject.toml", pyproject_v, canonical))

    for project in PROJECTS:
        if project == "anvil":
            continue

        pv = read_pyproject_version(project)
        if pv and pv != canonical:
            mismatches.append((f"{project}/pyproject.toml", pv, canonical))

        iv = read_project_version(project)
        if iv and iv != canonical:
            pkg = PACKAGE_NAMES.get(project, project)
            init_file = find_init_file(project)
            rel = str(init_file.relative_to(ROOT)) if init_file else f"{project}/__init__.py"
            mismatches.append((rel, iv, canonical))

    if mismatches:
        print("Version mismatches found:\n")
        for file, found, expected in mismatches:
            print(f"  {file}: {found} (expected {expected})")
        return False

    print("✓ All versions in sync.")
    return True


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Synchronize versions across the FableForge monorepo.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Preview changes without writing files.",
    )
    parser.add_argument(
        "--version",
        type=str,
        default=None,
        help="Override the version to sync (default: read from anvil/__init__.py).",
    )
    parser.add_argument(
        "--check",
        action="store_true",
        help="Exit with code 1 if versions are out of sync.",
    )
    args = parser.parse_args()

    if args.check:
        in_sync = check_versions()
        sys.exit(0 if in_sync else 1)

    changes = sync_versions(target_version=args.version, dry_run=args.dry_run)

    if args.dry_run and changes:
        print("\n⚠️  DRY RUN — no files were modified.")
        print("   Re-run without --dry-run to apply changes.")
    elif not args.dry_run and changes:
        print(f"\n✅ Synced version across {len(changes)} file(s).")
        print("   Remember to commit and tag the release.")


if __name__ == "__main__":
    main()
