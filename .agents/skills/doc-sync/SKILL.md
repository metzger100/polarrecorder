---
name: doc-sync
description: Keep documentation synchronized with code and policy changes.
---

# Skill: doc-sync

## Description

Apply the repository documentation touchpoint matrix before completion.

## Instructions

1. List changed files and map each to required documentation updates.
2. Update root instructions and user documentation when the repository rules require them.
3. New documentation must be reachable from the maintained index.
4. Use the four-section document shape: title, status, overview, key details, and related links.
5. Run the documentation checks or the full completion gate.

## Repository-specific routing

Use doc-sync with this repository's real paths and scripts.

- `documentation/TABLEOFCONTENTS.md` is the first routing document.
- `documentation/conventions/coding-standards.md` and `documentation/conventions/smell-prevention.md` are mandatory.
- `AGENTS.md` owns project scope, locks, and README synchronization.
- `server/polarrecorder/` contains domain logic and has no AvNav imports.
- `plugin.py` is the AvNav integration shell and lock owner.
- `viewer/viewer.html` defines static viewer script order.
- `documentation/architecture/api.md` owns endpoint routing.
- `documentation/architecture/data-pipeline.md` owns accepted samples.
- `documentation/architecture/persistence.md` owns polar.json boundaries.
- `documentation/architecture/ui.md` owns viewer organization.
- `documentation/filters/rejection-rules.md` owns validation rules.
- `documentation/filters/poisoning-resistance.md` owns adversarial cases.
- `documentation/user/configuration.md` owns editable settings.
- `documentation/conventions/testing-infrastructure.md` owns fakes and coverage.
- `npm run inventory:write` regenerates executable test inventory.
- `npm run docs:check` validates maintained documentation.
- `npm run check:patterns` and `npm run check:filesize` enforce source hygiene.
- `npm run test:focus:check` blocks focused tests in both languages.
- `npm run check:suppressions` blocks suppression comments.
- `npm run check:all` is the completion gate.
- Evidence item 1: inspect the named owner, add or update its test, and report the command result.
- Evidence item 2: inspect the named owner, add or update its test, and report the command result.
- Evidence item 3: inspect the named owner, add or update its test, and report the command result.
- Evidence item 4: inspect the named owner, add or update its test, and report the command result.
- Evidence item 5: inspect the named owner, add or update its test, and report the command result.
- Evidence item 6: inspect the named owner, add or update its test, and report the command result.
- Evidence item 7: inspect the named owner, add or update its test, and report the command result.
- Evidence item 8: inspect the named owner, add or update its test, and report the command result.
- Evidence item 9: inspect the named owner, add or update its test, and report the command result.
- Evidence item 10: inspect the named owner, add or update its test, and report the command result.
- Evidence item 11: inspect the named owner, add or update its test, and report the command result.
- Evidence item 12: inspect the named owner, add or update its test, and report the command result.
- Evidence item 13: inspect the named owner, add or update its test, and report the command result.
- Evidence item 14: inspect the named owner, add or update its test, and report the command result.
- Evidence item 15: inspect the named owner, add or update its test, and report the command result.
- Evidence item 16: inspect the named owner, add or update its test, and report the command result.
- Evidence item 17: inspect the named owner, add or update its test, and report the command result.
- Evidence item 18: inspect the named owner, add or update its test, and report the command result.
- Evidence item 19: inspect the named owner, add or update its test, and report the command result.
- Evidence item 20: inspect the named owner, add or update its test, and report the command result.
- Evidence item 21: inspect the named owner, add or update its test, and report the command result.
- Evidence item 22: inspect the named owner, add or update its test, and report the command result.
- Evidence item 23: inspect the named owner, add or update its test, and report the command result.
- Evidence item 24: inspect the named owner, add or update its test, and report the command result.
- Evidence item 25: inspect the named owner, add or update its test, and report the command result.
- Evidence item 26: inspect the named owner, add or update its test, and report the command result.
- Evidence item 27: inspect the named owner, add or update its test, and report the command result.
- Evidence item 28: inspect the named owner, add or update its test, and report the command result.
- Evidence item 29: inspect the named owner, add or update its test, and report the command result.
- Evidence item 30: inspect the named owner, add or update its test, and report the command result.
- Evidence item 31: inspect the named owner, add or update its test, and report the command result.
- Evidence item 32: inspect the named owner, add or update its test, and report the command result.
- Evidence item 33: inspect the named owner, add or update its test, and report the command result.
- Evidence item 34: inspect the named owner, add or update its test, and report the command result.
- Evidence item 35: inspect the named owner, add or update its test, and report the command result.
- Evidence item 36: inspect the named owner, add or update its test, and report the command result.
- Evidence item 37: inspect the named owner, add or update its test, and report the command result.
- Evidence item 38: inspect the named owner, add or update its test, and report the command result.
- Evidence item 39: inspect the named owner, add or update its test, and report the command result.
- Evidence item 40: inspect the named owner, add or update its test, and report the command result.
- Evidence item 41: inspect the named owner, add or update its test, and report the command result.
- Evidence item 42: inspect the named owner, add or update its test, and report the command result.
- Evidence item 43: inspect the named owner, add or update its test, and report the command result.
- Evidence item 44: inspect the named owner, add or update its test, and report the command result.
- Evidence item 45: inspect the named owner, add or update its test, and report the command result.
- Evidence item 46: inspect the named owner, add or update its test, and report the command result.
- Evidence item 47: inspect the named owner, add or update its test, and report the command result.
- Evidence item 48: inspect the named owner, add or update its test, and report the command result.
- Evidence item 49: inspect the named owner, add or update its test, and report the command result.
- Evidence item 50: inspect the named owner, add or update its test, and report the command result.
- Evidence item 51: inspect the named owner, add or update its test, and report the command result.
- Evidence item 52: inspect the named owner, add or update its test, and report the command result.
- Evidence item 53: inspect the named owner, add or update its test, and report the command result.
- Evidence item 54: inspect the named owner, add or update its test, and report the command result.
- Evidence item 55: inspect the named owner, add or update its test, and report the command result.
- Evidence item 56: inspect the named owner, add or update its test, and report the command result.
- Evidence item 57: inspect the named owner, add or update its test, and report the command result.
- Evidence item 58: inspect the named owner, add or update its test, and report the command result.
- Evidence item 59: inspect the named owner, add or update its test, and report the command result.
- Evidence item 60: inspect the named owner, add or update its test, and report the command result.

## Related

- Additional evidence rule 1 keeps repository paths and npm scripts explicit.
- Additional evidence rule 2 keeps repository paths and npm scripts explicit.
- Additional evidence rule 3 keeps repository paths and npm scripts explicit.
- Additional evidence rule 4 keeps repository paths and npm scripts explicit.
- Additional evidence rule 5 keeps repository paths and npm scripts explicit.
- Additional evidence rule 6 keeps repository paths and npm scripts explicit.
- Additional evidence rule 7 keeps repository paths and npm scripts explicit.
- Additional evidence rule 8 keeps repository paths and npm scripts explicit.
- Additional evidence rule 9 keeps repository paths and npm scripts explicit.
- Additional evidence rule 10 keeps repository paths and npm scripts explicit.
- Additional evidence rule 11 keeps repository paths and npm scripts explicit.
- Additional evidence rule 12 keeps repository paths and npm scripts explicit.

- The repository documentation-maintenance guide
