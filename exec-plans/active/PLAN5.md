# PLAN5 - Migrate quality and release tooling to the final local-first system

## Status

Finalized on 2026-07-23 and ready for implementation after repository verification, a commit-by-commit review of the
Dyninstruments quality-system work from `cb146da2535f86c2d23f51c934c5e86c88f935a1` through current Dyninstruments `HEAD`
(`06875c3454fda9a734ee7193ff527cc5ed36f3b2`), and four final executability audits. The latter commit is the authority
correction that removed remote quality governance while preserving the maintained local quality system. The audits made
Phase 0 capture canonicalization, transitional command activation, test-fixture provenance, complete formatter and
unsupported-format disposition, exact Python duplication ownership, developer-Python reproducibility, normalized
coverage-contract ownership, immediate new-file enforcement, gap-free new-function complexity enforcement, structural
JavaScript clone ownership, Python-tool adoption-debt capture, phase-local documentation synchronization, and publisher
allowlisting prescriptive rather than leaving them to implementation judgment.

This plan covers the complete Polar Recorder migration to that final local-first model: reproducible development setup,
maintained standard tools, strict JavaScript source and test typing, coverage and complexity ratchets, deterministic
scaling contracts, property tests, tracked pre-push enforcement, local release authority, a publication-only tag
workflow, and synchronized developer documentation.

The following parts are prescriptive:

- the rollback exclusions and authority model;
- the rule-parity requirement before deleting a current checker;
- the public command graph and final `check:all` composition;
- the immutable Polar Recorder baseline/provenance rules;
- the distinction between transitional command wiring and final command activation;
- the exact maintained formatting inventory shared by write and check modes, plus explicit disposition of maintained
  files that no selected formatter supports;
- the verified developer-Python, bootstrap-installer, lock-generation, and supported-platform contract;
- the exact JavaScript/CSS and Python duplication leaf commands and aggregate;
- retained structural JavaScript clone detection unless jscpd proves equivalent renamed-function and normalized-block
  coverage;
- transitional strict typing, coverage, and complexity enforcement from the first phase that creates a file or function;
- explicit Ruff lint/format adoption-debt capture and disposition for every maintained Python tool;
- the strict-test and separately preauthorized non-executable quality-fixture model;
- the coverage, complexity, test-inventory, hook, and release contracts;
- phase-local owner-documentation synchronization and Phase 9's final consolidation-only boundary;
- phase ordering, file-size constraints, phase exit conditions, and acceptance criteria.

Implementers may choose equivalent internal helper names or split a large tool module differently, provided the same
ownership, negative proof, command, and runtime-preservation outcomes are met. Dyninstruments paths, counts, hashes,
coverage floors, complexity identities, and test exceptions must never be copied as Polar Recorder policy data.

No pre-plan user interview was run. The plan therefore makes these explicit decisions:

1. Product behavior, AvNav integration, persisted data, APIs, viewer output, and release ZIP contents are preserved;
   this is a tooling migration.
2. Polar Recorder uses Python/pytest plus Node's maintained test runner rather than importing Dyninstruments' Vitest
   topology literally. Equivalent split commands, strict test typing, coverage inventory, and focused-test blocking are
   required.
3. Python property testing uses Hypothesis rather than adding JavaScript `fast-check` to test Python-owned math.
4. The current wall-clock performance gate is replaced by deterministic operation-count scaling contracts for every
   scaling-sensitive owner it currently exercises, including the complete `api_handlers.format_polar` path. No benchmark
   baseline is introduced.
5. The current Python release manifest remains the single packaging authority; Dyninstruments' JavaScript ZIP builder is
   not ported.

Repo rules and core principles outrank this plan. If implementation reveals a conflict, amend the active plan and record
the evidence instead of weakening a gate or silently improvising.

---

## Goal

Migrate Polar Recorder from its current bespoke, partially Dyninstruments-derived checks to the final hardened
local-first system now present in Dyninstruments, adapted to Polar Recorder's Python-heavy, static-viewer architecture.

Expected outcomes after completion:

- one reproducible `npm run setup` provisions locked Node and Python developer dependencies plus a checksum-verified
  actionlint binary;
- `npm run check:all` is the canonical complete local gate and expands exactly to deterministic core checks plus full
  coverage checks;
- maintained tools own generic formatting, JavaScript lint, CSS lint, Markdown lint/link checking, workflow lint,
  duplication, type checking, and coverage reporting;
- `npm run format` and `npm run format:check` own the same complete supported maintained inventory, including HTML,
  declarations, structured configuration, lock/package metadata, workflows, source, tests, tools, CSS, and active
  documentation, while every unsupported maintained format has an explicit machine-checked disposition;
- focused repository contracts retain Polar-specific AvNav, Python layering, static viewer, data-boundary,
  documentation-graph, packaging, and smell rules;
- all shipped browser JavaScript and all classified JavaScript tests are strict no-emit TypeScript `checkJs` inputs
  without a runtime build step;
- every shipped Python/browser source file has a measured or narrowly justified contract-owned coverage classification,
  with immutable capture and active no-regression floors, plus native V8 global line/function/statement/branch
  thresholds;
- token clone detection and structural renamed-function/normalized-block clone detection remain independently blocking,
  with exact scan scopes and no duplicate command path;
- JavaScript complexity debt is identity-stable and can only shrink, while Python keeps its existing strict Ruff limits;
- structured boundary markers, generic-suppression blocking, exact unsafe-DOM-sink ownership, and selected hotspot
  budgets match the hardened local policy;
- timing-based performance assertions are gone and selected real Python hot paths have deterministic counted-operation
  scaling contracts plus correctness assertions;
- property-based tests protect circular angle, binning, histogram, and unit conversion invariants;
- the tracked pre-push hook runs the complete local gate once from the repository root, with explicit per-clone
  install/doctor commands;
- releases are prepared, checked, packaged, committed, and tagged locally; the sole GitHub workflow only validates
  tag/artifact identity and publishes the committed ZIP and notes;
- no branch/pull-request quality CI, CODEOWNERS governance, pre-commit framework, tag-side quality job, mutation system,
  browser automation, or benchmark baseline is introduced;
- contributor, agent, testing, quality, and release documentation describes the live command and authority model
  exactly.

---

## Verified Baseline

The following facts were rechecked against the live Polar Recorder repository before this plan was written:

1. Before this plan was created, the repository was clean on `main` at
   `08edef88b0102af6507ef02fd4448f7fd1eaca45`, tagged `v1.0.0-beta.7`. That commit is the immutable Phase 0 capture
   commit even after this plan or later migration work is committed.
2. `exec-plans/active/` contains only `.gitkeep`; completed plans are `PLAN1.md` through `PLAN4.md`. The next sequential
   active path is this file, `exec-plans/active/PLAN5.md`.
3. The documented complete gate is `tools/check-all.sh`; `npm run check:all` delegates to it. `check:core` currently
   means only the JavaScript subgate, which does not match the final Dyninstruments command model.
4. `tools/check-all.sh` runs Ruff lint/format, strict mypy, Python 3.9 compatibility, pytest, pytest coverage, area
   coverage, Python file/header/ contract/dependency/duplication checks, wall-clock performance, runtime finite-value
   contracts, release dry-run validation, and finally `npm run check:js:all`.
5. The Python runtime is Python 3.9+ standard-library only. `plugin.py` is the AvNav boundary and sole lock owner;
   `server/polarrecorder/` is AvNav-free, lock-unaware, thread-unaware, and uses injected clocks/state.
6. The browser runtime is 13 classic scripts under `viewer/`, plus legacy `plugin.js` and module entrypoint
   `plugin.mjs`. Viewer exports live under `window.Polarrecorder`; there is no runtime bundle or build step.
7. `package.json` has 30 lines, an empty `devDependencies` object, no lockfile, no package identity/private marker, no
   `setup`, no Node/npm version contract, and no maintained standard-tool configuration files.
8. The initial verification environment had Node `v26.4.0` and npm `12.0.0`; the finalization recheck had the same Node
   version and npm `12.0.1`. These are environment observations, not repository-owned guarantees. The final
   Dyninstruments contract is Node major 26 and npm `12.0.1`; migration must declare and test that contract rather than
   silently accepting either observed environment.
9. CONTRIBUTING currently instructs developers to create `venv` and run an unpinned
   `pip install ruff mypy pytest pytest-cov coverage`. There is no Python developer requirements or lock file.
10. `npm run check:js:all` passes. The observed baseline includes 15 JavaScript pattern files, 33 Python pattern files,
    27 documentation files, 30 reachable Markdown files, and 13 viewer modules.
11. The initial verification checkout had no documented development virtualenv and `/usr/bin/python` had no Ruff
    installation. At finalization, an untracked local `venv` existed with Python 3.14.6, Ruff 0.15.16, mypy 2.1.0, and
    pytest 9.0.3; `tools/check-all.sh` reached mypy and failed with a mypy internal error. Neither local state is an
    accepted baseline. Phase 0 must select the supported developer-Python/tool combination and establish one complete
    passing baseline before policy migration.
12. Python quality already uses maintained Ruff, mypy, pytest, pytest-cov, and coverage.py. Ruff limits are complexity
    10, 40 statements, 10 branches, 4 returns, and 6 arguments. Mypy is strict over runtime, plugin, and tests.
13. Python branch-enabled coverage is at least 90 percent overall. The validation package has 95 percent line/branch
    floors, and `histogram.py` has 95 percent line and 90 percent branch floors. Current coverage configuration excludes
    `plugin.py` from that gate despite its dedicated integration tests; the migration must measure it explicitly.
14. Viewer coverage is collected through raw `NODE_V8_COVERAGE` data by `tools/check-js-coverage.mjs` and enforces
    line-only per-file floors. Observed line coverage ranges from 73.1 percent to 100 percent except that the configured
    floor for `viewer/viewer.js` is only 45 percent despite an observed 86.2 percent.
15. There is no inventory proving that every production file is coverage-owned, no immutable floor capture, and no
    branch/function/statement viewer floor.
16. There is no strict JavaScript `checkJs` boundary. A read-only TypeScript 7.0.2 strict probe over `plugin.js`,
    `plugin.mjs`, and the 13 viewer scripts reports 429 errors: principally implicit parameters, missing namespace/DOM
    shapes, and nullable DOM values. This requires a dedicated staged phase.
17. There is no JavaScript complexity capture/ratchet and no strict JavaScript test inventory. Python production/test
    complexity is already fail-closed through Ruff.
18. There are 316 pytest test functions across the Python tests and 46 named Node test functions in the current tool
    scripts. No current JS `.only`/`.skip`/`.todo` or pytest skip/xfail marker was found, but no gate prevents one from
    landing.
19. No property/fuzz framework or property-named test exists. Current poisoning/boundary tests are example-based and
    parameter-based.
20. `tools/check-performance.py` uses `time.perf_counter()` with one-second and 1.5-second ceilings plus a 2.8 doubling
    ratio. It is machine-sensitive and is not the deterministic counted-operation model retained in current
    Dyninstruments.
21. Generic documentation, AI-sync, header, namespace, naming, duplication, and several generic JavaScript language
    rules are implemented by repository-owned checkers. They may be removed only after a parity ledger records a
    maintained-tool or focused-contract replacement with clean and negative proof.
22. Markdownlint 0.23.0 with the current Dyninstruments baseline passes all 33 maintained Polar Recorder Markdown files.
    Link-fragment debt is not yet proven because the current custom link checker ignores fragments.
23. A Polar-adapted ESLint 9.39.5 probe reports 16 adoption findings: 15 file overviews need conversion to `@file`, and
    one tool assignment is useless. There is no broad JavaScript lint-debt baseline to carry.
24. A Polar-adapted Stylelint 17.14 probe reports five findings: two uses of non-namespaced `--chip-color` and three
    auto-fixable media range notations. jscpd 5.0.12 reports zero clones over the current JavaScript/CSS scope.
25. A Prettier 3.9.5 probe reports 71 maintained files needing formatting. `viewer/viewer.js` grows from 393 to 417
    non-empty lines and therefore must be split in the same phase before whole-scope formatting. The next closest
    formatted files remain below the limit: README 374, `polar-chart.js` 383, and `export-ui.js` 361 non-empty lines.
26. Other files already near the absolute limit include `tests/test_plugin_integration.py` at 395, `export.py` at 385,
    `plugin.py` at 369, `params.py` at 333, `persistence.py` at 331, and `api_dispatch.py` at 328 non-empty lines.
    Migration annotations or tests must not grow these past 400.
27. The tracked executable `.githooks/pre-push` prepends the Python venv and invokes `tools/check-all.sh`, but does not
    change to the repository root and has no execution/failure-propagation test. `hooks:install` and `hooks:doctor`
    exist; this clone's `core.hooksPath` is currently unset.
28. `.github/workflows/publish-release.yml` is the only workflow. It is tag-only but uses workflow-wide write
    permission, mutable action tags, inline prerelease parsing, and has no timeout or concurrency policy.
29. There is no `.github/CODEOWNERS`, `.github/workflows/quality.yml`, or `.pre-commit-config.yaml`. These absences
    match the final Dyninstruments rollback and are target-state requirements, not gaps.
30. `release:prepare` produces release evidence but has no side-effect-free help contract or dirty-tree rejection.
    `release:create` duplicates SemVer, permits arbitrary dirt under `releases/`, invokes `tools/check-all.sh` directly,
    then uses the Python ZIP/check tools, commits ZIP plus notes, and creates an annotated tag.
31. Runtime package ownership is duplicated between `release-runtime.mjs` and `release_manifest.py`. The shipped
    `plugin.json` is an existing declarative runtime manifest, currently `{}`, which the Python authority parses and
    version-stamps. That module is the actual deterministic ZIP, manifest-shape, exclusion, and validation authority
    and currently yields 54 runtime files.
32. `check-release.py --dry-run`, used by the full gate, checks the current allowlist but does not build or inspect an
    artifact despite documentation implying artifact validation. Seven historical ZIP/notes pairs are present and must
    remain untouched.
33. README is already 350 non-empty lines. Formatter adoption raises it to 374, so development/release text must be
    consolidated and linked to focused docs rather than appended indefinitely.
34. Dyninstruments' surviving post-rollback system includes exact tool pins, standard lint/format/link/duplication
    tools, strict source/test typing, coverage and complexity ratchets, deterministic scaling, a tested tracked pre-push
    hook, fail-closed local release tooling, and a pure tag publisher.
35. Dyninstruments rollback `06875c3` explicitly removed branch/PR quality CI, CODEOWNERS/ruleset governance, the
    pre-commit framework, and tag-side quality execution. It did not remove the local quality policies above.
36. The current `tools/check-performance.py` times both `PolarModel.update_accepted` and the complete
    `api_handlers.format_polar` response path. Replacing it with only model and lower-level projection contracts would
    silently drop an existing performance owner.
37. The current tree has no `.agents/skills/` directory, while the target maintained formatting scope must include agent
    skill Markdown when that root exists. Optional maintained roots therefore require deterministic live-file discovery
    or an equivalent no-unmatched-glob contract.
38. A finalization probe with the locally installed Ruff 0.15.16 found 203 lint findings across the 12 maintained Python
    tools and eight tool files requiring Ruff formatting. The lint findings include existing docstring, exception-style,
    magic-value, CLI `print`, and complexity debt. These counts are diagnostic rather than target-policy data; Phase 0
    must rerun both tool probes with the selected locked Ruff version and freeze the exact adoption disposition before
    Phase 2 removes the broad `tools` exclusion.

---

## Target Authority and Adaptation Model

| Concern                                     | Polar Recorder target owner                        | Decision                                                                                                                                                                        |
| ------------------------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Complete quality authority                  | local `npm run check:all`                          | Canonical; shell entry remains only as a compatibility wrapper                                                                                                                  |
| Generic JS lint/security                    | ESLint flat config                                 | Replace generic custom patterns only after parity proof                                                                                                                         |
| CSS lint/namespace                          | Stylelint                                          | Enforce `--polarrecorder-*`; rename `--chip-color`                                                                                                                              |
| Python/JS/MJS/HTML/CSS/data/Markdown format | Ruff + Prettier                                    | Write/check commands share one exact supported inventory; every unsupported maintained format has an explicit machine-checked disposition                                       |
| Markdown style/links                        | markdownlint-cli2 + Linkinator                     | Retain focused Polar documentation graph/shape contracts                                                                                                                        |
| Workflow syntax                             | pinned actionlint                                  | Provision only during setup; ordinary gates are offline                                                                                                                         |
| JS/CSS/Python clones                        | jscpd + structural JS checker + Python AST checker | jscpd owns token clones; renamed-function/normalized-block JS clones stay focused unless direct parity proves jscpd equivalent; JS and Python groups aggregate exactly once     |
| Python lint/type/tests                      | Ruff + mypy + pytest                               | Preserve and pin; do not replace with JavaScript tooling                                                                                                                        |
| JS source tests                             | Node test runner + existing VM harness             | Do not add Vitest solely for topology parity                                                                                                                                    |
| JS coverage                                 | c8/V8 summary plus inventory                       | Must prove VM-loaded viewer attribution before retiring current collector                                                                                                       |
| Property tests                              | Hypothesis                                         | Apply to Python-owned mathematical invariants                                                                                                                                   |
| Schema/package contract                     | executable Python release/package tests            | `plugin.json` is explicitly owned; `schema:check` is an approved non-port only because no separate schema/layout family exists, and a contract rejects any new unowned artifact |
| Runtime packaging                           | `release_manifest.py` + `release-zip.py`           | Single Python authority; remove JS manifest duplication                                                                                                                         |
| Scaling                                     | deterministic Python operation counts              | Delete wall-clock performance gate after real-path proof                                                                                                                        |
| Git push gate                               | tracked local pre-push hook                        | Explicit per-clone activation; no hidden setup mutation                                                                                                                         |
| GitHub                                      | one tag publisher                                  | Transport only; no quality/build/package authority                                                                                                                              |

Explicitly rejected additions:

- branch, pull-request, scheduled, dispatch, or reusable quality workflows;
- `.github/CODEOWNERS`, required-review ownership, or ruleset setup;
- `.pre-commit-config.yaml` or a second hook framework;
- tag-side setup, npm install, lint, tests, coverage, `check:all`, build, ZIP creation, commit, or tag work;
- mutation/Stryker tooling;
- Playwright, Chromium, Selenium, or another browser/driver requirement;
- committed wall-clock benchmark baselines or advisory performance gates;
- a runtime npm/Python dependency, bundler, transpilation output, or build step.

---

## Hard Constraints

### Runtime and architecture

- Preserve Python 3.9+ stdlib-only runtime behavior and drop-in AvNav install.
- Preserve `plugin.py` as the only AvNav boundary and lock owner.
- Preserve domain module layering, injected clocks, persistence schema, API shapes, validation rules, export behavior,
  and configuration defaults.
- Keep `viewer/*.js` as classic scripts under `window.Polarrecorder`; keep `plugin.mjs` as the only runtime ES-module
  exception.
- TypeScript is strict, no-emit developer analysis only. Do not ship generated JavaScript, declarations, source maps, or
  npm packages.
- The status-module extraction and CSS custom-property rename required by standard tooling must preserve rendered output
  and interaction behavior.

### Quality integrity

- Preserve every current blocking rule unless the parity ledger names its final owner and both clean and
  deliberate-negative proof pass.
- Never weaken/delete tests, lower thresholds/floors, add broad ignores, widen scan exclusions, suppress a smell, or
  self-authorize a new baseline entry to obtain a green gate.
- All warnings in required commands are blocking. There is no warn-only debt tier.
- Immutable policy captures name Polar Recorder's captured commit and must be reproducible from Git. Active ledgers may
  only stay equal or shrink.
- Immutable captures contain only canonical, sorted, repository-relative facts. Raw reports, timestamps, temporary or
  machine-local paths, wall-clock durations, and environment-specific metadata are ephemeral evidence and must not enter
  byte-compared policy artifacts.
- New source/tests are strict and receive the strongest currently available default coverage/complexity policy from the
  phase that first creates them. Every new JavaScript function receives 10/40/4/6 limits even when added to a source path
  present in the Phase 0 capture. Phase 0 activates transitional strict ownership before adding executable policy tests;
  Phase 2 activates transitional strict source typing, current-collector coverage, and a differential complexity owner
  before adding or moving a source function. Later final owners replace those transitional checks atomically, never
  after an unguarded commit. New executable tests or helpers cannot enter an exception capture created after the
  baseline.
- Every contract-owned coverage entry names normalized repository-relative owner-test paths that are executable,
  runner-discovered, strict-inventory-owned where JavaScript, and proven to load or exercise the classified production
  file. Fixtures, excluded tests, stale paths, and collection-only names are not owners.
- Non-executable negative quality fixtures are not executable-test exceptions. Before any such file is created, Phase 0
  must preauthorize its exact path, strict owner test, rule, and reason in an independently anchored planned-fixture
  manifest; unplanned, executable, stale, or ownerless fixture entries fail.
- Keep runtime finite-value, viewer sentinel/zero/placeholder, Python 3.9, dependency-layer, suppression, and
  package-content contracts blocking.
- Generic production lint/type/coverage suppressions are forbidden. The only boundary fallback annotation is the
  structured, rule-scoped marker specified in Phase 3; malformed, misplaced, expired, or wrong-rule markers fail.
- Ordinary gates must be deterministic and network-free after `npm run setup`.
- Immutable canonical captures and active ledgers are separate artifacts. A digest stored inside the policy file it protects
  is not an integrity boundary; expected SHA-256 values must live in independent checker/test constants so a coordinated
  policy-plus-hash edit still fails review and tests.

### File organization and size

- The 400 non-empty-line and anti-compression limits remain absolute for every currently covered source, test, viewer,
  and Markdown file.
- Split `viewer/viewer.js` before applying Prettier. Extract status/history rendering into a role-based module such as
  `viewer/status-ui.js`, register it in `viewer/viewer.html`, update `Depends:` metadata, and cover it in viewer tests
  and coverage inventory in the same phase.
- Do not grandfather moved `viewer.js` functions as new complexity debt. Any extracted function above a strict
  complexity limit must be simplified during extraction.
- Check line counts before and after every phase for `viewer/viewer.js`, `viewer/polar-chart.js`, `viewer/export-ui.js`,
  README, `plugin.py`, `export.py`, `params.py`, `persistence.py`, `api_dispatch.py`, and
  `tests/test_plugin_integration.py`.
- If JSDoc typing pushes a browser file toward 400 lines, split by runtime responsibility in that typing phase. Do not
  compress annotations or code.
- Keep generic quality policy under `tools/quality-policy/`; keep non-executable negative quality inputs under the exact
  root `tests/fixtures/quality/`, outside production scan roots, and enumerate every file and exclusion exactly.
- Update `.gitignore` before provisioning to cover `venv/`, `.hypothesis/`, and `coverage/`. Put c8 temporary data below
  `coverage/viewer/` and prove setup, property tests, and coverage leave no `.nyc_output/` or other untracked tool state
  behind.

### Hooks, release, and GitHub

- `.githooks/pre-push` must be executable, repository-rooted, locale-stable, and invoke exactly one `npm run check:all`.
- `npm run setup` and package lifecycle scripts must not write `.git/config`. Hook activation remains the explicit
  `hooks:install` action.
- `release:create` must run `npm run check:all` exactly once before packaging and allow only the canonical notes file to
  be dirty.
- Preserve full SemVer including prerelease/build metadata, deterministic ZIP timestamps/content, plugin.json version
  stamping, exact runtime-only package contents, release commit, and annotated tag behavior.
- Do not alter, rebuild, reformat, delete, or recommit historical release ZIPs or notes. Do not run the real
  `release:create` command during migration.
- The publisher must remain the only workflow and must only publish committed inputs for the validated tag.

### Documentation and scope

- Update each owner document in the same phase that changes its live source, command, checker, workflow, hook, or release
  contract. Phase 1 synchronizes setup, Phase 2 the viewer split/formatter scope, Phase 3 checker ownership, Phase 4
  source typing, Phase 5 test ownership, Phase 6 coverage/property testing, Phase 7 complexity/scaling, and Phase 8 the
  final command/release/hook/publisher and agent-guidance model before `docs:check` runs. Do not defer a required
  owner-document update to Phase 9.
- Phase 9 contains final cross-document consolidation and residue proof only. It must not change or delete source, tools,
  package scripts, hooks, workflows, or release artifacts.
- README changes are required because setup, validation, and release workflow are user-visible developer contracts. Keep
  the section concise enough to stay below 400 after formatting.
- Make `AGENTS.md` canonical and reduce `CLAUDE.md` to a checked pointer only after equivalent
  documentation/reachability proof exists.
- Do not edit completed plans except to fix a link that this migration itself breaks; preserve them as historical
  evidence.
- Do not update `documentation/TABLEOFCONTENTS.md` unless a new file is added under `documentation/`.
  `.githooks/README.md` is outside that index.
- Do not change ROADMAP product scope or create a release artifact/tag.

---

## Implementation Order

### Phase 0 - Freeze the Polar Recorder baseline and rule-parity ledger

**Intent:** Capture reproducible pre-migration facts and assign every current rule a final owner before any checker,
threshold, or workflow is changed.

**Dependencies:** None.

#### 0A. Record a complete clean baseline

Use a disposable detached worktree at exactly `08edef88b0102af6507ef02fd4448f7fd1eaca45`; do not move
`capturedCommit` to a later commit merely because this plan or migration policy files now exist in the implementation
worktree. From that clean capture worktree:

1. Create an isolated developer virtualenv using the currently documented tools solely to measure the old system. Record
   the exact interpreter executable/version, `ensurepip`/pip bootstrap version, package versions, and host
   OS/architecture.
2. Run and record:

   ```sh
   git status --short
   tools/check-all.sh
   npm run check:js:all
   python tools/check-release.py --dry-run
   npm run release:prepare
   ```

3. Record pytest counts, total/area coverage, a supplementary branch-enabled `plugin.py` line/branch report, all 13
   viewer coverage values, package manifest count, current test/source inventories, and every command's exit status.
4. If the old full gate fails after documented setup, classify and fix an existing repository defect before migration or
   amend this plan with the failure. Do not capture a failing state as accepted debt.
5. Probe the locked Python tools against candidate developer interpreters and choose the exact supported developer-Python
   range, preferred setup interpreter, pinned pip/bootstrap version, canonical lock generator/version/arguments, and
   supported OS/architecture policy. The chosen tools must still analyze the Python 3.9 runtime target. Record evidence
   before Phase 1; do not use an implicit system interpreter, unbounded `python3`, or any `latest` version.

#### 0B. Create immutable canonical captures before active ledgers

Create these Phase 0 artifacts before Phase 5-7 create any active policy:

- `tools/quality-policy/phase0-baseline.json` for `capturedCommit`, exact tool versions, the selected
  developer-Python/bootstrap/lock-generation/platform contract, production/test/formatter-disposition inventories and
  counts, the old command graph, existing thresholds, and an explicit statement that Dyninstruments policy data is not
  an input;
- `phase0-test-capture.json` for the complete executable JavaScript and Python test/helper inventories and the verified
  empty focused/disabled and exception sets;
- `phase0-coverage-capture.json` for clean-run Python, separately measured `plugin.py`, and viewer metrics plus all
  pre-migration configured floors;
- `phase0-complexity-source-capture.json` for the exact JavaScript production inventory, Git blob identities/content
  digests, and intended strict limits at `capturedCommit`, without scanner-dependent findings;
- `phase0-planned-quality-fixtures.json` for every non-executable negative fixture required by this plan, fixed before
  the first fixture file is created. Each entry names one exact path below `tests/fixtures/quality/`, one strict
  JavaScript or fully typed Python owner test, the rule/command it proves, the expected SHA-256 of its intended canonical
  bytes, and why source text rather than a generated in-memory case is necessary. Compute the digest before materializing
  the file and prove the path is absent. An empty manifest is valid; later implementation convenience is not authority to
  add an entry.

Create `tsconfig.migration-tests.json` and `typecheck:migration-tests` immediately after the data-only
`phase0-test-capture.json` exists and before adding the first executable JavaScript proof for the capture generators.
The temporary owner derives the captured executable set, discovers every live executable JavaScript test/helper absent
from it, and checks every such new file with strict no-emit `checkJs`; exact planned non-executable fixtures are the only
exclusion. Missing/stale paths and an empty discovery after the first Phase 0 JavaScript proof exists must fail. Fully
typed Python proof files remain owned by the existing strict mypy test scope. Phase 5 replaces this temporary owner only
when the complete strict inventory passes in the same change.

These are immutable evidence, not the active ledgers introduced later. Define a canonical schema and deterministic
repository-rooted generator for each repository-derived capture. Canonical JSON contains sorted paths/keys,
repository-relative identities, exact normalized numeric metrics, Git blob IDs/digests, and locked tool versions only.
Raw coverage/test reports, timestamps, temporary paths, host paths, wall-clock durations, command-output ordering, and
other environment metadata remain uncommitted evidence. The planned-fixture manifest is reviewer-authored rather than
derived; verify that each authorized path is absent at `capturedCommit` and still absent when the manifest is frozen.
Keep the expected `capturedCommit` and SHA-256 digest of every canonical capture and the fixture manifest in independent
checker/test constants outside the JSON being protected. Tests must regenerate canonical capture bytes from the named
Git blobs/worktree and recorded tools, compare bytes and digests, verify the fixture-manifest digest/absence conditions,
and reject a changed commit, path, normalized metric, limit, source blob, fixture authorization, or coordinated
policy-plus-embedded-hash edit. The generators must be covered by reordered-input and volatile-metadata fixtures proving
semantically identical evidence produces identical bytes. Phase 5-7 active ledgers may derive only from the corresponding
canonical capture and are verified separately. Stable-identity complexity findings are intentionally generated in Phase
7, after the parser/scanner version is locked, from this source capture rather than being required before that tooling
exists.

#### 0C. Freeze the rule-parity ledger

Add a Phase Progress entry to this plan (or a machine-readable policy ledger) mapping every current rule/command to
exactly one target owner:

- maintained tool;
- focused Polar contract test;
- retained Polar-specific checker;
- explicitly approved removal (only the elapsed-time ceilings/doubling-ratio mechanism in `check-performance.py`, and
  only after deterministic model, projection, and complete `api_handlers.format_polar` replacements pass).

At minimum, ledger these owners separately:

- all 32 `PATTERN_RULE_IDS`;
- every `check-smell-contracts.mjs` rule;
- Python contract/dependency/filesize/compat/runtime checks;
- documentation TOC/format/link/reachability and AI-sync checks;
- JS namespace/naming/header/dependency/script-order checks;
- jscpd token clones and the current JavaScript checker's renamed-function/normalized-block clone semantics as separate
  rows, with a retained focused owner whenever direct parity is not proven;
- JS/Python duplication checks, including the exact final `duplication:js`, `duplication:python`, and
  `duplication:check` ownership;
- viewer/Python coverage and current thresholds;
- hook, release prepare/create, runtime-manifest, and publisher behavior.
- focused/disabled test detection, structured boundary suppression, unsafe DOM sinks, selected hotspot budgets,
  installer behavior, and exact `check:core` inclusion;
- Dyninstruments' `schema:check` as an approved non-port only while executable package tests own the existing
  `plugin.json` object/development/release-stamped shapes and a tested inventory proves there is no additional
  declarative schema/layout family; any new artifact must acquire an explicit validator/owner.

No custom checker may be deleted while its row is `unproven`.

#### 0D. Confirm adoption debt and mandatory splits

Re-run the standard-tool probes from Verified Baseline items 22-25 using the versions selected for Phase 1. Record exact
results. In particular, assert:

- `viewer/viewer.js` requires a pre-format split;
- no other formatter target crosses 400;
- Stylelint debt is limited to the named CSS variable/media syntax;
- jscpd begins with zero accepted clones;
- strict source typing begins with the measured error inventory rather than a guessed count;
- `ruff check tools --statistics --no-cache` and `ruff format --check tools` run with the selected locked Ruff version;
  record every finding by path/rule and every formatting target, reconcile the result with finalization diagnostic 38,
  and assign each lint finding to refactoring or one exact justified per-file/per-code CLI exception before Phase 2;
- the complete maintained-file discovery includes `viewer/viewer.html`, all maintained Python tools, `pyproject.toml`,
  the Python requirements input/lock, shell files, SVG files, and every other tracked non-historical file family;
- every maintained file is classified as Ruff-owned, Prettier-owned, or explicitly unsupported by the selected
  formatter set with a reason and alternate validation owner; no file disappears through an unmatched glob or broad
  `tools/` exclusion.

**Phase 0 exit conditions:**

- The old complete gate passes from a documented environment.
- Every current rule has one proposed owner and proof path.
- The exact developer-Python range, interpreter selection, pip/bootstrap version, lock-generation command, and supported
  platform policy are frozen from compatibility evidence.
- Immutable test, coverage, and complexity-source captures reproduce from the captured Git commit.
- Canonical capture regeneration is byte-stable across reordered input and volatile raw-report metadata.
- `npm run typecheck:migration-tests` owns every executable JavaScript test/helper added after the captured test
  inventory, including Phase 0 generator proofs.
- Every planned negative quality fixture is preauthorized by exact path and strict owner before the file exists; the
  executable-test exception set remains empty.
- Required splits, complete formatter/disposition inventory, exact Python-tool lint/format debt, and all remaining
  adoption debt are recorded before formatting/typing.
- `git status --short` contains only intentional Phase 0 policy/plan files.

---

### Phase 1 - Add reproducible setup and the additive command skeleton

**Intent:** Make setup the only routine network-using provisioning step, freeze the separate maintainer-only lock
regeneration path, record the final command graph, and activate only the new command leaves that are already green
without removing old protections.

**Dependencies:** Phase 0.

#### 1A. Lock Node and Python developer tooling

Update `package.json` to include:

- a Polar Recorder dev-tooling name/description, exact non-release version `0.0.0-test`, and `private: true`;
- Node `>=26 <27`, exact npm `12.0.1`, and `packageManager: npm@12.0.1`;
- exact direct dev-dependency pins and a committed `package-lock.json`;
- no runtime dependency section.

Add `.nvmrc` containing `26`.

Create `tools/quality-policy/developer-python.json` from the Phase 0 decision. It is the machine-readable authority for
the exact supported developer-Python range, preferred interpreter, pinned pip/bootstrap version, canonical lock
generator/version/arguments, and supported OS/architecture combinations. The setup helper resolves
`POLARRECORDER_PYTHON` first and otherwise the declared preferred interpreter; it must not silently fall through multiple
system executables. Add `.python-version` when the contract selects one preferred concrete interpreter.

Create reviewable `requirements-dev.in` and fully resolved, hash-locked `requirements-dev.txt`. The input includes exact
direct versions of Ruff, mypy, pytest, pytest-cov, coverage, Hypothesis, and the selected lock generator where needed.
The lock contains hashes for every resolved artifact admitted by the supported-platform policy. Expose one canonical,
tested `requirements:lock` maintainer command using the frozen interpreter/generator/arguments; it may use the network
only during intentional lock maintenance and is never called by a gate. Setup creates/updates `venv` (or
`POLARRECORDER_VENV`), bootstraps through the interpreter's venv mechanism, upgrades pip to the frozen exact version, and
installs only with `python -m pip install --require-hashes -r requirements-dev.txt`. Runtime installation remains
dependency-free. Interpreter, pip, lock metadata, unsupported platform, or resolver-command drift must fail before
ordinary checks run.

`npm run setup` must perform, in order:

1. `npm ci`;
2. locked Python developer-environment provisioning;
3. checksum-verified actionlint provisioning.

No other normal gate may access the network; the explicit `requirements:lock` maintenance command is the only documented
non-setup provisioning exception.

Before the first setup run, extend `.gitignore` with `venv/`, `.hypothesis/`, and `coverage/`. Configure later c8
temporary output under `coverage/viewer/tmp/`; `.nyc_output/` must not be produced at repository root. Add a clean-state
test that runs setup/property/coverage commands in an isolated checkout and fails on any unowned generated path.

Keep the Phase 0 `typecheck:migration-tests` owner active while Phase 1 adds setup, actionlint, and package-contract
tests. Extend its discovery contract rather than replacing or resetting its captured executable set. This keeps every
Phase 0-4 JavaScript test/helper strict without grandfathering a new file; Phase 5 replaces it with the complete strict
inventory and deletes the temporary script/config atomically.

#### 1B. Add maintained-tool configuration

Add Polar-specific versions of:

- `eslint.config.mjs`;
- `.prettierrc.json` and `.prettierignore`;
- `.stylelintrc.json` and `.stylelintignore`;
- `.markdownlint-cli2.jsonc`;
- `linkinator.config.json`;
- `jscpd.config.json`;
- `tools/actionlint.sh` with pinned version/platform checksums and a persistent user-cache path under the Polar Recorder
  name, outside the repository and `node_modules`.

Use the verified Dyninstruments direct versions where the same tool is used. Pin c8 and Node test/type dependencies
exactly. Only fixtures preauthorized in `phase0-planned-quality-fixtures.json` may be excluded, each by exact path rather
than a broad directory pattern that could hide production files.

`tools/actionlint.sh --install` may download only during setup. Normal `actions:lint` must use the verified cache or
fail with the exact setup repair command. Support `ACTIONLINT_CACHE_DIR` for isolated tests and reject a default cache
that resolves inside the repository.

#### 1C. Specify the final public command graph and add only phase-green wiring

Record these final public semantics in a machine-readable command contract while keeping the old full gate authoritative
until each replacement group is clean. Phase 1 adds only `setup`, `actions:lint`, and other already-green leaves; it must
not publish a failing `format`, `format:check`, `lint`, `duplication:check`, or `check:standard` command merely to claim the
final graph early. Phase 2 activates that standard-tool group after the verified formatting/lint adoption and later phases
activate their dependent groups. The final graph is:

```text
setup                   locked npm + Python dev tools + actionlint provision
format                  Prettier + Ruff formatting writes over the shared inventory
format:check            Prettier + Ruff formatting checks
lint                    ESLint + Stylelint + Ruff lint
duplication:js          jscpd token-clone owner + retained structural JS clone owner unless parity proves replacement
duplication:python      python tools/check-duplication.py
duplication:check       duplication:js + duplication:python
check:standard          format:check + lint + actions:lint + duplication:check
typecheck               typecheck:source + typecheck:tests + typecheck:python
test:node               test:tools + test:contract + test:viewer + test:plugin
test:python             pytest without coverage
test:split              test:python + test:node
test:focus:check        static JS/Node/Python focused-or-disabled-test blocker
check:python-contracts  Python 3.9 + architecture + dependency + runtime contracts
package:check           release dry-run + dedicated package/release/installer tests
check:fast              check:standard + typecheck + test:split + check:python-contracts
check:core              exact deterministic non-coverage graph below
test:coverage:check     Python + native V8/c8 coverage + inventory policy
check:all               check:core + test:coverage:check
check:strict            exact alias of check:all
```

The final `package.json` composition is literal and ordered:

```text
check:core = check:standard && typecheck && package:check &&
             test:focus:check && check:smells &&
             check:python-contracts && test:split && check:complexity &&
             check:scaling && docs:check && check:filesize
check:all  = check:core && test:coverage:check
```

This graph deliberately adapts Dyninstruments' core by retaining the Polar-specific Python contract group and runtime
test split. `check:python-contracts` does not also run `tools/check-duplication.py`; Python duplication is owned only by
`duplication:python`. The graph runs Ruff lint/format, strict mypy, Python
compatibility/architecture/dependency/runtime contracts, pytest, every Node tool/contract/viewer/plugin suite, package
checks, and both duplication leaves exactly once. Coverage remains the sole second half of `check:all`.
`test:contract` is reached through `test:node` and `test:split`, not repeated separately in `check:core`.

Until a final group is activated, the old checker graph remains its blocking owner and must stay reachable through
`tools/check-all.sh`; no replacement command may bypass adoption debt with ignores or partial source scope. Phase 2
activates `format`, `format:check`, `lint`, `duplication:check`, and `check:standard` together. Subsequent phases replace
old leaves only after their parity rows are proven. Phase 8 removes compatibility internals and enforces exact strings,
order, write/check formatter-inventory symmetry, no duplicate leaf command, no recursive wrapper, and no undeclared
leaf. `check:ci` and `schema:check` must not be created. A package contract owns the current `plugin.json` object,
development, and release-stamped shapes, proves the absence of any separate schema/layout family, and fails if a new
declarative artifact appears without a validator and owner.

Refactor Python command execution behind a repository-rooted shell helper that prepends `venv/bin` or
`POLARRECORDER_VENV/bin` without downloading. At the end of migration, `tools/check-all.sh` becomes a compatibility
wrapper that executes `npm run check:all`; package scripts must not recurse into it.

#### 1D. Prove setup and package scripts

Add focused tests for:

- package identity/private/version declarations and exact direct pins;
- Node/npm declarations;
- the exact developer-Python/interpreter/bootstrap/platform contract, mismatch failure, canonical lock-generation command,
  hash-required install, locked Python requirements, and no runtime dependency leakage;
- setup ordering and no hook installation side effect;
- actionlint cached success, missing-cache failure, checksum rejection, and install-only behavior;
- the phase activation ledger, final command contract, and no accidental `check:ci`/pre-commit command;
- exact `duplication:js`/`duplication:python` leaf ownership, `duplication:check` aggregation, and absence of a second
  Python-duplication path through `check:python-contracts`, plus structural renamed-clone coverage even when jscpd
  reports no literal clone;
- eventual exact `check:core`/`check:all` expansion, one reachability path for every required leaf, and no omitted Python
  or Node test/contract command, without requiring not-yet-clean groups to be active package scripts in Phase 1;
- transitional strict discovery/typechecking for every executable JavaScript test/helper added after the captured
  Phase 0 inventory, including Phase 0 generator proofs;
- ignored setup/Hypothesis/coverage output and zero stray generated state.

#### 1E. Synchronize setup guidance

Update README's concise developer pointer and CONTRIBUTING's setup section in the same change. Document the declared
Node/npm and developer-Python contract, `npm run setup`, the maintainer-only `requirements:lock` exception, hash-required
Python installation, the persistent actionlint cache, and the fact that normal gates are offline. Do not document
inactive Phase 2-8 command groups as already live.

**Phase 1 exit conditions:**

```sh
npm run setup
npm run actions:lint
npm run test:tools
npm run typecheck:migration-tests
npm run check:docs
tools/check-all.sh
```

All exit zero. A second `actions:lint` invocation succeeds with network access blocked. The contract proves
`check:standard` is intentionally not authoritative before Phase 2, the old full graph still owns every unactivated
protection, `git diff --check` passes, and no runtime package file has changed.

---

### Phase 2 - Split the oversized viewer owner and adopt formatting/linting

**Intent:** Bring every maintained file under standard formatting/linting without violating the file-size limit or
changing viewer behavior.

**Dependencies:** Phase 1.

#### 2A. Split `viewer/viewer.js` before formatting

Before materializing a new shipped viewer file, add `tsconfig.migration-source.json` and
`typecheck:migration-source`. The temporary project derives the captured plugin/viewer inventory from
`phase0-complexity-source-capture.json`, discovers every live shipped JavaScript file absent from that capture, and
checks those new files with strict no-emit `checkJs` plus the focused ambient declarations they require. Once the status
module exists, empty discovery, missing/stale paths, broad `any`, or an omitted new source file fails. Existing captured
files remain outside this temporary project until Phase 4; Phase 4 replaces it atomically with the complete source
inventory.

Before adding or moving any shipped JavaScript function, also add `check:complexity:migration`. Lock the selected
parser/scanner version in Phase 1, derive legacy function/metric identities from the exact Git blobs in
`phase0-complexity-source-capture.json`, and compare those identities with the live `plugin.js`, `plugin.mjs`, and
`viewer/*.js` inventory. The temporary checker must:

- allow a pre-existing Phase 0 function/metric to remain at or below its captured value without creating an active
  self-authored baseline;
- apply complexity 10, 40 statements, nesting depth 4, and 6 parameters to every live function identity absent from the
  Phase 0 capture, including a new function inside a pre-existing source file;
- reject path-change grandfathering, missing/stale source paths, duplicate identities, parser-version drift, and any
  increase in a captured function's value;
- have clean and deliberate-negative proofs for a new file, a new function in an existing file, a moved function, and a
  regression in an existing function.

Phase 7 replaces this temporary differential owner with the immutable findings capture and final active ledger in the
same change.

Extract status/history presentation from `viewer/viewer.js` into `viewer/status-ui.js` (or an equivalently focused
role-based module). The new module owns recent-decision derivation, status cards, value/counter/persistence rendering,
decision colors, and status-local duration/flush presentation.

The shell keeps API base/fetch ownership, tab/heartbeat routing, preset/polar/ timeline/export/settings orchestration,
actions, and tooltip ownership. Pass callbacks/data through a small explicit namespace API; do not duplicate
`ConfigCache`, placeholder, endpoint, timing, or status defaults.

Update in the same change:

- `viewer/viewer.html` script order;
- `Module`/`Documentation`/`Depends` headers;
- `documentation/architecture/ui.md` ownership prose;
- viewer smoke/status tests;
- source/test/coverage inventories introduced later in this plan (or their temporary predecessor lists until those
  phases land).

In the same atomic change, add the new module to the current V8 coverage target inventory with a line floor of at least
80 percent. The temporary differential complexity owner must cover both modules and every other live shipped source
path; an extracted function is a new identity and must satisfy strict limits rather than receive baseline debt. Both
modules must be below 400 non-empty lines before formatting.

#### 2B. Apply Prettier to the complete maintained scope

Formatter ownership must explicitly cover:

- Ruff formatting over `plugin.py`, `server/polarrecorder/**/*.py`, `tests/**/*.py`, and every repository-discovered
  maintained `tools/**/*.py` file;
- `package.json`, `package-lock.json`, all maintained JSON/JSONC configuration, TypeScript configuration, ESLint/tool
  configuration modules, and `.github/workflows/*.yml`;
- `types/**/*.d.ts` as soon as Phase 4 creates declarations;
- `plugin.js`, `plugin.mjs`, all `viewer/*.js`, maintained tool JS/MJS, and Node tests/helpers;
- `viewer/**/*.html`;
- `plugin.css`, `viewer/viewer.css`, and CSS fixtures;
- root Markdown, `documentation/**/*.md`, `.githooks/**/*.md`, agent skill Markdown when present, and
  `exec-plans/active/*.md`.

Create `tools/quality-policy/format-scope.json` as the machine-readable disposition of every maintained tracked file.
Each path is discovered deterministically and classified as `prettier`, `ruff`, or `unsupported`, with exactly one reason
and alternate validation owner for every unsupported file. At minimum, probe and explicitly disposition
`pyproject.toml`, `requirements-dev.in`, `requirements-dev.txt`, shell files, and SVG files rather than letting them
vanish through tool defaults. Historical releases/completed plans and generated/vendor artifacts are separately
classified exclusions, not unsupported maintained files. A newly supported family must move to a formatter owner rather
than retain a stale unsupported entry.

`format` and `format:check` must be generated from or mechanically compared against the same ordered formatter-owned
subset of that inventory; their only difference is Prettier write versus check mode and Ruff format write versus check
mode. Use `--no-error-on-unmatched-pattern` for optional roots such as `.agents/skills/` or deterministic live-file
enumeration with identical absence semantics. Adding an HTML file, declaration, config, workflow, source, test/helper,
CSS, Python tool, root/project doc, active-plan file, or unsupported maintained family must place it in both modes or
acquire an explicit disposition automatically, otherwise the scope contract fails.

Semantic documentation changes in this phase are limited to owner documents made stale by this phase's viewer split,
formatter scope, or lint commands; all other Prettier Markdown changes remain mechanical.

Exclude immutable release notes, completed plans, generated coverage/artifacts, and only the exact negative fixture paths
preauthorized by `phase0-planned-quality-fixtures.json`; `package-lock.json` is maintained and is not excluded. Add a
formatting-scope contract that creates one synthetic maintained file in every supported family, including HTML and a
maintained Python tool, and proves an omitted file, unknown family, stale/ownerless unsupported disposition, broad
exclusion, or write/check inventory asymmetry fails.

After the standard-tool group is green, create the explicitly temporary internal aggregate `check:migration`. It runs the
old complete gate plus every newly activated migration leaf, and later phases append their new green leaves to it. A
contract must reject recursion between package scripts and `tools/check-all.sh` and prove every active protection is
reachable. Temporary duplicate execution inherited from the old graph is acceptable only in this aggregate; it is not a
public final-semantic command, must not be documented outside this plan, and is deleted when Phase 8 activates the exact
once-only final graph.

Add `typecheck:migration-source` to `check:migration` from its first authoritative Phase 2 commit. The old complete gate
continues to run the current viewer coverage collector, including the new module; add
`check:complexity:migration` directly to the aggregate. Package-contract proof must reject any Phase 2-6 aggregate that
omits transitional source typing, current coverage, or differential complexity ownership.

#### 2C. Land ESLint, Stylelint, jscpd, and actionlint cleanly

Configure ESLint for:

- classic browser scripts in `viewer/` and `plugin.js`;
- module mode for `plugin.mjs`, tools, config, and Node tests;
- browser/Node/test globals by scope;
- recommended correctness plus `eqeqeq`, no `var`, no eval/implied eval/new Function, no debug console in runtime,
  unused-disable reporting, and no broad suppression directives;
- existing module-overview headers converted to valid `@file` overviews while preserving Polar's Documentation/Depends
  facts.

Keep Polar-specific patterns in the old checker in parallel until Phase 3.

Configure Stylelint standard rules and the `--polarrecorder-*` custom-property namespace. Rename `--chip-color` to
`--polarrecorder-chip-color` in CSS and its JavaScript producer/tests; apply the three verified media-range syntax
fixes.

Configure jscpd to fail on detected JS/CSS token clones with the proven zero-clone baseline. Freeze its exact maintained
JavaScript/MJS/CSS roots and exact exclusions in policy and add a scope contract that fails when a maintained path is
missing, a stale path is retained, or a broad directory exclusion could hide production/tool code.

Keep the current identifier-normalizing JavaScript duplicate checker, or move its semantics into a focused retained
contract, unless a direct corpus proves jscpd rejects both:

- equivalent function bodies whose local identifiers were renamed;
- long equivalent normalized statement blocks across different functions/files.

Current Dyninstruments retains separate `duplicate-functions` and `duplicate-block-clones` rules alongside jscpd, so
absence of literal token clones is not structural parity. Do not delete the Python AST duplicate checker in this phase.

Remove `tools` from Ruff's broad exclusion. Ruff lint and format must discover every maintained Python tool; if a
verified CLI boundary needs an exception, encode only an exact per-file/per-code lint exception with a reason and
negative contract proof. Implement the Phase 0 path/rule disposition explicitly: no finding may disappear merely because
the selected Ruff version changed, an entire tool was excluded, or a broad rule family was ignored. Ruff formatting has
no corresponding whole-tool exemption.

#### 2D. Add persistent hotspot budgets below the global file limit

Add a `test:contract` hotspot-budget owner for files whose Phase 0 count or formatter result is close enough to 400 that
the global limit alone would invite continued growth. Include at minimum `viewer/polar-chart.js`, `viewer/export-ui.js`,
`plugin.py`, `server/polarrecorder/export.py`, README, and `tests/test_plugin_integration.py`; add any other Phase 0
file at or above 320 non-empty lines. The extracted `viewer/status-ui.js` is included if it reaches that threshold.

Record one explicit, reviewed maximum per path. Each maximum must be below 400, must be no more than ten lines above the
clean post-format count, and cannot be raised to make a change pass. A file already too close to 400 to receive such a
budget must be split in this phase. Missing paths, invalid/duplicate budgets, and one-line-over-budget fixtures fail.
The existing global file-size and anti-compression checks remain independent and blocking.

**Phase 2 exit conditions:**

```sh
npm run format:check
npm run lint
npm run actions:lint
npm run duplication:check
npm run check:standard
npm run test:viewer
npm run typecheck:migration-source
npm run check:js-coverage
npm run check:complexity:migration
npm run check:docs
npm run check:filesize
npm run check:migration
```

All exit zero. A file-count contract proves every formatter-owned target is in both the write and check inventories,
every other maintained target has one explicit supported disposition, optional absent roots do not fail, and a newly
added maintained file cannot escape classification. HTML and maintained Python tools are covered, no broad Ruff
`tools/` exclusion remains, every Phase 0 Python-tool finding has an explicit resolved disposition, the new viewer module
and every new function in an existing viewer file are strict/covered/complexity-limited from their first commit, jscpd
scope and structural clone ownership are exact, and no non-exempt file exceeds 400 non-empty lines. Mock-server/manual
viewer smoke confirms no visible change from the extraction or CSS variable rename.

---

### Phase 3 - Move generic custom checks to maintained tools and contracts

**Intent:** Reduce bespoke checker ownership while preserving every Polar-specific protection with executable parity.

**Dependencies:** Phase 2.

#### 3A. Replace generic JavaScript pattern ownership

For each `check-patterns.mjs` rule, record and prove its final owner. Expected maintained-tool moves include
console/debug use, `var`, loose equality, eval and implied eval, ES-module syntax by runtime scope, empty blocks,
obvious dead/ unused code, global `isFinite`, and generic ESLint suppression misuse.

Retain focused Polar rules for at least:

- machine-local home paths and owned TODO syntax;
- Python suppression syntax not covered by Ruff;
- AvNav/reverse imports, domain locks, and hidden sleeps where existing Python owners do not already cover them;
- producer-guaranteed fallback/re-sanitization and config-default duplication;
- placeholder ownership and responsive-floor ownership;
- boundary-catch markers, Promise catch handling, unsafe DOM sinks, canvas paranoia, namespace contract fallbacks, and
  speculative legacy paths.

Replace the current free-form `polarrecorder-boundary-fallback(<owner>):` comment with exactly these rule-scoped forms:

```text
// polarrecorder-boundary-next-line(category: <slug>, owner: <handle>, date: <YYYY-MM-DD>[, expires: <YYYY-MM-DD>]) -- <reason>
/* polarrecorder-boundary-line(category: <slug>, owner: <handle>, date: <YYYY-MM-DD>[, expires: <YYYY-MM-DD>]) -- <reason> */
```

Only the named boundary catch/fallback and Promise-catch rules may consume the marker. Validate the category allowlist,
non-empty owner/reason, real ISO date, optional expiry, adjacency/line placement, and target rule. Malformed, missing-
field, future-dated, expired, misplaced, unused, duplicate, or wrong-rule markers fail. Convert the existing
`viewer/theme.js` boundary with its real owner/date/reason; do not retain the old syntax as an alias.

Block generic production bypasses (`eslint-disable`, `@ts-ignore`, `@ts-nocheck`, Prettier/coverage ignores, or project
lint-disable comments). Where a standard-tool configuration exception is unavoidable, it must be an exact path/rule
policy entry with an owner and negative fixture, never an inline blanket suppression.

The unsafe-DOM-sink rule must resolve direct, computed, literal, alias, concatenated, and template-composed names and
block:

- simple or compound `innerHTML`/`outerHTML` assignment;
- `insertAdjacentHTML(...)` and `document.write(...)`;
- every statically named `on*` property or `setAttribute` assignment.

The verified production exception set starts empty. If Phase 0 demonstrates an unavoidable reviewed host boundary, its
policy must name the exact enclosing function, target expression, simple `=` operator, RHS shape, and occurrence count;
any alias, second site, compound assignment, changed RHS, or generic suppression still fails. Add clean and negative
fixtures for every syntax and exception dimension before retiring the current rule.

Split the current 736-line checker by responsibility if retained code remains large. Every retained rule needs a clean
and failing fixture; every removed rule needs a negative ESLint/contract proof before deletion.

#### 3B. Replace generic repository/documentation checkers

Move these responsibilities:

- Markdown syntax/style -> markdownlint-cli2;
- file and fragment links -> Linkinator;
- Documentation targets/stale phrases -> focused Node contract;
- required documentation shape -> focused Node contract;
- reachability from canonical agent guidance -> focused graph contract;
- viewer file overview targets -> ESLint JSDoc + documentation contract;
- literal/token JS/CSS clone detection -> jscpd;
- renamed-function and normalized-block JavaScript clones -> retained focused checker unless direct jscpd parity passes;
- generic namespace/global errors -> ESLint.

Retain focused contracts for Polar's TOC completeness, required document sections, viewer script order, `Depends:`
accuracy, namespace cycles, kebab-case viewer filenames/Pascal namespace exports, and smell-catalog completeness. These
may call shared parsing helpers, but must no longer be separate untested CLI implementations.

Update the affected sections of `documentation/conventions/quality-gates.md`,
`documentation/conventions/smell-prevention.md`, `documentation/conventions/coding-standards.md`, and
`documentation/guides/documentation-maintenance.md` in this phase so every removed checker, replacement owner, and live
command is truthful before `docs:check` runs.

Do not remove AGENTS/CLAUDE sync tooling until Phase 8 changes the instruction ownership model and its replacement
contract is active.

#### 3C. Preserve Python-specific duplication and architecture checks

Keep `check-py-contracts.py`, `check-py-dependencies.py`, Python 3.9 compatibility, runtime finite-value checks, and
Python filesize/header checks. Keep both the Python AST duplicate checker and the structural JavaScript duplicate owner
unless direct corpora plus negative-fixture proof show jscpd catches their renamed function-body and long normalized
statement-block semantics without noise. The verified default is to retain both.

Activate these exact groups:

- `duplication:js`: jscpd plus the retained structural JavaScript owner when parity is not proven;
- `duplication:python`: `python tools/check-duplication.py`;
- `duplication:check`: the ordered aggregate of the two groups.

Keep Python duplication out of `check:python-contracts`. Package-contract expansion must prove every underlying owner is
reached exactly once from `check:standard`, and a renamed clone must fail even when jscpd itself reports no literal
clone.

Add missing self-tests for the Python duplication and release-check dry-run owners rather than treating tool exemptions
as test exemptions.

#### 3D. Rebuild the tool/contract test command

Create a focused Node contract-test area and expose:

- `test:tools` for retained checker, setup, actionlint, hook, and quality-policy helpers;
- `test:contract` for repository/source/docs/viewer/hotspot contracts;
- `test:viewer` and `test:plugin` for runtime behavior;
- `test:node` as their aggregate.

Dedicated package, manifest, release orchestration, SemVer, publisher-artifact, and installer tests belong only to
`package:check`; do not also include them in `test:tools`, `test:contract`, or `test:node`. This separation makes the
final core graph complete without executing the same leaf twice.

Every custom rule or contract must have real-repository clean proof and a deliberately failing fixture.

**Phase 3 exit conditions:**

- The parity ledger has no `unproven` generic checker row.
- Deleted scripts have no package/doc references.
- Retained custom code owns only Polar-specific contracts.
- The two duplication leaves and their aggregate have exact command/reachability proof with no second Python path.
- `npm run check:standard`, `npm run test:node`, `npm run docs:check`, `npm run check:smells`, and
  `npm run check:migration` all pass.
- Linkinator proves file and heading-fragment links; negative fixtures prove missing files and missing anchors fail.

---

### Phase 4 - Establish strict no-emit JavaScript source typing

**Intent:** Reduce the verified 429-error browser-source baseline to zero with real module/API contracts and no runtime
build output.

**Dependencies:** Phase 3 and the Phase 2 viewer split.

#### 4A. Add source inventory and ambient contracts

Create `tsconfig.checkjs.json` with `allowJs`, `checkJs`, `strict`, `noEmit`, browser/ES2020 libraries, and an explicit
include/inventory for:

- `plugin.js`;
- `plugin.mjs`;
- every `viewer/*.js` file;
- `types/polarrecorder-globals.d.ts` and any focused split declaration files.

Do not include tool implementations merely to increase a count. ESLint and tool tests own them.

Ambient declarations must model the real `window.Polarrecorder` module APIs, AvNav entrypoint shape, viewer state, API
response payloads, presets/config, chart inputs, and DOM harness boundaries. Raw JSON/host inputs begin as `unknown` and
are narrowed at boundaries; internal module APIs are not left as `any` substitutes.

The Phase 2 shared formatting inventory must discover every new `types/**/*.d.ts` file immediately. Run `format` on the
new declarations during authoring and prove both formatter modes contain the same declaration paths; do not append a
check-only declaration glob later.

Add a contract that scans the live plugin/viewer source inventory and fails if a file is missing or stale in
`tsconfig.checkjs.json`.

#### 4B. Type low-dependency modules first

Make these families strict before high-level orchestration:

1. placeholders and DOM helpers;
2. theme, presets, and grid helpers;
3. import upload and focused settings helpers;
4. polar/timeline chart rendering;
5. export/settings/status UI;
6. viewer shell and both plugin entrypoints.

Use JSDoc typedefs and narrow DOM lookups explicitly. Do not add `@ts-ignore`, `@ts-nocheck`, broad `any`, speculative
optional members, or runtime guards that exist only to placate the checker. Fix producer/consumer contracts and script
order instead.

After each family, run its viewer tests plus `typecheck:source`. Monitor `polar-chart.js`, `export-ui.js`, and every
newly annotated file against the 400-line limit; split in this phase if necessary.

#### 4C. Make source typing fail closed

Wire `typecheck:source` into `check:migration` only after the entire live inventory passes. Remove
`tsconfig.migration-source.json` and `typecheck:migration-source` in that same change; there must be no commit where the
Phase 2 new-source inventory loses strict ownership. Record the final source command's required position under
`typecheck` in `check:core`. Add negative contract fixtures for:

- a new viewer file omitted from the inventory;
- a misspelled namespace method;
- a nullable DOM value used without narrowing;
- runtime `import`/`export` drift;
- an incompatible mock payload.

#### 4D. Synchronize source-typing documentation

Update the affected source-typing/no-build sections of `documentation/conventions/coding-standards.md`,
`documentation/conventions/quality-gates.md`, `documentation/conventions/testing-infrastructure.md`, and
`documentation/architecture/ui.md`. Document the live source inventory and ambient-contract boundary without claiming
the Phase 5 test inventory is active.

**Phase 4 exit conditions:**

```sh
npm run typecheck:source
npm run format:check
npm run test:viewer
npm run test:plugin
npm run check:filesize
npm run docs:check
npm run check:migration
```

All exit zero, `tsc` emits no files, and the source inventory equals the live plugin/viewer set exactly.
The transitional source project is absent, and the package contract proves the complete source project replaced it
without an enforcement gap.

---

### Phase 5 - Standardize Node tests and enforce strict test-code ownership

**Intent:** Put every JavaScript test/helper under one maintained runner, strict type policy, and fail-closed inventory.

**Dependencies:** Phase 4.

#### 5A. Migrate executable test scripts to `node:test`

Move/convert current `tools/test-*.mjs` executables into focused `tests/js/**/*.test.mjs` suites using `node:test` and
strict assertions. Keep reusable CLI tools under `tools/`; keep the current VM viewer harness there or split it only if
moving it would violate the 400-line test limit.

Preserve all current behavior cases and output assertions. The runner must provide deterministic exit codes without
success `console.log` sentinels.

#### 5B. Add strict test inventory and typecheck

Create:

- `tools/quality-policy/test-inventory.json`;
- `tools/quality-policy/test-exception-baseline.json`;
- `tools/quality-policy/test-inventory.mjs`;
- `tsconfig.tests.json`.

Replace and delete `tsconfig.migration-tests.json` plus `typecheck:migration-tests` only when the full inventory and
`typecheck:tests` pass in the same change; there must be no commit where newly added tests lose strict enforcement.

Every executable JavaScript test or helper, including `tools/viewer-harness.mjs` and any replacement helper, is classified
`strict`; there is no new harness exception class. Derive `test-exception-baseline.json` from the verified empty exception
set in `phase0-test-capture.json`, keep it empty and independently digest-anchored, and fail any non-empty active exception
or any executable file classified as a fixture. If an executable helper truly cannot be strict, implementation stops for
a reviewed plan amendment rather than self-authorizing debt.

The only non-strict classification is `fixture`, restricted to non-executable source/data inputs below
`tests/fixtures/quality/` that were named in `phase0-planned-quality-fixtures.json` before creation. Each live fixture must
match its captured content hash, strict JavaScript or fully typed Python owner test, rule/command, and reason. It must not
be imported, discovered by a runner, invoked as a process, or used to exclude its parent directory. Missing, stale,
unplanned, executable, ownerless, path-mismatched, hash-mismatched, or unused fixtures fail. Prefer in-memory/temp-created
negative cases where a committed fixture is unnecessary.

`typecheck:tests` first validates the executable inventory, empty immutable exception capture, and planned fixture
provenance, then runs strict no-emit TypeScript checking over every executable JavaScript test/helper. Add a contract that
proves `tsconfig.tests.json`, runner discovery, and both inventories cannot drift. Replace the temporary
`typecheck:migration-tests` leaf in `check:migration` with `typecheck:tests` only after both pass in the same change.

#### 5C. Block focused/disabled tests

Expose the owner as `test:focus:check` and add static and runner-level checks that fail on JavaScript `.only`, `.skip`,
or `.todo`, Node test skip/todo options, and Python pytest/unittest skip, skipif, or xfail markers. Cover aliases,
imported test helpers, decorator/call forms, and string/comment false positives. The verified initial exception set is
empty; an exception requires a plan amendment, owner/date/reason, hash-locked site, and an explicit negative test.

The command-graph contract must prove `test:focus:check` is directly reached by `check:migration` now and remains a
required direct group of the final `check:core`; it cannot disappear behind a runner configuration change.

#### 5D. Synchronize test-ownership documentation

Update `documentation/conventions/quality-gates.md`, `documentation/conventions/testing-infrastructure.md`, and the
focused/disabled-test rows in `documentation/conventions/smell-prevention.md` with the live `node:test`, strict
inventory, fixture provenance, and `test:focus:check` owners.

**Phase 5 exit conditions:**

```sh
npm run test:node
npm run typecheck:tests
npm run typecheck
npm run test:split
npm run docs:check
npm run check:migration
```

All exit zero. Synthetic missing/stale/self-authorized inventory entries, a non-strict executable helper, an
unpreauthorized/ownerless/executable fixture, and focused/disabled tests fail. The exception baseline remains empty and no
test behavior or assertion was dropped.

---

### Phase 6 - Make coverage inventory-complete and add property tests

**Intent:** Preserve current coverage while making every production file and future file explicitly owned, then add
generative proof for critical math.

**Dependencies:** Phase 5.

#### 6A. Produce stable Python and viewer coverage reports

Write coverage artifacts under ignored repository-local paths rather than machine-global `/tmp` paths:

- `coverage/python/coverage.json` from branch-enabled pytest coverage;
- `coverage/viewer/coverage-summary.json` from c8/V8.

The Python report must measure both `server/polarrecorder/` and `plugin.py` (for example, through separate
`--cov=polarrecorder` and `--cov=plugin` targets). Preserve an independently checked 90 percent aggregate for the domain
package so the boundary file can neither weaken nor mask that requirement.

Configure c8 with `--all`, an explicit viewer/plugin source scope, and `--temp-directory coverage/viewer/tmp`. Prove it
attributes scripts loaded through `vm.runInNewContext(..., { filename })` to every real viewer source, including the new
status module. Only after that proof may `tools/check-js-coverage.mjs` be deleted.

If c8 cannot provide correct VM attribution, stop this sub-step and amend the plan with evidence. The allowed fallback
is to retain a small V8 attribution adapter that writes the same standard summary; silently classifying all viewer files
as contract-owned is forbidden.

Add `coverage/` to `.gitignore`. Coverage commands must clean/recreate only their own report directories and must not
touch release/runtime data.

#### 6B. Add a combined coverage inventory and ratchet

Create Polar-owned equivalents of:

- `tools/quality-policy/coverage-floors.json`;
- `tools/quality-policy/coverage-floor-baseline.json`;
- `tools/quality-policy/check-coverage-inventory.mjs`;
- focused policy and negative-fixture tests.

Every shipped file in these roots must be classified:

- `server/polarrecorder/**/*.py`;
- `plugin.py`;
- `viewer/*.js`;
- `plugin.js` and `plugin.mjs`.

Use `measured` for executable files represented in the reports. `plugin.py` must be measured, with Phase 0 line/branch
values establishing its initial reviewed per-file floors and integration tests raising them where practical; a
`contract-owned` classification may never cover only a portion of a file. Use `contract-owned` only for a wholly
non-executable or genuinely unmeasurable file and name the exact contract/integration tests that own it. Narrow standard
coverage exclusions remain allowed for `TYPE_CHECKING`, abstract/overload bodies, and similarly non-runtime lines.
`__init__.py` may be contract-owned only if it has no executable behavior.

Normalize every owner path to one repository-relative identity. A JavaScript owner must be a runner-discovered
executable test/helper in the strict test inventory; a Python owner must be present in pytest collection. Neither may be
an excluded path, data-only fixture, planned negative quality input, or stale/non-test file. Where mechanically
checkable, the owner must load/import and exercise the classified production file rather than merely exist. Add
deliberate failures for absolute/traversal/duplicate paths, missing or stale owners, owners outside runner discovery,
excluded/fixture owners, and owner tests that do not load the target.

Policy rules:

- current measured values/floors are captured from the clean Phase 0 run;
- `coverage-floor-baseline.json` is derived only from `phase0-coverage-capture.json`; independent expected digests
  protect the canonical capture and baseline relationship from coordinated edits;
- existing configured floors may rise to the stable observed floor but never fall below their old value;
- validation remains at least 95/95, histogram at least 95/90, and aggregate Python remains at least 90 with branches
  enabled;
- native c8/V8 global thresholds are at least 80 percent lines, 80 percent functions, 80 percent statements, and 65
  percent branches; implementation must add meaningful tests until all four pass rather than capture a weaker baseline;
- the coverage inventory independently aggregates `viewer/*.js` and the two plugin entrypoints as named families and
  enforces the same 80/80/80/65 line/function/statement/branch minimums so one family cannot mask the other;
- new behavioral files default to at least 80 percent lines and 65 percent branches until a stricter family floor
  applies;
- missing/stale files, duplicate entries, invalid metrics, lowered floors, self-grandfathered entries, and unjustified
  contract ownership fail;
- improved active floors require the active ledger to shrink/raise immediately.

`test:coverage:check` must generate both reports, let c8 fail natively on its four global metrics, and then run the
inventory/family checker. Add deliberate global line/function/statement/branch failures and family/per-file floor
failures. It is the only coverage half of final `check:all`.

#### 6C. Add Hypothesis invariants

Add focused property tests for:

- `circular_distance`: symmetry, rotation invariance, and result in `[0, 180]`;
- `circular_range`: rotation invariance and result in `[0, 360]`;
- `twa_bin`/`tws_bin`: bounded output for finite inputs and 360-degree TWA periodicity;
- knot/meters-per-second round trips within a named tolerance;
- histogram percentile: `None` only for empty input, otherwise finite and one of the observed deciknot keys, with
  percentile monotonicity.

Strategies must generate finite bounded values and useful edge examples; do not hide NaN/Infinity filtering inside
production code. Pin Hypothesis in the developer lock only.

#### 6D. Synchronize coverage and property-test documentation

Update the live coverage, inventory, contract-ownership, c8 attribution, and Hypothesis sections of
`documentation/conventions/quality-gates.md`, `documentation/conventions/testing-infrastructure.md`,
`documentation/conventions/coding-standards.md`, and `documentation/conventions/smell-prevention.md`. Document normalized
runner-discovered contract owners and the exact coverage floors in this phase.

**Phase 6 exit conditions:**

```sh
npm run test:coverage:check
npm run check:coverage-inventory
npm run test:python
npm run test:viewer
npm run docs:check
npm run check:migration
```

All exit zero. The live production inventory has no unclassified path, every new source file fails until
classified/tested, every contract owner is normalized and runner-discovered, and deliberate floor/ownership regressions
fail.

---

### Phase 7 - Add complexity ratchets and deterministic scaling contracts

**Intent:** Prevent new structural debt and replace machine-sensitive timing assertions with deterministic algorithmic
contracts.

**Dependencies:** Phase 6.

#### 7A. Add the JavaScript complexity no-regression policy

Adapt the Dyninstruments stable-identity scanner for Polar source roots only:

- `plugin.js`;
- `plugin.mjs`;
- `viewer/*.js`.

Create `complexity-scan.mjs`, `phase0-complexity-capture.mjs`, immutable
`complexity-findings-capture.json`, active `complexity-baseline.json`, and `complexity-budget.mjs` under
`tools/quality-policy/`. Strict limits are:

- cyclomatic complexity 10;
- 40 statements;
- nesting depth 4;
- 6 parameters.

The capture command must read the exact Git blobs named by `phase0-complexity-source-capture.json`, fail on any
identity/content mismatch, and use the locked parser/scanner to produce the immutable findings before creating the
active ledger. Active entries use stable lexical function identity, must originate in
`complexity-findings-capture.json`, must equal the current over-limit value, may never increase, and become errors when
stale or improved until removed/reduced. Functions moved into the new status module are not eligible for a path-changed
baseline; keep them strict. Independent expected commit/digest constants protect both source and findings captures;
editing the scanner, capture, and embedded metadata together must not make a regression pass.

Do not create a Python debt ledger: Ruff already blocks those source/test limits without grandfathered debt. Keep Ruff
limits unchanged and covered by config contracts.

Only after the stable-identity checker proves the complete live source inventory may
`check:complexity:migration` be removed. Replace it in the same change, and add package/config proof that every newly
added production JavaScript function, including one added inside a pre-existing file, still receives the 10/40/4/6
limits rather than falling between owners.

#### 7B. Replace wall-clock performance checks

Delete `tools/check-performance.py` and its timing constants/tests only after deterministic replacements pass. In the
same change, update active owner documentation rather than leaving stale performance claims for Phase 9.

Add a small Python operation-count evaluator and focused tests that reject negative/non-integer counts, a synthetic
quadratic sequence, and a configured step-bound violation. Add real contracts for:

1. `PolarModel.update_accepted`: doubling accepted samples has a linear counted dictionary/histogram-operation envelope
   and preserves generation/count/ histogram results.
2. `projection.project_grid`: with a fixed grid, doubling raw-bin input stays inside the declared linear envelope and
   produces the same cells as the ordinary implementation.
3. `api_handlers.format_polar`: call the real public formatter with a populated snapshot and production-equivalent
   TWA/TWS grids. Count both projection-facing snapshot/bin operations and response curve/cell assembly. With the grid
   fixed, doubling raw-bin input must stay inside the declared linear envelope; with the snapshot fixed, increasing grid
   cells must stay within an explicit per-cell step bound. The complete response, including metadata, curves, confidence,
   and missing-cell behavior, must equal the ordinary formatter's expected output. A lower-level `project_grid` result
   alone is not proof for this existing full-format owner.

Use counting mappings/sequences or other test-only observables. Do not add runtime instrumentation, hidden clocks,
sleeps, or test callbacks to domain APIs solely for the gate. Count values must be non-negative finite integers and
correctness assertions must accompany scaling assertions.

Expose the focused tests as `npm run check:scaling`. No wall-clock ceiling, advisory performance command, baseline JSON,
or performance artifact survives.

#### 7C. Wire the policies into core

Expose `check:complexity` as immutable-capture verification followed by the active budget. Wire `check:complexity` and
`check:scaling` into `check:migration`, and record their required final positions in `check:core` before docs/filesize, so
failures are visible as named policy owners before the final graph is promoted.

#### 7D. Synchronize complexity and scaling owner documentation

Update the affected sections of `AGENTS.md`, `documentation/conventions/coding-standards.md`,
`documentation/conventions/quality-gates.md`, `documentation/conventions/smell-prevention.md`, and
`documentation/conventions/testing-infrastructure.md`. Remove the wall-clock command/ceiling claims and document the
exact `check:complexity` and counted-operation `check:scaling` owners, including all three real paths from 7B. Keep any
historical references only in completed plans/releases excluded by the active-residue contract.

**Phase 7 exit conditions:**

```sh
npm run check:complexity
npm run check:scaling
npm run test:python
npm run docs:check
npm run check:migration
```

All exit zero. Negative new/regressed/stale complexity fixtures, quadratic operation fixtures, and a synthetic
full-formatter curve-assembly regression fail. Active searches outside completed plans/releases find no
`check-performance.py`, `perf:check`, timing ceiling, or benchmark-baseline claim, while the parity ledger shows explicit
replacement proof for both old timed owners.

---

### Phase 8 - Harden local hooks, packaging, releases, and the pure publisher

**Intent:** Make local commands the only quality/release authority while hardening the tag publisher as a minimal
transport boundary.

**Dependencies:** Phase 7.

#### 8A. Make the tracked hook exact and tested

Update `.githooks/pre-push` to:

- use bash with `set -euo pipefail`;
- resolve and `cd` to `git rev-parse --show-toplevel`;
- export stable `LC_ALL` and `LANG` values;
- execute exactly one `npm run check:all` and propagate its status.

Rename/adapt `install-hooks.mjs` and `check-hooks.mjs` to the consistent `hooks-install.mjs`/`hooks-doctor.mjs` owners
if useful, preserving package aliases. Installer sets only `core.hooksPath=.githooks` plus executable mode; doctor
verifies both and prints the exact repair command.

Add isolated temporary-repository tests for hook arguments, repository root, failure propagation, install idempotence,
and doctor drift. Tests must never modify the real clone's Git config. Add `.githooks/README.md` with the one-time
per-clone commands.

#### 8B. Centralize SemVer and dirty-tree parsing

Add `tools/release-version.mjs` as the single JavaScript SemVer/tag parser for local release creation and GitHub
publication. It must accept full SemVer, reject invalid/leading-`v` version arguments where appropriate, and classify a
release as prerelease only when the prerelease segment exists; build metadata alone is stable.

Add one shared valid/invalid SemVer corpus consumed by JavaScript release tests and Python `release_manifest.py` tests.
Both implementations must agree on version acceptance, canonical tag/file spelling, and prerelease classification,
including build-only and prerelease-plus-build cases. This prevents the retained Python package authority and the
JavaScript orchestration authority from silently diverging.

Add NUL-safe `tools/release-git.mjs` parsing of `git status --porcelain=v1 -z`, including rename/copy paths and spaces.
`release:prepare --help`/`-h` is side-effect free; normal prepare requires a completely clean tree and reports manual
SemVer evidence. Unknown arguments fail.

`release:create -- --version=VERSION`:

- accepts only the canonical dirty notes path `releases/polarrecorder-VERSION.md`;
- rejects an existing/dirty ZIP and every unrelated tracked/untracked path;
- verifies notes and missing/duplicate tag before the gate;
- invokes exactly one `npm run check:all`;
- only after success runs the Python ZIP builder and full artifact validator;
- stages/commits only matching ZIP plus notes and creates the annotated tag.

Preserve `POLARRECORDER_VENV` resolution for spawned Python tools.

#### 8C. Restore one release-manifest authority and meaningful package checks

Keep `release_manifest.py` as the runtime allowlist, exclusion, deterministic content, stamped version, and archive-name
authority. Remove manifest building/ validation duplication from `release-runtime.mjs`; retain a small advisory
release-impact classifier only if `release:prepare` needs it, and make its non-authoritative role explicit.

Make `python tools/check-release.py --dry-run` actually build and validate a temporary deterministic development-version
artifact (or perform equivalent in-memory archive validation) without writing `releases/`. `package:check` combines this
dry run with focused prepare/create/version/manifest/ZIP tests.

Add positive and negative tests for:

- deterministic order/timestamps/bytes and exactly one top-level `polarrecorder/` directory;
- all current runtime files included and dev/tests/tools/docs/config excluded;
- version stamping and development fallback;
- notes/ZIP pairing, unsafe names, duplicate entries, stale bytes, and missing/ extra paths;
- clean/dirty release preparation;
- `release:create` gate failure with zero ZIP/commit/tag side effects;
- exact-one gate invocation, release commit, annotated tag, and prerelease/build variants using fakes/temp repos only.
- `install.sh` help/argument parsing, dry-run target/source selection, latest-tag parsing, explicit
  stable/build/prerelease version URL construction (preserving the full version string), download failure, unsafe ZIP
  rejection, and zero real network/system-plugin mutation through fake `curl`/`wget`/AvNav commands;
- the approved `schema:check` non-port: `plugin.json` is explicitly validated as an object in development form and as
  the exact version-stamped release form, the inventory of additional schema/layout artifacts is empty, and adding one
  without a validator/owner makes `package:check` fail.

Do not run `release:create` against the real repository.

#### 8D. Reduce GitHub to the hardened publisher boundary

Keep `.github/workflows/publish-release.yml` as the only workflow. Require:

- `v*` tag push trigger only;
- top-level `contents: read` and job-scoped `contents: write`;
- exactly one job named `publish-release`, no `needs`, at most a 10-minute timeout, and ref-scoped non-canceling
  concurrency;
- exactly four reviewed steps in this order: tag-ref checkout, release-tag validation, committed-artifact verification,
  and GitHub Release creation;
- exact `${{ github.ref }}` checkout and no setup-node step;
- only `actions/checkout` and `softprops/action-gh-release` `uses` steps, each pinned to an immutable full SHA with a
  readable version comment;
- shared `release-version.mjs` validation/classification in a step with exact `id: release_version`;
- exact committed `polarrecorder-VERSION.zip` and `.md` lookup in a step with exact `id: release_assets`;
- a release step with exact `tag_name: ${{ github.ref_name }}`, name
  `Polar Recorder v${{ steps.release_assets.outputs.version }}`, body path
  `${{ steps.release_assets.outputs.notes_path }}`, only `${{ steps.release_assets.outputs.zip_path }}` as `files`, and
  prerelease value `${{ steps.release_version.outputs.prerelease }}`.

The job must not install dependencies, invoke npm setup/quality/tests/coverage/ lint, build/package an archive, modify
source, commit, tag, push, or depend on a quality job. Add an actionlint-backed parsed-workflow contract whose primary
rule is an exact allowlist: the sole job ID, complete ordered step list, allowed `uses` identities, checkout/release
fields, and normalized `run` lines must equal the reviewed publisher contract. The only `run` steps are the exact
`node tools/release-version.mjs --github-output "$GITHUB_REF_NAME" >> "$GITHUB_OUTPUT"` validation command and one
`set -euo pipefail` artifact-lookup/output block for the matching ZIP and notes. Any extra workflow, job, step, action,
run line, permission, trigger, or artifact fails; forbidden-operation string checks remain supplementary defense, not
the main boundary.

`release-version.mjs` and every transitive import used by the publisher must depend only on Node built-ins and committed
local modules compatible with runner-provided Node. A workflow contract must execute tag/artifact validation in a
temporary checkout with `node_modules` absent and without setup, proving that the publisher is dependency-free.

#### 8E. Lock the final local command authority

Replace every transitional alias with the literal Phase 1C graph and delete `check:migration` in the same change. Add a
package contract that recursively expands scripts and proves:

- `check:core` has the exact ordered groups specified in Phase 1C;
- every required Ruff/mypy/Python contract/pytest and Node tool/contract/runtime leaf is reachable exactly once, with
  package tests owned only by `package:check`;
- `test:focus:check`, `check:complexity`, `check:scaling`, `docs:check`, and the combined Python/JS `check:filesize`
  cannot be omitted;
- `check:all` is exactly `check:core && test:coverage:check`, `check:strict` is an exact alias, and `tools/check-all.sh`
  only root-scopes that aggregate;
- no recursive cycle, duplicate leaf, undeclared script, `check:migration`, `check:ci`, `schema:check`, or old divergent
  `check:js:all` authority remains.

Run a deliberate failing fixture for each required group and prove both `check:core` and the wrapper propagate its
status. The hook and release tests must separately prove they invoke one `check:all`, not an expanded private copy.

#### 8F. Synchronize delivery owners and canonical agent guidance

In the same phase as 8A-8E, update the live owner documentation for setup, commands, hooks, packaging, local releases,
and the publisher:

- README's concise developer entry point and CONTRIBUTING's complete setup/command/hook/release workflow;
- `documentation/conventions/quality-gates.md`, `documentation/conventions/testing-infrastructure.md`,
  `documentation/conventions/smell-prevention.md`, `documentation/guides/documentation-maintenance.md`, and
  `documentation/guides/release-workflow.md`;
- `.githooks/README.md` for clone-local activation and repair.

Make `AGENTS.md` the canonical instruction owner and replace `CLAUDE.md` with a short checked pointer to AGENTS plus the
mandatory preflight files. Delete `sync-ai-instructions.mjs`, `check-ai-instructions.mjs`, and their package commands
only after the pointer/reachability contract is active, every current reference is updated, and a negative test proves
instruction drift or a broken pointer fails. Update smell-catalog rows and executable owner lists in the same change as
their final command names. These owner updates are required for Phase 8's `docs:check`; Phase 9 must not be used to
repair a knowingly stale live command or tool claim.

**Phase 8 exit conditions:**

```sh
npm run format:check
npm run test:tools
npm run test:contract
npm run package:check
npm run actions:lint
bash -n .githooks/pre-push
npm run docs:check
npm run check:filesize
npm run check:core
git diff --check
```

All exit zero. Repository searches prove one workflow and no CODEOWNERS, pre-commit config, branch/PR trigger, tag
quality job, or remote build path. Historical artifacts are byte-unchanged.

---

### Phase 9 - Consolidate documentation and audit canonical guidance

**Intent:** Consolidate cross-document guidance and prove the already-live system is described consistently, without
source/tool changes.

**Dependencies:** Phase 8.

#### 9A. Audit root developer guidance

Verify the Phase 8 README developer section:

- link to CONTRIBUTING for full setup;
- name `npm run setup`, `hooks:install`, `hooks:doctor`, and canonical `npm run check:all`;
- preserve the runtime stdlib/no-target-install statement;
- state local release authority and link the release guide.

Reduce duplicated prose only where the final cross-document audit finds it necessary so README remains below 400
non-empty lines after Prettier.

Verify CONTRIBUTING covers:

- Node 26/npm 12.0.1 and locked Python developer tooling;
- setup as the only routine network provisioning step, with the explicit maintainer-only `requirements:lock` exception;
- explicit clone-local hook activation;
- `format`, `format:check`, `check:standard`, `check:fast`, `check:core`, `test:split`, and `check:all`;
- local release preparation/manual validation/create/push flow;
- standard-tool-first rule ownership and focused custom-checker exception rule.

#### 9B. Verify canonical agent guidance

Verify the Phase 8 `AGENTS.md` instructions cover the new command graph, coverage/complexity/test inventories, standard
tools, hook setup, local release model, and final gate. Verify `CLAUDE.md` is only the checked pointer to AGENTS and the
mandatory preflight files, obsolete sync tools/package commands are already absent, and the replacement
pointer/reachability contract has clean and deliberate-negative proof.

#### 9C. Consolidate remaining cross-cutting documentation

Review the already synchronized owner docs and update only remaining cross-document or architecture sections of:

- `ARCHITECTURE.md`;
- `documentation/core-principles.md` (canonical local gate wording only);
- `documentation/architecture/ui.md`;
- `documentation/conventions/coding-standards.md`;
- `documentation/conventions/quality-gates.md`;
- `documentation/conventions/documentation-format.md`;
- `documentation/conventions/smell-fix-playbooks.md`;
- `documentation/conventions/smell-prevention.md`;
- `documentation/conventions/testing-infrastructure.md`;
- `documentation/guides/documentation-maintenance.md`;
- `documentation/guides/exec-plan-authoring.md`;
- `documentation/guides/release-workflow.md`.

Confirm the documentation set consistently covers:

- exact command expansion/ownership;
- standard-tool scopes, write/check formatter-inventory symmetry, and retained Polar-specific tools;
- strict source/test typing and no runtime build;
- coverage classification/default/floor policy;
- JS complexity and Python Ruff limits;
- structured boundary markers, exact DOM-sink ownership, and hotspot budgets;
- Hypothesis and deterministic scaling contracts;
- hook opt-in/bypass tradeoff;
- release dirty-state/full SemVer/artifact rules;
- GitHub publisher as transport only;
- explicit absence of CI governance, pre-commit, mutation, browser automation, and timing benchmarks.

Verify `documentation/architecture/ui.md` already names the extracted status owner from Phase 2. Update the root
architecture map for `types/`, `tests/js/`, `tools/quality-policy/`, the status module, and the Python/JavaScript quality
boundaries; do not leave newly created top-level architecture roots undocumented.

Do not postpone a Phase 2/3/7/8 owner correction into this phase. Do not add a performance guide or a new documentation
file unless the existing focused docs genuinely cannot hold the cross-cutting contract.

#### 9D. Run documentation-only proof

Confirm all command examples exist in `package.json`, no active stale custom checker/performance/CI claim remains, and
no absolute user-home path appears. Keep completed plans and release notes outside active prose residue checks where
their historical references are intentional.

**Phase 9 exit conditions:**

```sh
npm run format:check
npm run docs:check
npm run check:filesize
npm run check:core
git diff --check
```

All exit zero. README and every changed Markdown file remain below 400 non-empty lines. No source, tool, package-script,
hook, runtime, workflow, or release artifact change is part of this phase.

---

### Phase 10 - Clean reproducibility, manual smoke, and completion

**Intent:** Prove the migration from a clean setup and archive the plan only after every local authority and
runtime-preservation check is green.

**Dependencies:** Phases 0-9.

#### 10A. Prove clean, offline-capable setup output

In a disposable clean worktree/clone at the final implementation commit:

1. use the declared Node/npm and supported developer Python;
2. run `npm run setup` from no `node_modules`, no venv, and an isolated actionlint cache;
3. disable/intercept network access after setup;
4. rerun representative `actions:lint`, `check:standard`, and `check:core` to prove ordinary checks use only
   locked/cache-local inputs.

Do not delete user data or dependency directories in the working clone to make this proof; use a disposable
worktree/clone.

#### 10B. Run the complete focused and aggregate proof

Run and record at minimum:

```sh
npm run format:check
npm run lint
npm run actions:lint
npm run duplication:check
npm run typecheck
npm run test:split
npm run test:contract
npm run test:focus:check
npm run check:python-contracts
npm run package:check
npm run check:smells
npm run check:complexity
npm run check:scaling
npm run docs:check
npm run check:filesize
npm run test:coverage:check
npm run check:all
tools/check-all.sh
git diff --check
```

`tools/check-all.sh` must execute the npm aggregate, not a divergent second graph. Record final test counts, production
inventories, coverage totals/floors, complexity baseline count, and package manifest count in the plan progress log.

#### 10C. Verify clone-local hook behavior

Run `npm run hooks:install` and `npm run hooks:doctor` in the implementation clone only when intentionally accepting
that local Git-config mutation. The doctor must fail with repair guidance in an isolated unconfigured temp repo and pass
after install. The aggregate quality gate itself must not require local hook configuration.

#### 10D. Perform negative residue checks

Verify active repository state contains:

- exactly one `.github/workflows/*.yml` file;
- no branch/pull-request quality workflow, CODEOWNERS, pre-commit config, mutation config/dependency, browser-driver
  dependency, timing performance gate, `check:ci`, or tag quality job;
- no mutable workflow action tags;
- no ordinary-gate download command;
- no unclassified production/test path;
- no direct npm dependency range/tag;
- no unignored `venv/`, `.hypothesis/`, root `.nyc_output/`, or coverage output;
- no active documentation command absent from `package.json`;
- no generic checker retained without a parity-ledger reason.

#### 10E. Validate the small runtime changes manually

Because Phase 2 splits a shipped viewer module and renames one CSS custom property, run the mock server and the
documented manual browser/AvNav smoke:

- load every tab;
- verify status cards/history strip/tooltip/action buttons;
- verify polar chip colors in day/night modes;
- exercise presets, timeline, export preview, and settings;
- confirm legacy `plugin.js` and modern `plugin.mjs` registration smoke tests.

Record date, AvNav/browser version, result, and any limitation. No browser automation is required.

#### 10F. Complete the plan

Update Status and a Phase Progress Log with final evidence and deviations. Move this file to
`exec-plans/completed/PLAN5.md` only when every acceptance item is met. Do not create a release ZIP, commit, tag, push,
or GitHub Release as part of plan completion.

**Phase 10 exit conditions:**

- The clean setup, offline focused/aggregate sequence, wrapper, hook doctor, residue searches, and manual viewer/AvNav
  smoke all pass with recorded evidence.
- Final inventories, test counts, coverage floors/totals, complexity baseline count, and package manifest count are
  recorded in the Phase Progress Log.
- Every acceptance criterion is checked, Status records completion and any approved deviation, and the plan is moved to
  `exec-plans/completed/PLAN5.md` with no release, commit, tag, push, or GitHub Release side effect.

---

## User-Facing Documentation Impact

README changes are required because the developer installation, validation, hook, and release workflows change. End-user
Polar Recorder behavior, configuration, installation on AvNav, API/export/import formats, and runtime requirements do
not change.

Primary documentation owners:

- README: concise developer entry point and local release pointer;
- CONTRIBUTING: complete setup/command/hook workflow;
- AGENTS/CLAUDE: canonical agent routing and completion rules;
- quality/testing conventions: exact command graph and policy ownership;
- documentation maintenance: standard formatting/link/check workflow;
- release guide: full SemVer, clean-tree, local artifact authority, and pure publisher boundary;
- `.githooks/README.md`: one-time clone-local activation and repair.

These owners are synchronized in the phase that activates their underlying behavior: setup in Phase 1,
viewer/formatter ownership in Phase 2, checker ownership in Phase 3, source typing in Phase 4, test ownership in Phase 5,
coverage/property testing in Phase 6, complexity/scaling in Phase 7, and final
command/hook/release/publisher/agent ownership in Phase 8. Phase 9 only consolidates cross-document guidance and proves
residue-free consistency.

`documentation/TABLEOFCONTENTS.md` remains unchanged unless implementation adds a new documentation file. No release
notes are required because this plan does not create a release or change product behavior.

---

## Acceptance Criteria

### Setup and command authority

- [ ] `package.json` is private, uses non-release version `0.0.0-test`, declares Node 26/npm 12.0.1, has exact direct
      dev pins, and has a committed lockfile.
- [ ] Python developer dependencies are exact/hash-locked and never become runtime dependencies.
- [ ] A Phase 0-verified machine-readable contract freezes the supported developer-Python range, preferred interpreter,
      exact pip/bootstrap version, canonical lock-generator/version/arguments, and supported platforms while preserving
      Python 3.9 target analysis; mismatches fail before tool execution.
- [ ] `requirements-dev.in` and `requirements-dev.txt` have one tested maintainer-only `requirements:lock` generation
      path, and setup installs the resolved lock with `--require-hashes`.
- [ ] `npm run setup` installs locked Node/Python tools and provisions pinned actionlint; ordinary gates perform no
      downloads.
- [ ] `check:all` expands exactly to `check:core` plus `test:coverage:check`; `check:strict` aliases it and `check:ci`
      is absent.
- [ ] `tools/check-all.sh` is only a compatible repository-rooted wrapper around the canonical npm aggregate.
- [ ] Phase 1 keeps the old complete gate authoritative while adoption debt exists; Phase 2 activates the now-clean
      `format`, `format:check`, `lint`, `duplication:check`, and `check:standard` group without an intentionally failing
      public command interval.
- [ ] The temporary `check:migration` aggregate keeps all old and newly active protections blocking through Phases 2-7,
      is recursion-tested and undocumented outside the plan, and is absent after Phase 8 promotes the final graph.
- [ ] `check:standard`, `check:fast`, `check:core`, `test:split`, and focused commands have documented, tested meanings.
- [ ] The literal `check:core` graph reaches Ruff/mypy, every retained Python contract, pytest, and every Node
      tool/contract/viewer/plugin suite exactly once; `test:focus:check` is a direct required group.
- [ ] `duplication:js` owns jscpd plus the retained structural JavaScript owner unless direct parity proves replacement;
      `duplication:python` owns `tools/check-duplication.py`; `duplication:check` aggregates both groups exactly once
      without a second Python path through `check:python-contracts`.
- [ ] Phase 0 canonical test/coverage/complexity-source captures predate active ledgers, exclude volatile/raw-report
      metadata, regenerate byte-identically from normalized repository-relative facts, and have reordering/volatile-input
      negative proof; Phase 7 findings derive from captured Git blobs after tool lock, and independent commit/digest
      anchors prevent self-authorized drift.
- [ ] The temporary strict test owner is active before Phase 0 adds its first executable JavaScript proof and remains
      active until Phase 5 replaces it atomically.
- [ ] Setup, Hypothesis, and c8 use ignored owned paths and a clean-state test proves they leave no stray generated
      repository state.

### Maintained tools and parity

- [ ] `format` and `format:check` share one exact Prettier/Ruff inventory covering package/lock metadata, workflows,
      JSON/JSONC/tool and TypeScript configuration, declarations, JS/MJS, viewer HTML, CSS, every maintained Python tool,
      root/project Markdown, active plans, and optional agent-skill Markdown; scope/asymmetry contracts catch every new
      omitted file and absent optional roots are safe.
- [ ] A machine-readable complete maintained-file disposition gives every unsupported format, including probed TOML,
      requirements, shell, and SVG families, an exact reason and alternate validation owner; unknown/stale dispositions
      and broad Ruff `tools/` exclusions fail.
- [ ] ESLint, Stylelint, markdownlint, Linkinator, actionlint, and jscpd pass with deliberate negative fixtures.
- [ ] `--polarrecorder-*` CSS namespace enforcement passes and visual behavior is unchanged.
- [ ] Every old checker/rule has a final owner; no custom checker was deleted before positive/negative parity proof.
- [ ] Retained custom tools own only Polar-specific contracts and have focused self-tests.
- [ ] Python architecture, compatibility, finite-value, suppression, and duplicate-helper protections remain blocking.
- [ ] jscpd has an exact maintained scan-scope contract, and renamed-function/normalized-block JavaScript clones remain
      blocking through a retained focused owner unless direct parity proves jscpd catches both semantics.
- [ ] `duplication:js`, `duplication:python`, and `duplication:check` reach every underlying clone owner exactly once,
      including the retained structural JavaScript owner when required.
- [ ] Phase 0 captures Ruff lint/format debt for every maintained Python tool with the selected locked version; Phase 2
      resolves every path/rule finding through refactoring or one exact justified CLI exception, with no broad `tools`
      exclusion or silent debt disappearance.
- [ ] Structured boundary markers validate category/owner/date/reason/expiry and fail when malformed, stale, misplaced,
      unused, or applied to another rule.
- [ ] Generic production suppressions are blocked; direct/computed/composed HTML and `on*` sinks fail outside an exact
      reviewed owner (initially none).
- [ ] Selected near-limit files have immutable explicit hotspot budgets below 400, with missing/over-budget negative
      proof.

### Typing, tests, coverage, and complexity

- [ ] Every plugin/viewer source file is strict no-emit `checkJs` input with no `@ts-ignore`, `@ts-nocheck`, broad
      `any`, or runtime build output.
- [ ] `viewer/status-ui.js` and every other source file created before Phase 4 are strict, carry at least the current
      80-percent line-coverage default, and satisfy 10/40/4/6 complexity limits from their first commit.
- [ ] Every JavaScript function added to a pre-existing shipped source file before Phase 7 also receives 10/40/4/6
      limits immediately through the differential migration checker; the final stable-identity owner replaces it
      atomically with no unguarded commit.
- [ ] Every executable JavaScript test/helper, including the viewer harness, is inventory-owned and strict; the immutable
      executable exception baseline is empty.
- [ ] Every executable JavaScript test/helper added in Phases 0-4 is strict from its first phase through the temporary
      post-capture discovery typecheck, which Phase 5 replaces atomically with the complete strict test inventory.
- [ ] Every committed negative quality fixture is non-executable, lives at an exact preauthorized
      `tests/fixtures/quality/` path, has a strict owner and content hash, and fails when unplanned, stale, ownerless,
      hash-mismatched, imported, or runner/process-discovered.
- [ ] JavaScript and Python focused/disabled tests are blocked; the accepted exception set is empty unless this plan is
      amended with evidence.
- [ ] All shipped Python/browser files are measured or wholly contract-owned; `plugin.py` is measured with reviewed
      per-file line/branch floors, and missing/stale/lowered/self-grandfathered coverage entries fail.
- [ ] Every contract-owned coverage owner is a normalized repository-relative, runner-discovered executable test in
      pytest collection or the strict JavaScript inventory, is not a fixture/exclusion, and loads or exercises its target
      wherever mechanically provable.
- [ ] Aggregate 90 percent, validation 95/95, histogram 95/90, and every old per-viewer floor are preserved or raised.
- [ ] Native c8 global and viewer/entrypoint family thresholds enforce at least 80 percent lines/functions/statements
      and 65 percent branches, with negative proof for every metric.
- [ ] New behavioral files default to at least 80 percent line and 65 percent branch coverage.
- [ ] JavaScript complexity uses immutable Polar provenance and an active no-regression/shrink-only ledger; Python Ruff
      limits are unchanged.
- [ ] Hypothesis invariants and deterministic model/projection/full-`api_handlers.format_polar` scaling contracts pass
      with correctness assertions; raw-bin and grid-cell growth are both bounded and a curve-assembly regression fails.
- [ ] No wall-clock performance, mutation, or browser-automation gate remains.

### File size and runtime preservation

- [ ] `viewer/viewer.js` is split before formatter/type migration and every resulting runtime file stays below 400
      non-empty lines.
- [ ] README and all other covered source/test/docs remain below 400 without one-line compression.
- [ ] Viewer module order/dependency metadata, namespace, API behavior, status rendering, actions, CSS colors, and
      legacy/modern entrypoints remain green.
- [ ] Python runtime, AvNav boundary, locking, persistence, configuration, validation, API, export/import, and package
      contents are unchanged.
- [ ] Historical release ZIPs/notes and completed plans remain untouched.

### Hooks, release, and GitHub

- [ ] The executable pre-push hook runs exactly one root-scoped `npm run check:all` and propagates failure.
- [ ] Hook install/doctor are explicit, idempotent, tested in temp repositories, and never hidden in setup/lifecycle
      scripts.
- [ ] Release prepare has clean-tree/help/argument contracts; release create allows only canonical notes dirt and gates
      exactly once before packaging.
- [ ] Python is the single runtime-manifest/ZIP authority; dry-run package validation exercises a real temporary
      artifact without touching releases.
- [ ] Python and JavaScript release authorities pass one shared SemVer corpus; installer tests prove exact
      stable/build/prerelease URLs without real network or system mutation.
- [ ] `schema:check` is absent only under a contract that validates existing `plugin.json` development/release shapes
      and proves no additional schema/layout family exists; adding an unowned artifact fails `package:check`.
- [ ] Full SemVer/prerelease/build classification is shared by local release and publisher; build metadata alone is not
      prerelease.
- [ ] `publish-release.yml` is the sole workflow and contains only the exact allowlisted `publish-release` job and four
      ordered steps; action identities, checkout ref, normalized run lines, release tag/name/body/file/prerelease fields,
      permissions, bounds, and trigger are exact, and every extra workflow/job/step/action/run line fails.
- [ ] Publisher tag/artifact validation succeeds from a temporary checkout without `node_modules`; its JavaScript uses
      only Node built-ins and committed local modules.
- [ ] No branch/PR CI, CODEOWNERS/ruleset, pre-commit, tag quality job, or remote release build is present or
      documented.
- [ ] No real release artifact, commit, tag, push, or GitHub Release is produced during migration.

### Documentation and final validation

- [ ] README, CONTRIBUTING, AGENTS/CLAUDE, quality/testing/smell/playbook/documentation-format/maintenance/release/plan
      authoring docs, and hook README match live commands and authority.
- [ ] Required owner documentation lands in Phases 1-8 with the behavior it describes; Phase 9 changes only
      cross-document prose and leaves source, tools, package scripts, hooks, workflows, and release artifacts untouched.
- [ ] `documentation/architecture/ui.md` names the extracted status owner and `ARCHITECTURE.md` maps the new
      type/test/policy roots.
- [ ] CLAUDE is a checked short pointer to canonical AGENTS; obsolete sync tools are gone.
- [ ] Documentation links include heading-fragment proof and no active stale command/system claims remain.
- [ ] `npm run setup` and the complete clean/offline-capable validation sequence pass from a disposable clean
      environment.
- [ ] Hook doctor proof, final test/coverage/inventory counts, package manifest count, `git diff --check`, and manual
      viewer smoke are recorded.
- [ ] The final diff contains no unrelated user change.
- [ ] PLAN5 is moved to completed only after all criteria pass.

---

## Related

- [Core principles](../../documentation/core-principles.md)
- [Quality gates](../../documentation/conventions/quality-gates.md)
- [Coding standards](../../documentation/conventions/coding-standards.md)
- [Smell prevention](../../documentation/conventions/smell-prevention.md)
- [Testing infrastructure](../../documentation/conventions/testing-infrastructure.md)
- [Documentation maintenance](../../documentation/guides/documentation-maintenance.md)
- [Release workflow](../../documentation/guides/release-workflow.md)
- [Execution-plan authoring](../../documentation/guides/exec-plan-authoring.md)
- Dyninstruments completed `PLAN33.md` through `PLAN36.md`, with PLAN36 and rollback commit
  `06875c3454fda9a734ee7193ff527cc5ed36f3b2` authoritative for delivery scope
