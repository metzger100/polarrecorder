# Execution Plan Authoring

**Status:** Complete for Phase 1 bootstrap.

## Overview

Execution plans define phased work that leaves the repository green after every phase.

## Key Details

- Active plans live in `exec-plans/active/`.
- Completed plans move to `exec-plans/completed/`.
- Plan files use sequential names such as `PLAN1.md`.
- A progress ledger beside the active plan records each phase as `pending`, `in-progress`, or `done`.
- Phase 0 and Phase 1 are human-authored foundations for PLAN1. The agent loop begins at Phase 2.
- Plan defects must be surfaced and resolved explicitly instead of silently improvised around.

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Core principles](../core-principles.md)
