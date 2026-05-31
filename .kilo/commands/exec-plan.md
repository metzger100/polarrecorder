---
description: Start or continue the next incomplete phase from the active execution plan.
agent: plan-controller
---

# Execute Active Plan

Start or continue the active execution plan in `exec-plans/active/`.

Use `plan-controller` and follow its rules exactly:

1. Locate the active plan in `exec-plans/active/*.md`.
2. Locate or initialize `exec-plans/active/<PLAN>.progress.md`.
3. Select the next incomplete phase as the first phase not marked `done`.
4. Never infer phase completion from repository contents or conversation state.
5. Never implement Phase 0 or Phase 1. Before driving any product phase, require:
   - Phase 0 marked `done`.
   - Phase 1 marked `done`.
   - `AGENTS.md` present.
   - `CLAUDE.md` present.
   - `tools/check-all.sh` exits 0.
6. If the foundation precondition fails, stop and ask the human to complete it.
7. Execute only one phase unless the user explicitly asks for more.
8. Delegate scoped work to the named subagents; do not dump the full plan into worker prompts.
9. If a plan defect is surfaced, run the plan-defect protocol:
   - Confirm with `context-scout`.
   - Classify mechanical vs judgment-call.
   - Mechanical: minimally fix, record in `<PLAN>.amendments.md`, and mark the plan section with `<!-- AMENDED A<N>: ... -->`.
   - Judgment-call: stop, leave the phase `in-progress`, and escalate to the human.
10. Run both `pro-requirements-verifier` and `pro-quality-verifier`.
11. Mark the phase `done` only after both Pro verifiers return PASS for the same repository state.
12. Stop after 3 fix-to-verify cycles, or after a repeated identical unresolved failure; leave the phase `in-progress`, record the blocker, and escalate.

Final response must include the phase handled, files changed, checks run, both verifier verdicts, ledger status, and any blockers.
