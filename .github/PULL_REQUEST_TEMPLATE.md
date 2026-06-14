## Description

<!-- Provide a clear, concise description of what this PR does and why. Link to relevant issues, discussions, or design docs. -->

Summary of changes:

-

Related issues: #

---

## Type of Change

<!-- Check all that apply -->

- [ ] 🐛 Bug fix (non-breaking change that fixes an issue)
- [ ] ✨ New feature (non-breaking change that adds functionality)
- [ ] 💥 Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] 📚 Documentation update
- [ ] 🤖 Model change (weights, training, or evaluation)
- [ ] 📊 Data change (dataset, benchmark, or training data)
- [ ] 🔗 Integration change (cross-project interaction)
- [ ] ⚙️ Infrastructure/CI change
- [ ] 🧹 Refactor (no functional change)
- [ ] 🧪 Test addition/update

---

## Projects Affected

<!-- Check every project that this PR touches, even indirectly -->

- [ ] Anvil (core generation engine)
- [ ] VerifyLoop (verification & repair loop)
- [ ] ErrorRecovery (error recovery module)
- [ ] ShellWhisperer (shell benchmark model)
- [ ] ReasonCritic (critique & refinement model)
- [ ] FableForge-14B (base language model)
- [ ] AgentSwarm (multi-agent orchestration)
- [ ] BenchAgent (benchmarking framework)
- [ ] CodeDistiller (training data distillation)
- [ ] TraceCompiler (trace optimization compiler)
- [ ] DatasetPipeline (dataset creation & curation)
- [ ] RLHFLoop (RLHF training pipeline)
- [ ] DPOTrainer (DPO preference training)
- [ ] SkillDistiller (skill extraction & distillation)
- [ ] PromptForge (prompt engineering toolkit)
- [ ] ModelMerger (model merging toolkit)
- [ ] EvalSuite (evaluation framework)
- [ ] AnvilCLI (command-line interface)
- [ ] AnvilAPI (HTTP API server)
- [ ] AnvilSDK (Python SDK)
- [ ] None / Build / Infrastructure only

---

## Testing Checklist

<!-- Complete all items. If an item doesn't apply, mark it and explain why in the Notes section. -->

- [ ] All new and existing tests pass
  <!-- Run: pytest tests/ -xvs -->
- [ ] `anvil verify` passes on all changed files
  <!-- Run: anvil verify --changed -->
- [ ] Integration tests pass where applicable
  <!-- Run: pytest tests/integration/ -xvs -->
- [ ] CLI `--help` works and reflects changes (if CLI-modifying)
  <!-- Run: anvil --help && anvil run --help -->
- [ ] `pip install -e .` works in a fresh virtualenv
  <!-- Run: python -m venv /tmp/test-env && source /tmp/test-env/bin/activate && pip install -e . -->
- [ ] No breaking changes introduced, OR breaking changes are documented below

### Breaking Changes

<!-- If you checked "breaking change" above, document the migration path here -->

<details>
<summary>Breaking Change Details</summary>

**What changed:**

**Old behavior:**

**New behavior:**

**Migration steps:**

```bash
# Example migration command or code
```

</details>

---

## Verification

<!-- Run the verification command and paste the output below. This helps reviewers quickly assess quality. -->

Run:
```bash
anvil run "verify this PR" --scope changed
```

<details>
<summary>Verification Output</summary>

```
<!-- Paste verification output here -->
```

</details>

---

## Screenshots / Demo

<!-- If this PR includes UI changes, add screenshots or GIFs here. Otherwise, remove this section. -->

<details>
<summary>Screenshots</summary>

| Before | After |
|--------|-------|
| <!-- paste before screenshot --> | <!-- paste after screenshot --> |

</details>

---

## Documentation Checklist

<!-- Check all documentation items that were updated -->

- [ ] README.md updated (if user-facing change)
- [ ] API documentation updated (if public API changed)
- [ ] CHANGELOG.md updated (entry added under `Unreleased`)
- [ ] Migration guide updated (if breaking change)
- [ ] docstrings updated (if Python API changed)
- [ ] Configuration reference updated (if config schema changed)
- [ ] Examples/tutorials updated (if behavior changed)

---

## Related Issues

<!-- Link all related issues, PRs, and discussions -->

- Fixes #
- Related to #
- Depends on #
- Blocks #

---

## Notes for Reviewers

<!-- Anything reviewers should know — areas of concern, design decisions, things you want feedback on -->

<!-- Thank you for contributing to FableForge! -->
