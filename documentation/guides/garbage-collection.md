# Garbage Collection

**Status:** Current for version 1.0.0.

## Overview

Use this workflow to remove structural drift, dead code, stale docs, obsolete release artifacts, and unused development leftovers while preserving Polar Recorder's AvNav runtime boundaries.

## Key Details

Cleanup workflow:

1. Read the mandatory preflight docs from `AGENTS.md`.
2. Inspect the working tree before editing.

```bash
git status --short
```

3. Scope cleanup with fast searches.

```bash
rg -n "TODO|FIXME|PLAN|deprecated|unused|console\\.log|print\\(" .
rg --files
```

4. Run targeted structural checks before and after cleanup.

```bash
npm run check:filesize
npm run check:headers
npm run check:naming
npm run check:patterns
npm run check:docs
```

5. Review code-to-doc links for every changed runtime file. Python and viewer module headers must point at documentation that still describes current behavior.
6. Remove dead code and stale comments rather than preserving commented-out alternatives.
7. Consolidate duplicated helper logic into existing modules when it reduces real duplication without widening scope.
8. Preserve AvNav isolation: `server/polarrecorder/` must not import AvNav modules or `plugin.py`, and locking remains in the integration shell.
9. Update `documentation/TECH-DEBT.md` and `documentation/QUALITY.md` whenever cleanup resolves, adds, or reclassifies debt.
10. Run the full gate before handoff.

```bash
tools/check-all.sh
```

Manual review checklist:

- Code-doc drift: behavior changed without the linked documentation changing.
- Boundary drift: AvNav access outside `plugin.py`, or reverse dependency from domain code to the integration shell.
- Runtime dependency drift: imports requiring packages unavailable on target AvNav devices.
- File-size drift: files approaching or exceeding the 400 non-empty-line hard limit.
- Test drift: weakened assertions, missing behavior coverage, or mock data out of sync with user-visible output.
- Release drift: runtime allowlist or release notes no longer match packaged files.

Anti-patterns:

| Pattern | Detection | Fix |
|---|---|---|
| Historical plan residue treated as current authority | `rg -n "PLAN[0-9]+" .` | Remove stale references or write a fresh plan for current work |
| AvNav boundary bypass | `npm run check:patterns` and review | Inject through protocols/fakes; keep AvNav API access in `plugin.py` |
| Hidden real time in domain code | `npm run check:patterns` and review | Use injected clocks |
| Debug leftovers | `npm run check:patterns`, ruff, review | Remove `print()`, `console.log()`, and commented-out code |
| File-size pressure | `npm run check:filesize`, `python tools/check-python-filesize.py` | Split modules before limits force dense code |
| Stale documentation headers | `npm run check:headers` | Update the `Documentation:` target or the linked document |
| Release artifact drift | `python tools/check-release.py --dry-run` | Update release tooling or runtime allowlist deliberately |

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Core principles](../core-principles.md)
- [Smell prevention](../conventions/smell-prevention.md)
- [Documentation maintenance](documentation-maintenance.md)
- [Quality](../QUALITY.md)
- [Technical debt](../TECH-DEBT.md)
