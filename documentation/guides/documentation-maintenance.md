# Documentation Maintenance

**Status:** Current.

## Overview

Use this workflow whenever changes touch architecture, module wiring, validation behavior, AvNav integration, viewer
behavior, installation, configuration, export/import, or release tooling. User-facing changes must keep `README.md`
current in the same task.

## Key Details

Default workflow:

1. Identify touched areas: `plugin.py`, `server/polarrecorder/`, `viewer/`, `plugin.json`, plugin entrypoints, `tools/`,
   `documentation/avnav/`, and root project docs.
2. Update the mapped documentation in `documentation/`.
3. Update root docs (`README.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md`, `ARCHITECTURE.md`, or `ROADMAP.md`) when
   user-facing behavior or development workflow changes.
4. Add every new documentation file to `documentation/TABLEOFCONTENTS.md`.
5. Follow [documentation format](../conventions/documentation-format.md): keep every documentation file structurally
   complete with `Status`, `Overview`, `Key Details`, and `Related`.
6. Run targeted checks while iterating when useful, then run the full gate before handoff.

Default validation gate:

```bash
npm run check:all
```

`tools/check-all.sh` is a compatibility wrapper around the same command. The full gate is exactly `check:core` (Python
linting/formatting/strict typing/tests/file-size/contracts, JS lint/format/tests/typecheck/duplication, docs,
complexity, scaling, and package/release validation) plus `test:coverage:check` (Python + viewer/plugin JS coverage
inventory). See [quality gates](../conventions/quality-gates.md) for the exact group composition.

Useful targeted checks:

```bash
npm run docs:check
npm run check:fast
python -m pytest tests/ --tb=short
python tools/check-release.py --dry-run
```

Touchpoint matrix:

| Change Type                                                | Minimum Docs to Update                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AvNav lifecycle, plugin loading, or API boundary           | `documentation/avnav/plugin-lifecycle.md`, `documentation/architecture/plugin-lifecycle.md`, `documentation/architecture/api.md`, `ARCHITECTURE.md` when structure changes                                                                                                                              |
| AvNav request routing, static files, or user app exposure  | `documentation/avnav/request-routing-and-static-files.md`, `documentation/architecture/api.md`, `documentation/architecture/ui.md`, `README.md` when user-visible                                                                                                                                       |
| NMEA key, unit, or conversion behavior                     | `documentation/avnav/keys-and-units.md`, `documentation/user/configuration.md`, `README.md` when user-visible                                                                                                                                                                                           |
| Editable parameter registration, defaults, or parsing      | `documentation/avnav/editable-parameters.md`, `documentation/user/configuration.md`, `README.md` when user-visible                                                                                                                                                                                      |
| Runtime configuration defaults or editable parameters      | `documentation/user/configuration.md`, `README.md`, affected tests or mock data                                                                                                                                                                                                                         |
| Validation rules, rejection reasons, or poisoning defenses | `documentation/filters/rejection-rules.md`, `documentation/filters/poisoning-resistance.md`, `documentation/architecture/data-pipeline.md`                                                                                                                                                              |
| Polar model, histogram bins, confidence, or persistence    | `documentation/architecture/polar-model.md`, `documentation/architecture/persistence.md`                                                                                                                                                                                                                |
| Viewer behavior, tabs, charts, editor, export UI, or CSS   | `documentation/architecture/ui.md`, `README.md` when user-facing                                                                                                                                                                                                                                        |
| Export/import format or backup behavior                    | `documentation/user/export-import.md`, `README.md`, related mock data                                                                                                                                                                                                                                   |
| Troubleshooting-relevant behavior or known failure mode    | `documentation/user/troubleshooting.md`                                                                                                                                                                                                                                                                 |
| Release packaging, versioning, or install flow             | `documentation/guides/release-workflow.md`, `README.md`, companion release notes under `releases/`                                                                                                                                                                                                      |
| Development workflow, checks, or agent guidance            | `documentation/guides/documentation-maintenance.md`, `documentation/conventions/quality-gates.md`, `documentation/conventions/coding-standards.md`, `documentation/conventions/smell-prevention.md`, `documentation/conventions/testing-infrastructure.md`, `AGENTS.md`, `CLAUDE.md`, `CONTRIBUTING.md` |

Documentation checks reached through `npm run docs:check`, in this order:

- `markdownlint-cli2` (config: `.markdownlint-cli2.jsonc`) lints every non-excluded Markdown file's style.
- `tools/check-doc-links-proof.mjs` runs a clean/broken fixture pair through the real Linkinator-based link checker
  before it runs against the real repo, so a silently-broken checker cannot pass by finding nothing.
- `tools/check-doc-links.mjs` root-seeds Linkinator (`linkinator`) over every Prettier-owned Markdown file and fails on
  a broken local link or fragment; the static Linkinator options, including the host-aware skip pattern that keeps
  Linkinator's own ephemeral local serving origin from being mistaken for an external link, live in
  `linkinator.config.json`, the converged owner. Seed selection stays in `check-doc-links.mjs`, derived from
  `format-scope.json`.

The documentation-shape checks that used to run here as standalone `tools/check-*.mjs` CLIs are now Vitest contract
tests, reached instead through `npm run test:tools` (part of `test:node`, part of `test:split`, part of `check:core`):

- `tests/js/doc-toc-contract.test.mjs` verifies that every documentation file is linked from `TABLEOFCONTENTS.md`.
- `tests/js/doc-format-contract.test.mjs` verifies required sections.
- `tests/js/doc-reachability-contract.test.mjs` verifies docs are reachable from `AGENTS.md` or `CLAUDE.md` and that
  markdown links exist.
- `tests/js/smell-catalog-contract.test.mjs` verifies `documentation/conventions/smell-prevention.md` lists exactly the
  required smell rules, with no duplicates, and that every executable checker rule ID appears in the catalog text.
- `tests/js/agents-pointer.test.mjs` verifies `CLAUDE.md` stays a short, valid pointer to `AGENTS.md` (the sole
  canonical instruction owner) plus the mandatory preflight files, never a re-expanded duplicate.

Related non-Markdown documentation-adjacent checks:

- `npm run schema:check` (Ajv, `tools/check-schema.mjs`) validates `plugin.json`'s dev and release forms against
  `schemas/polar-plugin-dev.schema.json`/`schemas/polar-plugin-release.schema.json`; update the schema (and the shared
  corpus in `tools/quality-policy/plugin-schema-corpus.json`) in the same change as any `plugin.json` shape change.
- `npm run dependencies:audit` (`npm audit`) is a maintainer-only, networked advisory check, never part of `check:all`;
  a clean run only reflects the advisory database's current contents, not a guarantee.

AvNav documentation rule:

- Do not cite machine-specific AvNav paths or checkout locations.
- State the host behavior Polar Recorder relies on as a self-contained contract.
- Link from Polar Recorder implementation docs to the relevant `documentation/avnav/` contract.

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Documentation format](../conventions/documentation-format.md)
- [Core principles](../core-principles.md)
- [Quality gates](../conventions/quality-gates.md)
- [Coding standards](../conventions/coding-standards.md)
- [Testing infrastructure](../conventions/testing-infrastructure.md)
- [Execution plan authoring](exec-plan-authoring.md)
