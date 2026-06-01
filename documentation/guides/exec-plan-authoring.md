# Execution Plan Authoring

**Status:** Current for version 1.0.0.

## Overview

Execution plans define phased work that leaves the repository green after every phase.

## Key Details

- Active plans live in `exec-plans/active/`.
- Completed plans move to `exec-plans/completed/`.
- Plan files use sequential names in the active plan directory.
- A progress ledger beside the active plan records each phase as `pending`, `in-progress`, or `done`.
- Bootstrap work can be human-authored before agent-driven implementation begins.
- Plan defects must be surfaced and resolved explicitly instead of silently improvised around.

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Core principles](../core-principles.md)
