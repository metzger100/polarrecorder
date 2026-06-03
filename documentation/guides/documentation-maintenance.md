# Documentation Maintenance

**Status:** Current.

## Overview

Use this workflow whenever changes touch architecture, module wiring, validation behavior, AvNav integration, viewer behavior, installation, configuration, export/import, or release tooling. User-facing changes must keep `README.md` current in the same task.

## Key Details

Default workflow:

1. Identify touched areas: `plugin.py`, `server/polarrecorder/`, `viewer/`, `plugin.json`, `plugin.mjs`, `tools/`, `documentation/avnav/`, and root project docs.
2. Update the mapped documentation in `documentation/`.
3. Update root docs (`README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, or `ROADMAP.md`) when user-facing behavior or development workflow changes.
4. Add every new documentation file to `documentation/TABLEOFCONTENTS.md`.
5. Keep every documentation file structurally complete: `Status`, `Overview`, `Key Details`, and `Related`.
6. Run targeted checks while iterating when useful, then run the full gate before handoff.

Default validation gate:

```bash
tools/check-all.sh
```

The full gate runs Python linting, formatting checks, strict typing, tests, coverage, Python file-size checks, release validation, and `npm run check:all`.

Useful targeted checks:

```bash
npm run check:docs
npm run check:core
python -m pytest tests/ --tb=short
python tools/check-release.py --dry-run
```

Touchpoint matrix:

| Change Type | Minimum Docs to Update |
|---|---|
| AvNav lifecycle, plugin loading, or API boundary | `documentation/avnav/plugin-lifecycle.md`, `documentation/architecture/plugin-lifecycle.md`, `documentation/architecture/api.md`, `ARCHITECTURE.md` when structure changes |
| AvNav request routing, static files, or user app exposure | `documentation/avnav/request-routing-and-static-files.md`, `documentation/architecture/api.md`, `documentation/architecture/ui.md`, `README.md` when user-visible |
| NMEA key, unit, or conversion behavior | `documentation/avnav/keys-and-units.md`, `documentation/user/configuration.md`, `README.md` when user-visible |
| Editable parameter registration, defaults, or parsing | `documentation/avnav/editable-parameters.md`, `documentation/user/configuration.md`, `README.md` when user-visible |
| Runtime configuration defaults or editable parameters | `documentation/user/configuration.md`, `README.md`, affected tests or mock data |
| Validation rules, rejection reasons, or poisoning defenses | `documentation/filters/rejection-rules.md`, `documentation/filters/poisoning-resistance.md`, `documentation/architecture/data-pipeline.md` |
| Polar model, histogram bins, confidence, or persistence | `documentation/architecture/polar-model.md`, `documentation/architecture/persistence.md`, `documentation/TECH-DEBT.md` when debt changes |
| Viewer behavior, tabs, charts, editor, export UI, or CSS | `documentation/architecture/ui.md`, `README.md` when user-facing |
| Export/import format or backup behavior | `documentation/user/export-import.md`, `README.md`, related mock data |
| Troubleshooting-relevant behavior or known failure mode | `documentation/user/troubleshooting.md`, `documentation/TECH-DEBT.md` when unresolved |
| Release packaging, versioning, or install flow | `documentation/guides/release-workflow.md`, `README.md`, companion release notes under `releases/` |
| Development workflow, checks, or agent guidance | `documentation/guides/documentation-maintenance.md`, `documentation/QUALITY.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` |

Documentation checks:

- `tools/check-docs.mjs` verifies that every documentation file is linked from `TABLEOFCONTENTS.md`.
- `tools/check-doc-format.mjs` verifies required sections.
- `tools/check-doc-reachability.mjs` verifies docs are reachable from `AGENTS.md` or `CLAUDE.md` and that markdown links exist.
- `tools/check-ai-instructions.mjs` verifies the shared instruction block in `AGENTS.md` and `CLAUDE.md` stays synchronized.

AvNav documentation rule:

- Do not cite machine-specific AvNav paths or checkout locations.
- State the host behavior Polar Recorder relies on as a self-contained contract.
- Link from Polar Recorder implementation docs to the relevant `documentation/avnav/` contract.

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Core principles](../core-principles.md)
- [Coding standards](../conventions/coding-standards.md)
- [Quality](../QUALITY.md)
- [Execution plan authoring](exec-plan-authoring.md)
