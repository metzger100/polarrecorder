# Quality Gates

**Status:** Current.

## Overview

The quality gate is the executable contract for Polar Recorder development. Run the full gate before handoff for normal
development work, and use targeted gates only while iterating.

## Key Details

Full gate:

```bash
npm run check:all
```

`npm run check:strict` is an exact alias of `check:all`.

`check:all` is exactly `check:core` plus `test:coverage:check`, the sole coverage half of the gate. `check:core` is the
literal, locked group order:

```text
check:core = check:standard && check:shared-core && check:generic-surface &&
             check:standalone && check:suppressions && typecheck && package:check &&
             test:focus:check && check:smells &&
             check:python-contracts && test:split && check:complexity &&
             check:scaling && docs:check && check:filesize
```

| Group                            | Composition                                                                                                                                                                                                                                                         |
| -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:standard`         | `format:check && lint && actions:lint && duplication:check`                                                                                                                                                                                                         |
| `npm run typecheck`              | `typecheck:source && typecheck:tests && typecheck:tools && typecheck:python` (strict no-emit JS typing over viewer/plugin, tests, and `tools/**/*.mjs`, plus `mypy --strict`)                                                                                       |
| `npm run package:check`          | `schema:check` plus release dry-run build/validate and dedicated package/release/installer tests                                                                                                                                                                    |
| `npm run test:focus:check`       | Blocks JS `.only`/`.skip`/`.todo`/focus and Python pytest/unittest skip/skipif/xfail markers                                                                                                                                                                        |
| `npm run check:smells`           | JS/Python pattern checks; the viewer metadata contracts run in the `tools` Vitest project reached by `test:split`                                                                                                                                                   |
| `npm run check:python-contracts` | Python 3.9 compatibility, contract-trust smells, architecture/dependency, and runtime finite-number contracts                                                                                                                                                       |
| `npm run test:split`             | `test:python && test:node` (pytest, then `test:tools && test:viewer && test:plugin`)                                                                                                                                                                                |
| `npm run check:complexity`       | `eslint --config tools/quality-policy/eslint.complexity.config.mjs viewer/*.js plugin.js plugin.mjs`, enforcing complexity 10/max-statements 40/max-depth 4/max-params 6 as ESLint errors directly against the live tree -- no baseline, scanner, or budget ledger  |
| `npm run check:scaling`          | Deterministic counted-operation scaling contracts for `PolarModel.update_accepted`, `projection.project_grid`, `api_handlers.format_polar`                                                                                                                          |
| `npm run docs:check`             | `docs:lint` (markdownlint-cli2), `docs:links:proof`, `docs:links` (root-seeded Linkinator). TOC, format, reachability, smell-catalog completeness, and the `CLAUDE.md` pointer contract are Vitest contract tests reached through `test:tools` instead              |
| `npm run check:filesize`         | Combined viewer JS/CSS/HTML, plugin, `tools/**/*.mjs`, and Markdown 400-line checks (oneliner-density rules apply to viewer/plugin JS only) plus the Python file-size/header/one-line-compression check over `server/polarrecorder/`, `tests/`, and `tools/**/*.py` |

Convenience aliases:

| Alias                  | Purpose                                                                                                                                                                                                                                                                                                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run check:fast`   | Exactly `check:standard && typecheck && test:unit`: static standards, full typing, and a bounded unit-test selection. It is bounded feedback for iteration, not the final gate -- it deliberately excludes `test:split`, `test:tools`, `check:python-contracts`, `package:check`, `docs:check`, `check:complexity`, `check:scaling`, and coverage. |
| `npm run test:unit`    | `test:python && test:viewer && test:plugin`: the ordinary Python product suite plus viewer/plugin behavior tests, excluding quality-tool self-tests (`test:tools`)                                                                                                                                                                                 |
| `npm run check:all`    | `check:core && test:coverage:check`; the canonical complete local gate, required before handoff/push/release                                                                                                                                                                                                                                       |
| `npm run check:strict` | Exact alias of `check:all`                                                                                                                                                                                                                                                                                                                         |

Coverage half of the gate:

| Command                            | Purpose                                                                                                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run test:coverage:python`     | Cleans and regenerates `coverage/python/coverage.json` (`pytest --cov=polarrecorder --cov=plugin --cov-branch --cov-fail-under=90`); Python's own native aggregate floor                                                       |
| `npm run test:coverage:viewer`     | Cleans and regenerates `coverage/viewer/coverage-summary.json` via Vitest's native V8 coverage provider over the viewer + plugin-entrypoint projects, with its own native 80/80/80/65 line/function/statement/branch threshold |
| `npm run check:coverage-inventory` | Full Python + viewer/plugin JS coverage classification (measured/contract-owned), family and per-file floors, and the floor-vs-baseline ratchet (`check-coverage-inventory.mjs`)                                               |
| `npm run test:coverage:check`      | `test:coverage:python` then `test:coverage:viewer` then `check:coverage-inventory`; the sole coverage half of `check:all`                                                                                                      |

Optional maintainer gates:

| Command                                     | Purpose                                                                                   |
| ------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npm run hooks:install`                     | Install the pre-push hook path                                                            |
| `npm run hooks:doctor`                      | Verify hook installation                                                                  |
| `npm run release:prepare`                   | Collect release context for version and notes decisions                                   |
| `npm run release:create -- --version=X.Y.Z` | Run the full gate, build release artifacts, commit them, and tag the release              |
| `npm run actions:lint`                      | actionlint over `.github/workflows/*.yml` plus both workflows' exact structural contracts |

The pre-push hook (`.githooks/pre-push`, installed via `npm run hooks:install`) resolves the repository root, sets a
stable locale, and runs exactly one `npm run check:all`, propagating its status.

`.github/workflows/quality.yml` runs the identical `npm run check:all` gate on every pull request and on every push to
`main`, so enforcement does not depend on a contributor having installed the local hook. It declares only
`contents: read`, provisions Node from `.nvmrc` and the toolchain via `npm run setup`, and pins every action by reviewed
commit SHA; it has no write permission and no release step, so the pull-request gate and the pre-push hook can never
diverge in what they check.

Deliberately out of scope: there is no CODEOWNERS file, no branch ruleset, no pre-commit framework, no mutation testing,
no browser automation, and no wall-clock timing benchmark. `.github/workflows/publish-release.yml` is a transport-only
publisher (see [release workflow](../guides/release-workflow.md)): it verifies and republishes artifacts already built
and committed locally by `npm run check:all` and `release:create`, and never itself installs dependencies, lints, tests,
or builds.

Before `typecheck`, `check:core` also runs `check:shared-core`, the blocking `check:generic-surface` scan,
`check:standalone`, and `check:suppressions`. These verify the versioned tooling contract, local genericness profile,
repository containment, and zero inline suppressions respectively.

Rule ownership:

- [Smell prevention](smell-prevention.md) lists every blocking rule enforced by these commands.
- `tools/quality-policy/project-pattern-scopes.json` is the Tier 2 registry profile: it owns the final generic-rule
  identifier list and project-specific scopes. `tools/check-patterns/rules.mjs` verifies that profile against the
  generic and project registries.
- [Coding standards](coding-standards.md) explains the implementation conventions behind the rules.
- [Documentation format](documentation-format.md) defines the required documentation shape behind `npm run docs:check`.
- [Testing infrastructure](testing-infrastructure.md) explains the fake AvNav, coverage, and viewer-test setup.
- [Release workflow](../guides/release-workflow.md) explains release artifact creation and publishing.

## Generic-core inventory

`tools/quality-policy/portable-core-contract.json` is the versioned Tier 1 inventory contract. Its exact-byte manifest
(`tools/quality-policy/shared-core-manifest.json`) is protected by `shared-core-manifest.sha256`; every listed entry is
contained in the current repository root and matches its digest. Local paths, product tokens, report formats, and
runtime payload lists remain Tier 2 profile data. `npm run portable-core:attest` emits only the core version, manifest
digest, generic-rule-tree digest, and sorted entry digests, with no host or repository identity. The signed inventory
includes the contract schema/loaders plus the verifier, generic-surface, and attestation entrypoints.
`npm run check:shared-core` verifies the full contract locally, while `npm run check:generic-surface` and
`npm run check:suppressions` provide blocking genericness and zero-inline-suppression owners. A fresh copy containing
only this repository must pass `npm run check:all` without network access or neighboring-directory inputs.

`npm run starter:create -- --output=/absolute/path --id=my-plugin --name="My Plugin"` creates a product-neutral,
dependency-free learning project with a minimal host boundary, a Node contract test, and its own `npm run check:all`.

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Coding standards](coding-standards.md)
- [Documentation format](documentation-format.md)
- [Smell prevention](smell-prevention.md)
- [Testing infrastructure](testing-infrastructure.md)
- [Release workflow](../guides/release-workflow.md)
