---
description: Verify the current or named active-plan phase without editing files.
agent: plan-controller
---

# Verify Active Plan Phase

Run verification only for the current or named phase of the active execution plan in `exec-plans/active/`.

Do not edit any files. Do not update progress ledgers, amendments ledgers, plan text, source, tests, docs, or tooling.

Use `plan-controller` in verification-only mode:

1. Locate the active plan in `exec-plans/active/*.md`.
2. Read `exec-plans/active/<PLAN>.progress.md` if present.
3. Determine the phase to verify:
   - Use the user's named phase if provided.
   - Otherwise use the first phase not marked `done`.
4. Gather objective artifacts without edits:
   - Actual file tree and relevant file contents.
   - `git status` and relevant diffs.
   - `tools/check-all.sh` output when the gate exists and the phase is agent-driven.
   - Named acceptance criteria from the active plan.
   - Any `<PLAN>.amendments.md` entries and matching `AMENDED` markers.
5. Run both Pro verifier subagents:
   - `pro-requirements-verifier`
   - `pro-quality-verifier`
6. Return each verifier's PASS/FAIL verdict and required follow-up tasks.

This command never marks a phase `done`. It is advisory verification unless a later `/exec-plan` run records completion after both Pro verifiers PASS.
