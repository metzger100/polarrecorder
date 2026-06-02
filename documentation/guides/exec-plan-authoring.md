# Execution Plan Authoring

**Status:** Current.

## Overview

Use this guide when complex work spans files, sessions, or architectural boundaries. Routine changes do not need a plan; they follow the normal development workflow in `AGENTS.md`.

## Key Details

- Store active plans in `exec-plans/active/` only while the work is active.
- Move completed plans to `exec-plans/completed/`, or remove them when their historical detail no longer helps normal development.
- Use sequential names such as `PLAN2.md` when multiple plans exist.
- For complex tasks, the current plan is the implementation source of truth until completion.
- Surface plan defects explicitly and amend the plan instead of silently improvising around contradictions.
- Keep every phase small enough to leave `tools/check-all.sh` green after completion.

Required plan sections:

| Section | Purpose | Contract |
|---|---|---|
| Status | Scope and authority | State what the plan covers and what is prescriptive vs. flexible |
| Goal | Observable outcomes | List user-visible and repository-visible results after completion |
| Verified Baseline | Repository-verified facts | Numbered facts checked against current files, tests, and tool output |
| Hard Constraints | Non-negotiable boundaries | Exact files, dependencies, and architecture rules that must not change |
| Implementation Order | Phased delivery | Per phase: intent, dependencies, deliverables, and exit conditions |
| Documentation Impact | Public docs sync contract | Exact docs to update, including `README.md` when user-facing behavior changes |
| Acceptance Criteria | Done definition | Criteria grouped by behavior, tests, docs, and release impact |
| Related | Dependency chain | Links to docs and plans needed to execute safely |

Verified baseline rules:

- Number facts sequentially.
- Verify each fact against repository files, not memory.
- Include file paths, API shapes, config values, and existing test patterns.
- Include explicit negative facts when introducing something new.

Phase rules:

- Start each phase with a one-sentence intent.
- Declare dependencies on earlier phases explicitly.
- Keep deliverables concrete: file paths, section names, command gates, and test names.
- Keep exit conditions executable.
- Include `README.md` updates when installation, configuration, viewer behavior, export/import, or release workflow changes.

Anti-patterns:

- Writing a plan without a verified baseline.
- Treating a completed historical plan as current authority.
- Defining acceptance criteria only after coding starts.
- Omitting documentation updates for user-facing behavior or workflow changes.

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Core principles](../core-principles.md)
- [Documentation maintenance](documentation-maintenance.md)
