# Contributing

**Status:** Complete for Phase 1 bootstrap.

## Overview

Contributions follow PLAN1, the documentation preflight, and the deterministic quality gate. The project values small phase-aligned changes that keep the repository green after every phase.

## Key Details

- Read `documentation/TABLEOFCONTENTS.md`, `documentation/conventions/coding-standards.md`, and `documentation/conventions/smell-prevention.md` before changing code or docs.
- Follow the active execution plan in `exec-plans/active/`.
- Run `tools/check-all.sh` before handing off changes.
- Do not add runtime dependencies, generated build artifacts, product logic outside its planned phase, or raw reference-source copies from `misc/`.

## Related

- [Agent instructions](AGENTS.md)
- [Coding standards](documentation/conventions/coding-standards.md)
- [Smell prevention](documentation/conventions/smell-prevention.md)
