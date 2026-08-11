# PLAN49 - Retire the extraction-readiness layer and close the agent-guidance gap

## Status

This plan covers the removal of the portable/extraction-readiness quality layer, the removal of the
vendored-distribution layer that shares its motivation, the restoration of the five vendored agent skills, the
completion of the inventory generator, the rename of the one policy module whose filename is now actively misleading,
the reduction of green-run gate output noise, and the creation of the missing product-extension guidance in this
repository only.

The cross-repository alignment goal that motivated the portable core is dropped. This repository is no longer a donor
for or a recipient of a shared quality core, and must stop paying for extraction-readiness. That applies to both halves
of the cost: the gates that prove the core is _extractable_ (the portable-core layer) and the gates that prove a
previously _extracted_ copy still matches its source (the vendored-distribution layer). Retiring only the first would
leave `tools/quality-policy/distribution-source.json` declaring a peer repository as its `sourceOwner` and
`npm run check:distribution` verifying vendored bytes for a donor relationship that no longer exists.

Phase order and the per-phase exit conditions are prescriptive. Individual file-level refactoring inside a phase is
flexible as long as the exit conditions hold.

This repository entered the migration with no test framework and no package-manager dependencies at all. That part of
the migration succeeded and is explicitly out of scope for reversal: nothing in this plan reintroduces a hand-rolled
runner, checker, or orchestrator.

Deletion is split from detachment on purpose. The extraction layer is load-bearing for surviving consumers, so Phase 1
severs every survivor-to-target code edge while the targets are still present, and Phase 2 performs the deletion once
nothing reads them. Attempting the deletion first cannot end green.

Every reverse-reference sweep and every `git grep` exit condition in this plan is scoped with `-- ':!exec-plans'`. This
file is inside the tracked tree and names every term being swept for, so an unscoped sweep matches this plan and can
never return empty. The repository already treats `exec-plans/` as outside mechanical scope in two places:
`.prettierignore` line 10 and `HISTORICAL_EXCLUSION_PATTERNS` at `tools/quality-policy/generate-format-scope.mjs`
line 19.

Documentation edits ship inside the implementation phase that causes them, because `tests/js/command-graph.test.mjs`
binds the npm script graph and its role names to gate structure and fails otherwise, and because every phase must leave
`npm run check:all` green. Only free-standing authoring that no contract test forces gets its own phase.

## Goal

After completion:

1. `npm run check:all` and `npm run package:check` no longer run any gate whose only purpose is proving this
   repository's quality core is extractable into another repository, or that a copy vendored out of it still matches.
2. The extraction-only tool entrypoints, the vendored-distribution entrypoints, their locked data files, and their JSON
   Schemas are gone from the working tree.
3. The five previously token-restricted agent skills name real file paths, real npm scripts, and real domain vocabulary
   again, and the repository gains its first project-local skills.
4. Adding a test or helper file requires zero hand edits: one documented `--write` command produces the inventory and
   the `tsconfig.tests.json` files list together.
5. The repository has at least two product-extension guides, so adding an API endpoint or a viewer panel is a documented
   workflow rather than reverse engineering.
6. Green-run checker output stops enumerating full policy surfaces.
7. No gate coverage is weakened: the Python and viewer coverage floors, the direct-ESLint complexity policy, the
   file-size policy, the suppression scan, the focused-test scan in both languages, the runtime contracts, and the
   scaling contracts all keep their current enforcement strength.
8. No repository file reads from, writes to, compares bytes against, or names a peer repository - including as a
   `sourceOwner`, a `materialization` mode, or a vendored-contract digest.

## Verified Baseline

Facts checked against the current working tree at plan-authoring time. Facts 1, 2, 3, 5, 13, and 20 quote the
pre-migration tree and were settled with `git show 908bd5ad:<path>`.

1. `tools/` holds 114 tracked files and 11713 lines of `.mjs`/`.js`/`.sh`/`.py`; the pre-migration tree held 43 files
   and 8562 lines. No `__pycache__` or `.pyc` file is tracked by Git.
2. The pre-migration `package.json` had `"devDependencies": {}` and no lockfile-managed tooling. The current tree has 18
   npm devDependencies plus `requirements-dev.in` / `requirements-dev.txt`, installed with `--require-hashes` by the
   `setup` script in `package.json`.
3. The pre-migration gate `tools/check-all.sh` plus its `check:js:all` chain invoked hand-written runners
   (`tools/test-viewer-{theme,polar,smoke,enhanced,advanced}.mjs`, `tools/test-js-checkers.mjs`,
   `tools/test-check-patterns.mjs`, `tools/test-plugin-mjs.mjs`), hand-written checkers (`check-headers`,
   `check-namespace`, `check-naming`, `check-js-coverage`, `check-js-duplication`, `check-docs`, `check-doc-format`,
   `check-doc-reachability`, `check-duplication.py`, `check-smell-catalog`, `check-smell-contracts`,
   `check-dependencies`), a timing-based `check-performance.py`, and the `sync-ai-instructions.mjs` /
   `check-ai-instructions.mjs` pair. That gate file and all 23 tools it invoked are absent from the current tree.
4. A prior full gate run completed in 1:27 wall clock and reported 91.19% statements / 74.35% branches / 92.46% lines
   over the viewer and plugin surface, with Python coverage gated at `--cov-fail-under=90`. This figure is a recorded
   observation, not a re-runnable assertion; the binding contract is that no floor drops.
5. `CLAUDE.md` is a 22-line pointer to `AGENTS.md`; the pre-migration file was a 207-line duplicate kept in sync by
   `tools/sync-ai-instructions.mjs`. `tests/js/agents-pointer.test.mjs` now enforces the pointer shape.
6. The extraction-only entrypoints are `tools/check-shared-core.mjs`, `tools/check-alignment.mjs`,
   `tools/check-generic-surface.mjs`, `tools/check-generic-conformance.mjs`, `tools/check-standalone-boundary.mjs`,
   `tools/check-quality-profile.mjs`, `tools/portable-core-attest.mjs`, and
   `tools/quality-policy/portable-core-contract.mjs`.
7. `tools/quality-policy/profile-schema.mjs` is **not** extraction-only. Its only importers are
   `tools/check-patterns/project/pattern-context.mjs` and the removable `tools/check-generic-surface.mjs`, and
   `pattern-context.mjs` survives because `tools/check-patterns.mjs` imports it. `profile-schema.mjs` itself imports
   `tools/portable-core/schema-engine.mjs`, which also survives via
   `tests/portable-core/portable-policy-engines.test.mjs`.
8. `tools/portable-core/gate-role-engine.mjs` is imported by `tools/portable-core/gate-orchestrator.mjs`, the
   `check:core` entrypoint. Both must survive.
9. `tools/portable-core/generic-rule-engine.mjs` is imported by `tools/check-patterns/rules.mjs` and by
   `tests/js/check-patterns-registry.test.mjs`. Its `generic-rule-{common,contracts,duplicates,structural}.mjs`
   implementation modules must survive; only the golden-corpus conformance harness above them is extraction-only.
10. `npm run check:suppressions` maps to `node tools/portable-core/suppression-engine.mjs` and is the independent second
    owner of the inline-suppression scan. It must survive.
11. `tools/check-generic-surface.mjs` takes its scope from `loadManifestPaths()` at line 127, which returns
    `readPortableCoreContract(root).mandatoryPaths` unioned with `discoverGenericRulePaths(root)`, and then appends the
    `AGENTS.md#SHARED_INSTRUCTIONS` block as a synthetic target. `tools/quality-policy/portable-core-contract.json`
    holds 44 `mandatoryPaths`: all five `.agents/skills/*/SKILL.md` files, the three `schemas/*.schema.json` files this
    plan deletes, five files under `tests/portable-core/`, the 21-module `tools/portable-core/*` engine set, the five
    removable `tools/*.mjs` entrypoints (four `tools/check-*.mjs` plus `tools/portable-core-attest.mjs`), and five
    `tools/quality-policy/` modules - 5 + 3 + 5 + 21 + 5 + 5 = 44. It holds **zero** paths under `tools/check-patterns/`
    and **zero** under `server/`, `viewer/`, `plugin.py`, or `plugin.js`. Removing the checker therefore cannot change
    any product-code rule and cannot change any Tier 1 pattern rule - but it does relax the skill-directory scan.
    `tools/quality-policy/generic-surface-scope.json` is **not** the tool's scope source despite its name: its only
    reader repo-wide is the removable `tests/js/check-generic-surface.test.mjs`, so it is already dead fixture data.
12. `tests/js/skills-lock.test.mjs` is the second and independent owner of the skill-genericness restriction. It reads
    `tools/quality-policy/generic-tokens.json` into `FORBIDDEN_TOKENS` and applies it to a hardcoded list
    `["preflight", "create-plan", "doc-sync", "scan-smells", "grill-me-repo"]`; it also asserts that
    `skills-lock.json`'s declared skill set equals the on-disk directory set and that each `computedHash` matches its
    `SKILL.md` bytes. `tests/js/check-patterns-registry.test.mjs` is a second live reader of `generic-tokens.json`.
    Removing `check:generic-surface` alone does not lift the token ban.
13. Current agent skill line counts: `create-plan` 22, `doc-sync` 22, `grill-me-repo` 21, `preflight` 25, `scan-smells`
    22 - 112 lines together. The pre-migration tree had no `.agents/` directory at all, so these are net-new. There are
    **zero** project-local skills; `skills-lock.json` marks all five as `"sourceType": "vendored-generic"`.
14. `tools/quality-policy/test-inventory.mjs` already accepts `--write`, and `test-inventory.json` carries the note
    "Regenerate with `node tools/quality-policy/test-inventory.mjs --write`". Its `writeInventory()` writes only
    `test-inventory.json`.
15. The same module's `diffTsconfigTestsInventory()` already reads `tsconfig.tests.json`, already filters `.d.ts`
    entries, and already diffs against `discoverExecutableTestHelpers()`; `runTypecheckTests()` reports
    `is missing from tsconfig.tests.json's files list` and
    `tsconfig.tests.json files list includes stale/removed executable`, but `--write` does not update the file.
    `tsconfig.tests.json` is 78 lines and its `files` array holds **61** entries, exactly matching live discovery today.
    Extending `--write` therefore needs no new source of truth.
16. `tools/quality-policy/coverage-floors.json` is 1430 bytes and keys floors by `families`, `pluginPy`,
    `viewerPerFileLinePercent`, `defaultNewFileLinePercent`, `defaultNewFileBranchPercent`, and `contractOwned`.
    `viewerPerFileLinePercent` holds 17 grandfathered viewer overrides; `contractOwned.javascript` and
    `contractOwned.python` are both empty, so no per-file classification entry exists.
    `tools/quality-policy/coverage-inventory/viewer-coverage.mjs` lines 104-114 fall back to `defaultNewFileLinePercent`
    / `defaultNewFileBranchPercent` when a file has no override, so a **new** production file needs no per-file entry.
    This schema must be preserved.
17. `npm run check:complexity` is
    `eslint --config tools/quality-policy/eslint.complexity.config.mjs viewer/*.js plugin.js plugin.mjs`. Its header
    states "Every violation is an error; there is no baseline." There is no complexity baseline file and no ratchet
    tooling. This design must be preserved.
18. `tools/quality-policy/eslint-complexity-config.mjs` (21 lines) exports `STRICT_LIMITS`. Four files, at five lines in
    total, bind that filename: `tools/quality-policy/eslint.complexity.config.mjs` line 10 (import) and line 4 (header
    comment), `tests/js/quality-gates-doc-numbers-contract.test.mjs` line 16 (import),
    `tests/js/complexity-policy.test.mjs` line 118 (`ADAPTER_RELATIVE_PATH` string literal), and `tsconfig.tools.json`
    line 51. The two filenames differ only by `-` versus `.` before `complexity`.
19. `documentation/guides/` contains exactly `documentation-maintenance.md`, `exec-plan-authoring.md`,
    `manual-avnav-validation.md`, and `release-workflow.md`. There is **no** product-extension guide: no documented
    workflow for adding an API endpoint, a viewer panel, a filter rule, or a settings field.
20. `documentation/` holds 28 Markdown files and 2555 lines, against 27 files and 2296 lines pre-migration.
    `documentation/conventions/quality-gates.md` is 120 lines.
21. `tests/js/quality-gates-doc-numbers-contract.test.mjs` asserts that `quality-gates.md` narrates no inventory entry
    count and that the four narrated thresholds - complexity 10/40/4/6 and viewer coverage 80/80/80/65 - match their
    live config source.
22. The six test files this plan deletes hold 662 lines today: `tests/js/shared-core-manifest.test.mjs` (252),
    `tests/js/shared-instructions.test.mjs` (115), `tests/js/portable-core.test.mjs` (111),
    `tests/js/check-generic-surface.test.mjs` (106), `tests/js/generic-rule-corpus.test.mjs` (31), and
    `tests/portable-core/generic-rule-conformance.test.mjs` (47); the five under `tests/js/` are 615 lines together.
    They are **not** one class, and the difference decides how each is removed. Two import a deleted entrypoint at their
    line 13 and die with it: `shared-core-manifest.test.mjs` and `check-generic-surface.test.mjs`. One is partly
    extraction-only and is split in Phase 1: `portable-core.test.mjs` (baseline fact 23). Two import only surviving
    modules but consume deleted locked data, so they die with that data: `shared-instructions.test.mjs`
    (`tools/quality-policy/shared-instructions.md`) and `generic-rule-conformance.test.mjs`
    (`tests/portable-core/generic-rule-corpus.json` plus `generic-rule-conformance.golden.json`). One is **not**
    extraction-only at all: `tests/js/generic-rule-corpus.test.mjs` imports only `tools/check-patterns/rules.mjs`,
    `tools/portable-core/generic-rule-engine.mjs`, and `tools/check-patterns/rules-core.mjs`, imports no `fs`, and reads
    no data file, so nothing in this plan can break it. Its name refers to the empty **clean corpus** it passes to every
    rule runner, not to the deleted corpus JSON. It is removed only as a duplicate owner, and only after Phase 1 moves
    its two non-duplicated cases into `tests/js/check-patterns-registry.test.mjs`. The deleted data files are
    `tests/portable-core/generic-rule-corpus.json`, `tests/portable-core/generic-rule-conformance.golden.json`, and
    `tests/portable-core/portable-core-attest.golden.json`.
23. `tests/js/portable-core.test.mjs` is only partly extraction-only. Of its 14 tool imports, 12 target **surviving**
    engines (`json.mjs`, `path-policy.mjs`, `complexity-engine.mjs`, `coverage-engine.mjs`, `file-size-engine.mjs`,
    `focused-test-engine.mjs`, `schema-engine.mjs`, `doc-link-engine.mjs`, `format-engine.mjs`,
    `test-inventory-engine.mjs`, `hook-engine.mjs`, `release-engine.mjs`); only `portable-core-attest.mjs` and
    `check-standalone-boundary.mjs` are deletion targets. It is the sole reader of `tests/fixtures/portable-core/`
    (`attestation.json`, `clean.txt`). `tests/portable-core/portable-role-graph.test.mjs` and
    `tests/portable-core/portable-policy-engines.test.mjs` cover surviving code and must survive.
24. `tests/portable-core/portable-role-graph.test.mjs` hard-asserts the exact shape this plan changes:
    `expect(graph.requiredOrder).toHaveLength(17)` (line 18), `expect(profile.portableCore.roleGraph).toBe(...)` (line
    19), adapter fixtures keyed `portable-core` / `generic-surface` (lines 71-72),
    `roles: ["standard", "portable-core", "generic-surface"]` (line 75),
    `expect(result.failedRole).toBe("portable-core")` (line 83), and `roles: ["standalone", "standard"]` asserting a
    `reordered-role` finding (line 88). It must be updated in the same phase that edits the graph.
25. `tools/portable-core/gate-role-engine.mjs`'s `runProfileContractCheck()` **requires** the `portableCore` block:
    lines 89-97 hold the guard, emitting `portableCore is required` at line 90, `coreVersion is required` at line 93,
    and `roleGraph must be repository-relative` at line 96. `gate-orchestrator.mjs` lines 30-33 run that check before
    any adapter, so dropping `portableCore` from `project-profile.json` without editing `gate-role-engine.mjs` makes
    `check:core` exit non-zero.
26. The vendored-distribution layer is four files: `tools/check-distribution.mjs` (170 lines),
    `tools/regenerate-distribution-manifest.mjs` (115 lines), `tools/quality-policy/distribution-source.json` (702
    bytes) and `tools/quality-policy/distribution-manifest.json` (1686 bytes). It exists to prove a copy vendored out of
    this repository still matches its source, and it names the peer explicitly: `distribution-source.json` declares
    `"sourceOwner": "avnav-plugin-ai-environment"` and `"materialization": "vendored-contract-output"`, and
    `regenerate-distribution-manifest.mjs` line 17 hardcodes the same string as `NEUTRAL_OWNER`. Its three npm scripts
    are `check:distribution` (`node tools/check-distribution.mjs`, run inside `package:check`, the `packaging` role),
    `distribution:source:check` and `distribution:source:write`. It is coupled to the portable core: both `.mjs` files
    `import { runPortableCoreAttestation } from "./portable-core-attest.mjs"` at line 13, `check-distribution.mjs` lines
    86-101 compare `manifest.portableCore.{coreVersion,manifestSha256,genericRulesSha256}` against that attestation, and
    `regenerate-distribution-manifest.mjs` line 76 calls it and lines 81-85 write the block into
    `distribution-manifest.json` (present at lines 6-10). `distribution-source.json`'s sorted, unique `paths` array
    holds eleven entries, eight of which this plan deletes; the three survivors are
    `tools/check-patterns/generic/namespace-policy.mjs`, `tools/portable-core/gate-role-engine.mjs`, and
    `tools/portable-core/suppression-engine.mjs`. Line 74 of the generator hashes every listed entry with
    `fs.readFileSync` and throws on a missing file, and `check-distribution.mjs` line 122 emits a `missing` finding for
    an absent path. **Zero** test files reference the layer
    (`git grep -ln 'check-distribution\|regenerate-distribution' -- tests` is empty), so deleting it deletes no test
    coverage. `tools/release-archive.mjs` contains zero occurrences of `distribution` and is fully independent of it.
27. `tools/check-schema.mjs` lines 24-25, its `checkPortableCoreContract()` function at lines 151-159, and the guarded
    call at lines 172-176 validate `tools/quality-policy/portable-core-contract.json` against
    `schemas/portable-core-contract.schema.json`. `schemas/` also holds `generic-rule-corpus.schema.json` and
    `portable-profile.schema.json`, whose subject files this plan deletes. `npm run schema:check` runs inside
    `package:check`.
28. Reverse-reference sweep for the removed script and file names, beyond `package.json`, `AGENTS.md`,
    `documentation/conventions/quality-gates.md`, `tests/js/command-graph.test.mjs`, and the tsconfig files: `README.md`
    lines 514-519, which are a single prettier-wrapped paragraph and must be rewrapped rather than cut at a line
    boundary - the stale gate advertising runs from line 514 to the sentence ending mid-line 517, and the
    fresh-isolated-copy sentence starts mid-line 517 at "For reproducibility," and runs to line 519 and **stays** - plus
    line 521, which points at "the source-owned distribution and archive/peer-copy workflow"; `CONTRIBUTING.md` lines
    58-61 and lines 89-93 (the bullet keeping reusable mechanisms "behind the versioned portable-core contract" is lines
    60-61, not line 60 alone; lines 89-93 are one bullet documenting `distribution:source:check`,
    `distribution:source:write`, `check:distribution` and
    `npm run check:alignment -- --peer /path/to/the/peer-repository`); `documentation/conventions/coding-standards.md`
    lines 128-131; `documentation/conventions/testing-infrastructure.md` lines 63-65, one bullet whose first line
    narrates "the manifest-listed portable-core self-tests"; `documentation/guides/documentation-maintenance.md` lines
    43-45 and the bullet at lines 96-98, whose line 46 names the **surviving**
    `tools/portable-core/suppression-engine.mjs` and must not be touched;
    `tools/quality-policy/generate-format-scope.mjs` line 146, whose `alternateValidation` string is asserted non-empty
    by `tests/js/format-scope.test.mjs` line 27. The bare substrings `portable-core` and `generic-surface` are useless
    as sweep terms: roughly thirty surviving files name the `tools/portable-core/*` engines that stay, including
    `package.json`, `vitest.config.mjs`, `tools/check-patterns/rules.mjs`, `tools/check-file-size.mjs`, and
    `tests/js/suppression-policy.test.mjs`. Every sweep in this plan uses script-name and data-file-name terms instead.
29. `tools/quality-policy/tier1-scan-roots.json` has **zero** readers repo-wide
    (`git grep -l tier1-scan-roots -- ':!exec-plans'` is empty). It is already dead data.
30. `tests/js/command-graph.test.mjs` is 333 lines and asserts the composition of the npm script graph, including the
    role names `portable-core`, `generic-surface`, and `standalone` at lines 22-24, so every script and role removal in
    this plan requires a matching edit there.
31. `package.json` declares `check:shared-core`, `check:alignment`, `check:generic-surface`,
    `check:generic-conformance`, `check:standalone`, `check:profile`, `portable-core:attest`, `check:distribution`,
    `distribution:source:check`, and `distribution:source:write` - ten scripts this plan removes. `package:check` is
    `npm run schema:check && npm run check:distribution && npm run check:alignment && node tools/release-archive.mjs --dry-run && vitest run --project tools <four release tests>`,
    so removing two of its five composed steps leaves `schema:check` first, which `tests/js/command-graph.test.mjs` line
    176 asserts. `check:core` passes 15 roles to the orchestrator; `tools/quality-policy/portable-role-graph.json`'s
    `requiredOrder` holds 17 (those 15 plus `setup` and `coverage`). `tools/quality-policy/project-profile.json`'s
    `adapters` map binds `portable-core`, `generic-surface`, and `standalone` to the removable scripts at lines 39-41.
32. `AGENTS.md` lines 164-166 describe `check:shared-core`, blocking `check:generic-surface`, `check:suppressions`, and
    `portable-core:attest` as required parts of `check:core`.
33. `tools/check-test-focus.mjs` (233 lines) and `tools/check-test-focus.py` (101 lines) implement the focused-test scan
    once per language, and `test:focus:check` runs both. They are not redundant with the native affordances:
    `vitest.config.mjs` sets `allowOnly: false` at lines 26, 44, 55, and 65, which blocks only `.only`, whereas
    `check-test-focus.mjs` also blocks `.skip`/`.todo` (line 30), `skipIf`/`runIf` (line 32), and the options-object
    form (line 34), and `check-test-focus.py` blocks `skip`/`skipif`/`xfail` markers. Owner tests already exist per
    language: `tests/js/test-focus.test.mjs` and `tests/test_test_focus_checker.py`.
34. Every `tools/quality-policy/` policy artifact **except the ones this plan deletes** has a live reader, so no further
    artifact is removable as orphaned data. The audit is complete; nothing is deferred. Verified readers:
    `hotspot-budgets.json` and `hotspot-budgets-baseline.json` (`tests/js/hotspot-budgets.test.mjs`);
    `coverage-floors.json` (`coverage-inventory/{shared,viewer-coverage,python-coverage,floor-baseline}.mjs`,
    `check-coverage-inventory.mjs`, `vitest.config.mjs`); `coverage-floor-baseline.json`
    (`coverage-inventory/{shared,floor-baseline}.mjs`, `check-coverage-inventory.mjs`); `baseline-coverage-capture.json`
    (`coverage-inventory/floor-baseline.mjs`, `generate-format-scope.mjs`, `tests/test_baseline_captures.py`);
    `planned-quality-fixtures.json` (`test-inventory.mjs`, `tests/js/test-inventory.test.mjs`); `developer-python.json`
    (`tests/js/setup.test.mjs`); `project-hook-environment.json` (`tools/quality-policy/run-format.mjs`);
    `test-exception-baseline.json`, `plugin-schema-corpus.json`, `semver-corpus.json`, `project-pattern-context.json`,
    `project-pattern-scopes.json`, `project-schema-profile.json`, and `project-file-size-scope.json` (all with at least
    one live reader each). The exceptions are exactly the artifacts this plan deletes: `tier1-scan-roots.json` has zero
    readers (baseline fact 29), `generic-surface-scope.json`'s only reader is the deleted
    `tests/js/check-generic-surface.test.mjs` (baseline fact 11), and `generic-tokens.json`, `alignment-inventory.json`,
    `portable-core-contract.json`, `shared-core-manifest.json(.sha256)`, `distribution-source.json`, and
    `distribution-manifest.json` lose their last reader inside this plan.
35. `documentation/conventions/testing-infrastructure.md` lines 79 and 83 narrate the `typecheck:tests` workflow and
    describe "`tsconfig.tests.json`'s `include` list"; the file actually uses a `files` array. This doc is the real
    owner of the inventory workflow narration.
36. Hand-rolled Node and Python policy checkers that exist today and are **not** removed by this plan:
    `tools/check-patterns.mjs`, `tools/check-schema.mjs`, `tools/check-distribution.mjs`, `tools/check-file-size.mjs`,
    `tools/check-test-focus.mjs`, `tools/check-test-focus.py`, `tools/check-python-filesize.py`, and the
    `tools/portable-core/*-engine.mjs` set. The migration constraint is about not adding more, not about deleting these.
37. `exec-plans/active/` is otherwise empty and `exec-plans/completed/` does not exist; completed plans are deleted and
    Git history is the archive. That live practice contradicts `documentation/guides/exec-plan-authoring.md`, which
    still instructs a reader to move completed plans into `exec-plans/completed/`. Reconciling the guide is deliberately
    out of scope here - it is neither caused nor blocked by this plan - and is recorded so a later plan can own it.
38. `tests/js/tool-path-existence-contract.test.mjs` is an **indirect** binder that no literal name sweep finds: lines
    58-63 scan `pyproject.toml`, `package.json`, and every `documentation/**/*.md` file with
    `/\btools\/[\w./-]*\.(?:mjs|py|sh)\b/g` and fail if any matched path is absent from disk. It does **not** scan
    `AGENTS.md`, `README.md`, or `CONTRIBUTING.md`. Any phase that removes a `tools/*.mjs` file must therefore drop its
    `package.json` script and its `documentation/` mentions in the same commit, and any new guide may only name `tools/`
    paths that exist.
39. `tests/js/command-graph.test.mjs` binds the removed scripts in a second place beyond the role names at lines 22-24:
    `ALLOWED_OUTSIDE_CHECK_ALL` at lines 41-56 lists `portable-core:attest` (line 53), `distribution:source:check` (line
    54), and `distribution:source:write` (line 55) as scripts intentionally unreachable from `check:all`. Line 285 also
    seeds a synthetic `portableCore: { coreVersion, roleGraph }` block into a fixture profile. Line 176 asserts
    `package:check`'s first composed step is `schema:check`. Lines 185-186 assert that **every** declared npm script is
    either reachable from `check:all` or listed in `ALLOWED_OUTSIDE_CHECK_ALL`, and line 191 asserts the reverse - that
    every allowlist entry names an existing script. `check:all` reaches this test through the `test-split` role
    (`test:split` -> `test:node` -> `test:tools`, and `vitest.config.mjs` line 16 includes `tests/js/*.test.mjs` in the
    `tools` project). So removing a script requires dropping its allowlist entry in the same phase, and adding any new
    script that `check:all` does not run requires adding an allowlist entry in the same phase.
40. `tools/portable-core/lint-policy.mjs` (5 lines, exporting `STRICT_LINT_FAMILIES`) has **zero** code importers today.
    Its only references are `tools/quality-policy/portable-core-contract.json` lines 13 and 86,
    `shared-core-manifest.json` line 36, the two attestation goldens, and `tsconfig.tools.json` line 77 - every one of
    which this plan deletes. It is the only such module: a sweep over `tools/*.mjs`, `tools/check-patterns/**`,
    `tools/portable-core/*.mjs`, and `tools/quality-policy/**/*.mjs` found no other module left orphaned by this plan.
41. `tools/quality-policy/shared-core-manifest.sha256` is the **only** `.sha256` file in the tracked tree. The branch at
    `tools/quality-policy/generate-format-scope.mjs` lines 142-148 classifies `.sha256` files as `unsupported` with the
    `alternateValidation` string `"npm run check:shared-core verifies the signature and manifest bytes"` at line 146.
    `tests/js/format-scope.test.mjs` line 27 asserts every `unsupported` row carries a non-empty `alternateValidation`,
    but it iterates only rows produced from files that exist, so once the file is gone the branch is unreachable rather
    than failing. `generate-format-scope.mjs` writes no committed artifact; the scope is computed at run time.
42. `.agents/skills/**/*.md` is covered by both `npx prettier --check` and `markdownlint-cli2` (which lints 42 files
    repo-wide, including the five `SKILL.md` files). It is **not** covered by `npm run check:filesize`:
    `tools/quality-policy/project-file-size-scope.json` declares a `note` plus exactly `rootMarkdownFiles`,
    `rootJsFiles`, `viewerScanRoot`, `documentationScanRoot`, and `toolsScanRoot`, none of which reaches `.agents/`. So
    skill files have no 400-line ceiling but must satisfy prettier and markdownlint.
43. `exec-plans/` is already excluded from mechanical scope in two committed places: `.prettierignore` line 10 excludes
    `exec-plans/completed/`, and `HISTORICAL_EXCLUSION_PATTERNS` at `tools/quality-policy/generate-format-scope.mjs`
    line 19 excludes the same. `markdownlint-cli2` and `npx prettier --check` **do** cover `exec-plans/active/`, and
    this file currently passes both.
44. Thirteen tracked files print a `SUMMARY_JSON=` line. Seven are deletion targets. **Six survive**, and only two of
    those enumerate a full policy surface. `tools/check-patterns/runner.mjs` prints a 2389-character summary line on a
    clean tree - all 29 rules enumerated three times over, in `byRule`, `byRuleFailures`, and `byRuleWarnings` - inside
    a 2411-character total `npm run check:patterns` output. `tools/check-file-size.mjs` prints 325 characters, a
    23-character pass line plus a 300-character summary carrying a nine-entry all-zero `onelinerByKind` roster; the
    remaining 38 characters of the 363-character `npm run check:filesize` output come from
    `tools/check-python-filesize.py` and are out of scope. The other four survivors enumerate nothing:
    `tools/portable-core/gate-orchestrator.mjs` line 119 prints `{ok, executed, failedRole}`, which is the executed-role
    audit trail rather than a policy roster; `tools/release-archive.mjs` line 143 prints one only under `--version`, and
    the `--dry-run` that `package:check` runs emits 49 characters in total;
    `tests/js/viewer-dependency-contract.test.mjs` lines 73 and 77 and `tests/js/viewer-structure-contract.test.mjs`
    lines 68 and 72 each print one contract summary inside the vitest run, which is per-test evidence rather than a
    policy roster. No test parses a printed `SUMMARY_JSON=` line: `tests/js/check-patterns.test.mjs` asserts on the
    returned `result.summary.byRule` object with `print: false` (line 484) and never asserts a zero count, so trimming a
    printed line changes no owner test.
45. `tests/portable-core/generic-rule-corpus.json` is both a `mandatoryPaths` entry of
    `tools/quality-policy/portable-core-contract.json` and one of the 44 digest-bearing entries of
    `tools/quality-policy/shared-core-manifest.json`. Renaming or removing it therefore cannot fail only its own reader:
    `check-shared-core.mjs` line 72 reports the missing manifest entry, `tools/portable-core-attest.mjs` line 24
    rehashes every manifest entry and so changes `manifestSha256`, `check-distribution.mjs` lines 86-101 compare that
    value, and `tests/js/shared-core-manifest.test.mjs` fails with the checker.
    `tools/quality-policy/generic-tokens.json` is in the contract's `profileSchemas` array, not in `mandatoryPaths` and
    not in the manifest, so it has no such cascade. `tools/quality-policy/shared-instructions.md` is in neither and is
    read only by `tests/js/shared-instructions.test.mjs`. Any probe that removes locked data must account for this
    asymmetry.

## Hard Constraints

- **No product behavior change.** `server/`, `viewer/`, `plugin.py`, `plugin.js`, `plugin.mjs`, `plugin.json`,
  `plugin.css`, and `data/` must not change. No API contract, no persistence format, no filter or validation rule, and
  no viewer behavior changes anywhere in this plan. `tools/release-archive.mjs` and the release workflow are untouched:
  baseline fact 26 records that `release-archive.mjs` contains zero `distribution` references, so retiring the
  vendored-distribution layer cannot affect packaging output.
- **No additional hand-rolled tooling.** No new hand-rolled test runner, linter, duplication checker, orchestrator, or
  timing-based performance gate may be introduced, and none of the removed ones from baseline fact 3 may return. The
  existing policy checkers in baseline fact 36 stay; extending one of them is allowed, replacing a framework-owned check
  with a new hand-rolled one is not. Every framework-owned check stays owned by vitest, pytest, eslint, ruff, mypy,
  stylelint, markdownlint, jscpd, linkinator, or tsc.
- **No gate may be weakened to reach green.** No coverage floor may drop, no complexity limit may rise, no rule may move
  from `block` to `warn`, no test may be skipped, and no suppression may be added. Removing a gate is allowed only for
  the extraction-only gates named in Phase 2. Where a deleted test covered surviving code, its cases move rather than
  disappear. Three deletions are covered by that rule and each names its receiver: `tests/js/portable-core.test.mjs`'s
  12 surviving-engine cases move to `tests/portable-core/portable-policy-engines.test.mjs` (Phase 1),
  `tests/js/generic-rule-corpus.test.mjs`'s two non-duplicated cases move to `tests/js/check-patterns-registry.test.mjs`
  (Phase 1), and `tests/portable-core/generic-rule-conformance.test.mjs`'s per-rule behavioral assertions are already
  independently owned - `tests/js/check-patterns.test.mjs` seeds a positive violation per rule across 28 cases and
  `tests/js/check-patterns-registry.test.mjs` line 98 exercises `runGenericRule` directly - so only its golden-file
  comparison against the deleted corpus goes, and Phase 2 must say so rather than claim the file covered nothing.
- **Must survive with their purpose intact:** `tools/quality-policy/profile-schema.mjs`,
  `tools/portable-core/gate-orchestrator.mjs`, `tools/portable-core/gate-role-engine.mjs`,
  `tools/portable-core/schema-engine.mjs`, `tools/portable-core/suppression-engine.mjs`, every
  `tools/portable-core/generic-rule-*.mjs` module, `tests/portable-core/portable-role-graph.test.mjs`,
  `tests/portable-core/portable-policy-engines.test.mjs`, `tests/js/agents-pointer.test.mjs`, the family-plus-default
  `coverage-floors.json` schema, the baseline-free direct-ESLint complexity policy, and the focused-test block in both
  languages. Baseline facts 7 through 10, 16, 17, 23, and 33 record why.
- **Edited, not deleted:** `tools/quality-policy/portable-role-graph.json`, `tools/quality-policy/project-profile.json`,
  `tools/portable-core/gate-role-engine.mjs`, `tools/check-schema.mjs`,
  `tools/quality-policy/generate-format-scope.mjs`, `tools/quality-policy/test-inventory.mjs`,
  `tests/portable-core/portable-role-graph.test.mjs`, `tests/portable-core/portable-policy-engines.test.mjs`,
  `tests/js/check-patterns-registry.test.mjs`, `tests/js/skills-lock.test.mjs`, `tests/js/command-graph.test.mjs`,
  `tests/js/test-inventory.test.mjs`, `tests/js/complexity-policy.test.mjs`,
  `tests/js/quality-gates-doc-numbers-contract.test.mjs`, `tests/js/test-focus.test.mjs`,
  `tests/test_test_focus_checker.py`, `package.json`, `skills-lock.json`, `tsconfig.tools.json`, and
  `tsconfig.tests.json` all change shape in this plan. They are named here so a reader does not mistake them for frozen
  survivors.
- **Every sweep excludes this plan.** Every reverse-reference sweep and every `git grep` exit condition below is scoped
  with `-- ':!exec-plans'`. Baseline fact 43 records why: this file names every term being swept for, so an unscoped
  sweep can never return empty and the exit condition could never be met.
- **Every phase ends green.** `npm run check:all` must pass at each phase boundary. Three contract tests bind
  documentation and the script graph to gate structure: `tests/js/command-graph.test.mjs` fails any declared script that
  is neither reachable from `check:all` nor allowlisted (baseline fact 39),
  `tests/js/tool-path-existence-contract.test.mjs` fails the moment `package.json` or any `documentation/**/*.md` file
  names a `tools/` path that no longer exists (baseline fact 38), and
  `tests/js/quality-gates-doc-numbers-contract.test.mjs` binds narrated thresholds to their config source. So a phase
  that changes a gate ships the matching `package.json`, `AGENTS.md`, and `documentation/conventions/quality-gates.md`
  edits inside that same phase - that grouping is mechanically forced, not a stylistic preference. Free-standing
  documentation authoring that no contract test forces stays in its own phase.
- **No plan or phase citation escapes this file.** Deliverables outside `exec-plans/` must not cite `PLAN49` or a phase
  number in a comment, docstring, JSON note, error message, test name, or filename.
- **Scope boundary:** `tools/`, `tests/`, `types/`, `.agents/skills/`, `skills-lock.json`, `documentation/`,
  `AGENTS.md`, `CLAUDE.md`, `README.md`, `CONTRIBUTING.md`, `package.json`, the `tsconfig.*.json` files, and exactly
  three files under `schemas/` (`portable-core-contract.schema.json`, `generic-rule-corpus.schema.json`,
  `portable-profile.schema.json`, all deleted in Phase 2). Every other file under `schemas/` is frozen.
- **Peer repository stays untouched and unread.** This plan must not read from, write to, assert byte-identity against,
  or size-compare a deliverable to any other repository. Skill and guide depth targets are absolute line and content
  counts stated in this file, never "match the peer".

## Implementation Order

### Phase 1 - Detach the survivors from the extraction layer

Intent: sever every code edge from a **surviving** file to a deletion target while the targets are still present, so
Phase 2's deletion breaks no importer.

Amendment: `tools/portable-core/gate-role-engine.mjs` is a manifest-listed distribution source. Its required detachment
change makes `check:distribution` stale until the existing distribution manifest is regenerated. Phase 1 therefore also
regenerates that existing manifest; this is a no-deletion gate-integrity update, not a distribution-layer retirement,
and is necessary for the phase's required `check:all` result.

The same edits are signed entries in the retained shared-core manifest. Because that layer has no manifest writer, Phase
1 also refreshes the affected digest entries and the exact-byte signature. These locked artifacts are deletion targets,
but updating them is necessary to retain the mandatory green gate before their retirement.

The vendored-distribution layer needs no detachment work here. Baseline fact 26 records that both of its `.mjs` files
import `portable-core-attest.mjs`, but both are themselves deleted in Phase 2, so severing that edge would be wasted
work. They keep importing the attestation for the whole of this phase, which is green because nothing is deleted yet.

Dependencies: none.

Deliverables:

- Remove the `portable-core-contract.json` validation from `tools/check-schema.mjs`: the two constants at lines 24-25,
  the `checkPortableCoreContract()` function at lines 151-159, and the guarded call at lines 172-176. Leave every other
  schema it validates untouched; `SCHEMA_OWNED_ARTIFACTS` and its `expectedArtifactCount` of 1 are unaffected, because
  `tools/quality-policy/project-schema-profile.json` names only `plugin.json` and its two live schemas.
- Change `runProfileContractCheck()` in `tools/portable-core/gate-role-engine.mjs` so the `portableCore` block is
  optional: keep the `coreVersion` and `roleGraph` shape checks for a profile that still declares it, and stop emitting
  `portableCore is required` when it is absent. Extend `tests/portable-core/portable-policy-engines.test.mjs` with a
  case proving a profile without `portableCore` passes and one with a malformed `portableCore` still fails.
- Move the surviving-engine cases out of `tests/js/portable-core.test.mjs` into
  `tests/portable-core/portable-policy-engines.test.mjs` so all 12 engines named in baseline fact 23 keep their
  coverage. Relocate the `tests/fixtures/portable-core/clean.txt` dependency with them. Leave only the
  `runPortableCoreAttest` and `runStandaloneBoundaryCheck` cases behind in the now fully extraction-only file.
- Replace the `generic-tokens.json` dependency in `tests/js/skills-lock.test.mjs`. Delete the
  `every generic skill file is free of product-specific vocabulary` test, the `a seeded forbidden token would be caught`
  test, and the `FORBIDDEN_TOKENS` / `readGenericTokenGroups` machinery; keep the `skills-lock.json` shape test, the
  declared-set-equals-on-disk-set test, and the SHA drift test. Remove the `generic-tokens.json` dependency from
  `tests/js/check-patterns-registry.test.mjs`, keeping its rule-registry assertions on a locally constructed token
  fixture.
- Move the two cases that only `tests/js/generic-rule-corpus.test.mjs` owns into
  `tests/js/check-patterns-registry.test.mjs`, which this phase already edits: the clean-corpus invocation case (every
  `GENERIC_RULES` entry's `rule.run` or `runRegexRule` returns `[]` for an empty corpus) and
  `the registry remains fail-closed when a canonical rule is omitted`. Its third case, the
  `GENERIC_RULES`-equals-`CANONICAL_GENERIC_RULE_IDS` order assertion, is already duplicated at
  `tests/js/check-patterns-registry.test.mjs` lines 95-96 and must not be added twice. Baseline fact 22 records why this
  is a Phase 1 deliverable and not a Phase 2 side effect: that file has no extraction-layer dependency at all, so its
  coverage would otherwise disappear silently when Phase 2 deletes it. Leave the file itself in place until Phase 2, so
  this phase deletes nothing.
- Update `tests/portable-core/portable-role-graph.test.mjs` fixture data so it no longer depends on the roles Phase 2
  removes: derive the `requiredOrder` length assertion from the committed graph rather than the literal `17`, drop the
  `profile.portableCore.roleGraph` assertion, and rebuild the adapter/ordering/failure fixtures on surviving role names.
- Confirm `npm run check:all`, `npm run check:distribution`, `npm run schema:check`, and
  `npm run distribution:source:check` all pass with every Phase 2 deletion target still present on disk.

Exit conditions:

- `npm run check:all` passes.
- `git grep -l 'portable-core-attest\|portable-core-contract\.json\|generic-tokens\.json' -- ':!exec-plans'` returns
  only files that Phase 2 deletes - including `tools/quality-policy/portable-core-contract.json`,
  `shared-core-manifest.json`, `tools/check-distribution.mjs`, and `tools/regenerate-distribution-manifest.mjs` - plus
  the four files Phase 2 owns and edits rather than deletes: `package.json`, `tsconfig.tools.json`,
  `documentation/conventions/quality-gates.md`, and `documentation/guides/documentation-maintenance.md`. It must **not**
  return `tests/js/skills-lock.test.mjs` or `tests/js/check-patterns-registry.test.mjs`; this phase severs both.
- Import-edge probe. Renaming each of the eight entrypoints in baseline fact 6 to a `.bak` suffix leaves
  `npm run check:all` failing on the seven extraction-only npm scripts, on exactly **three** of the six deleted test
  files, and on exactly three further gates. The three failing test files are the ones that import a renamed entrypoint:
  `tests/js/shared-core-manifest.test.mjs` (line 13), `tests/js/check-generic-surface.test.mjs` (line 13), and
  `tests/js/portable-core.test.mjs` (lines 22-23). The three further gates are `npm run check:distribution`, which fails
  at module resolution because `tools/check-distribution.mjs` line 13 imports `./portable-core-attest.mjs`;
  `npm run typecheck:tools`, via `tsconfig.tools.json`'s `files` array; and
  `tests/js/tool-path-existence-contract.test.mjs`, which per baseline fact 38 resolves `tools/*.mjs` paths out of
  `package.json` and `documentation/guides/documentation-maintenance.md` lines 43-45. All three are corrected in
  Phase 2. Because a `.bak` file is untracked and outside every scan extension, treat any additional failure from
  `format:check`, `check:filesize`, or the format-scope computation as probe noise rather than a finding; the assertion
  is that **no owner test beyond the three named ones** fails. Restore the names afterward.
- Locked-data probe, which is deliberately narrower than the import-edge probe because the extraction layer's data is
  not uniformly coupled. Renaming `tools/quality-policy/shared-instructions.md` must fail
  `tests/js/shared-instructions.test.mjs` and nothing else, proving it is a leaf data file. Renaming
  `tools/quality-policy/generic-tokens.json` must fail `npm run check:generic-surface` and
  `tests/js/check-generic-surface.test.mjs` and `tests/js/shared-instructions.test.mjs`, and must **not** fail
  `tests/js/skills-lock.test.mjs` or `tests/js/check-patterns-registry.test.mjs`; that negative half is the real
  assertion of this phase, because those two are the files it severs. Renaming
  `tests/portable-core/generic-rule-corpus.json` is expected to cascade well beyond its own reader - per baseline fact
  45 it is a signed manifest entry, so `npm run check:shared-core`, `npm run portable-core:attest`,
  `npm run check:distribution`, and `tests/js/shared-core-manifest.test.mjs` fail with it alongside
  `tests/portable-core/generic-rule-conformance.test.mjs` - so it is not usable as an isolation probe and is listed here
  only so that cascade is not mistaken for a defect. `tests/js/generic-rule-corpus.test.mjs` must pass under **both**
  probes; that is the executable proof of baseline fact 22's claim that it is not extraction-only and that its cases had
  to move rather than die.
- No coverage floor in `tools/quality-policy/coverage-floors.json` changed.

### Phase 2 - Remove the extraction-readiness and vendored-distribution gates

Intent: delete every gate whose only product is a proof that this repository's quality core can be lifted into another
repository, or that a copy already lifted out of it still matches, now that nothing surviving reads them.

Dependencies: Phase 1, which removed every survivor-to-target code edge.

Every deletion in this phase ships in one commit with its `package.json`, inventory, tsconfig, and documentation sweeps.
Baseline fact 38 records why that grouping is mandatory rather than stylistic:
`tests/js/tool-path-existence-contract.test.mjs` fails the moment a `tools/*.mjs` file named in `package.json` or under
`documentation/` stops existing.

Deliverables:

- Delete the eight entrypoints named in baseline fact 6, plus `tools/portable-core/lint-policy.mjs`, which baseline fact
  40 records is left with zero references once the contract and manifests go.
- Delete the four-file vendored-distribution layer from baseline fact 26: `tools/check-distribution.mjs`,
  `tools/regenerate-distribution-manifest.mjs`, `tools/quality-policy/distribution-source.json`, and
  `tools/quality-policy/distribution-manifest.json`. No test file references any of them, so no test coverage is lost
  and no owner test needs relocating.
- Delete the locked data they own: `tools/quality-policy/portable-core-contract.json`,
  `tools/quality-policy/shared-core-manifest.json`, `tools/quality-policy/shared-core-manifest.sha256`,
  `tools/quality-policy/alignment-inventory.json`, `tools/quality-policy/generic-tokens.json`,
  `tools/quality-policy/generic-surface-scope.json`, `tools/quality-policy/tier1-scan-roots.json`,
  `tests/portable-core/generic-rule-corpus.json`, `tests/portable-core/generic-rule-conformance.golden.json`, and
  `tests/portable-core/portable-core-attest.golden.json`.
- Delete the three now-subjectless schemas: `schemas/portable-core-contract.schema.json`,
  `schemas/generic-rule-corpus.schema.json`, and `schemas/portable-profile.schema.json`. No other file under `schemas/`
  changes.
- Delete the six test files named in baseline fact 22, and delete the orphaned fixture directory
  `tests/fixtures/portable-core/` (`attestation.json`, `clean.txt`) once Phase 1 has relocated the `clean.txt`
  dependency. Two of the six need their receiving owner named in the commit message rather than being reported as pure
  removals: `tests/js/generic-rule-corpus.test.mjs`, whose two unique cases Phase 1 already moved into
  `tests/js/check-patterns-registry.test.mjs`, and `tests/portable-core/generic-rule-conformance.test.mjs`, whose golden
  comparison against the deleted corpus is what goes while its per-rule behavioral assertions stay independently owned
  by `tests/js/check-patterns.test.mjs`'s 28 seeded cases and `tests/js/check-patterns-registry.test.mjs` line 98. Keep
  `tests/portable-core/portable-role-graph.test.mjs` and `tests/portable-core/portable-policy-engines.test.mjs`.
- Remove all ten scripts named in baseline fact 31 from `package.json` - `check:shared-core`, `check:alignment`,
  `check:generic-surface`, `check:generic-conformance`, `check:standalone`, `check:profile`, `portable-core:attest`,
  `check:distribution`, `distribution:source:check`, and `distribution:source:write` - and drop both
  `npm run check:distribution` and `npm run check:alignment` from `package:check`, leaving
  `npm run schema:check && node tools/release-archive.mjs --dry-run && vitest run --project tools <four release tests>`.
- Update `tests/js/command-graph.test.mjs` at all three sites baseline fact 39 names: the role names at lines 22-24, the
  three now-nonexistent scripts in `ALLOWED_OUTSIDE_CHECK_ALL` at lines 53-55, and the synthetic `portableCore` fixture
  block at line 285. Line 176's assertion that `package:check` runs `schema:check` first still holds unchanged.
- Remove the `portable-core`, `generic-surface`, and `standalone` roles from both `requiredOrder` and `roles` in
  `tools/quality-policy/portable-role-graph.json`, from the `adapters` map in
  `tools/quality-policy/project-profile.json` (lines 39-41), and from the `--roles` list of `check:core`, leaving 12
  roles passed and 14 in `requiredOrder`. Drop the now meaningless `portable` boolean from every surviving role entry
  and the `portableCore` block from the profile, which Phase 1 made optional.
- Remove the deleted paths from the `files` arrays of `tsconfig.tools.json` (including `tools/check-distribution.mjs`
  and `tools/regenerate-distribution-manifest.mjs` at lines 17-18, and `tools/portable-core/lint-policy.mjs` at line 77)
  and `tsconfig.tests.json`, then run `node tools/quality-policy/test-inventory.mjs --write`. Deleting
  `distribution-source.json` retires the hand-maintained `paths` array entirely, so no sorted-and-unique hand edit is
  needed and the `fs.readFileSync`-throws-on-missing-path hazard in baseline fact 26 disappears with the generator.
  `tools/check-patterns/generic/namespace-policy.mjs`, `tools/portable-core/gate-role-engine.mjs`, and
  `tools/portable-core/suppression-engine.mjs` were listed in that array but are live for other reasons and stay.
- Delete the `.sha256` branch at `tools/quality-policy/generate-format-scope.mjs` lines 142-148, closing brace included.
  Baseline fact 41 records that `shared-core-manifest.sha256` is the only `.sha256` file in the tree, so once it is
  deleted the branch is unreachable and its line 146 `alternateValidation` string would be the last surviving mention of
  `npm run check:shared-core`. `tests/js/format-scope.test.mjs` line 27 iterates only rows produced from files that
  exist, so removing the branch cannot fail it.
- Rewrite `AGENTS.md` lines 164-166 to describe the surviving gate set, and strip the portable-core material from
  `documentation/conventions/quality-gates.md` at four sites: line 21 (drop "signed", which the deleted signature file
  no longer backs); line 25 (the three removed role names inside the canonical-order block); lines 86-**88**, the whole
  `check:shared-core` / `check:generic-surface` / `check:standalone` paragraph, whose line 88 narrates the removed
  `check:standalone` as "repository containment"; and lines 101-111, the entire `## Generic-core inventory` section
  **including its heading** - the section's prose runs to line 111, not 110, and `## Related` follows at line 113. Two
  things inside that last range must survive rather than go with it: the `npm run check:suppressions` owner named on
  line 110, and the fresh-copy sentence spanning lines 110-111 ("A fresh copy containing only this repository must pass
  `npm run check:all` without network access or neighboring-directory inputs."), which moves into the surviving
  gate-composition section. Deleting only lines 103-109 would leave lines 109-110 still naming
  `npm run check:shared-core` and `npm run check:generic-surface`, which this phase's own exit-condition grep forbids.
- Update the five further documentation owners the sweep in baseline fact 28 found. `README.md`: lines 514-519 are one
  wrapped paragraph, so rewrap it rather than cutting at a line boundary - delete from line 514 through the sentence
  ending mid-line 517, keep the fresh-isolated-copy sentence that starts mid-line 517 and ends on line 519 - and delete
  line 521. `CONTRIBUTING.md`: lines 58-59, the portable-core-contract bullet at lines 60-61, and the whole bullet at
  lines 89-93, which carries the `--peer` invocation and the three distribution scripts.
  `documentation/conventions/coding-standards.md`: lines 128-131. `documentation/conventions/testing-infrastructure.md`:
  the bullet at lines 63-65, rewritten to name `tests/portable-core/portable-policy-engines.test.mjs` as the owner of
  the engine cases Phase 1 relocated there instead of "the manifest-listed portable-core self-tests".
  `documentation/guides/documentation-maintenance.md`: lines 43-45 and the bullet at lines 96-98. Line 46 of that last
  file names the surviving `tools/portable-core/suppression-engine.mjs` and stays.
- Delete `tools/quality-policy/shared-instructions.md` and remove the `<!-- BEGIN SHARED_INSTRUCTIONS -->` /
  `<!-- END SHARED_INSTRUCTIONS -->` marker pair at `AGENTS.md` lines 10 and 81, keeping the prose between them, since
  the genericness scan that consumed the block is gone. No ignore-file entry for `shared-instructions.md` exists
  anywhere in the tree; its only other bindings are the `tests/js/shared-instructions.test.mjs` entries in
  `tools/quality-policy/test-inventory.json` and `tsconfig.tests.json`, which clear with that test file. Keep
  `tests/js/agents-pointer.test.mjs`; the `CLAUDE.md` pointer contract is independent of the portable core and still
  valuable, and its line 44 marker check reads `CLAUDE.md`, not `AGENTS.md`.

Exit conditions:

- `npm run check:all` passes.
- `git grep -n '<term>' -- ':!exec-plans'` returns nothing for each of these terms: `check:shared-core`,
  `check:generic-surface`, `check:generic-conformance`, `check:standalone`, `check:profile`, `check:alignment`,
  `portable-core:attest`, `portable-core-attest`, `portable-core-contract`, `shared-core-manifest`,
  `shared-instructions`, `generic-tokens`, `generic-surface-scope`, `alignment-inventory`, `lint-policy`,
  `check:distribution`, `distribution:source`, `check-distribution`, `regenerate-distribution-manifest`,
  `distribution-source`, and `distribution-manifest`. Three classes of term are excluded on purpose. Baseline fact 28
  records the first: the bare substrings `portable-core` and `generic-surface` are named by roughly thirty legitimate
  consumers of the surviving `tools/portable-core/*` engines. The second is the bare substring `distribution`, which
  `tests/test_poisoning_scenarios.py` uses for `_valid_distribution()` - a statistical distribution, unrelated to
  vendoring - at lines 25, 34, and 248. The third is `tier1-scan-roots`: per baseline fact 29 that grep is **already**
  empty today, because the file's own bytes never contain its stem, so as a grep term it could never witness the
  deletion. Its removal is settled by the path check below instead.
- `test ! -e tools/quality-policy/tier1-scan-roots.json` succeeds, and so does the same check for every other file
  deleted in this phase. Path existence, not `git grep`, is the exit condition for any deleted file whose stem no
  surviving text mentions.
- `node tools/portable-core/gate-orchestrator.mjs --roles standard` still exits 0, and `npm run check:core` runs 12
  roles.
- `npm run schema:check` and `npm run package:check` pass. `npm run check:distribution`,
  `npm run distribution:source:check`, and `npm run distribution:source:write` no longer exist.
- This phase deletes at least 570 lines of test code, at least 285 lines of tool code, and at least 40 KB of locked JSON
  and schema files. The six deleted test files hold 662 lines today, but Phase 1 relocates roughly 88 of
  `tests/js/portable-core.test.mjs`'s 111 lines into `tests/portable-core/portable-policy-engines.test.mjs`, leaving
  only its header, its two deletion-target imports, and its lines 100-111 to be deleted here. The ten locked data files
  plus the three schemas measure 37,823 bytes today, and the two distribution JSON files add 2,388 more, for 40,211
  bytes. `check-distribution.mjs` (170) and `regenerate-distribution-manifest.mjs` (115) supply the 285 tool lines.
- No file in the tree outside `exec-plans/` names a peer repository path, a peer repository identifier such as
  `avnav-plugin-ai-environment`, a `vendored-contract-output` materialization, or a `--peer` flag.

### Phase 3 - Restore and extend the agent skills

Intent: give the five previously token-restricted skills concrete content, and give this repository its first
project-local skills.

Dependencies: Phase 1 (which removed the `skills-lock.test.mjs` token ban) and Phase 2 (which removed
`check:generic-surface`). Both owners of the restriction must be gone before any skill can name product vocabulary.

Deliverables:

- Rewrite `.agents/skills/preflight/SKILL.md` to name `documentation/TABLEOFCONTENTS.md`,
  `documentation/conventions/coding-standards.md`, and `documentation/conventions/smell-prevention.md` as explicit
  ordered paths, and add a task-classification table routing to the real architecture and filter documents.
- Rewrite `.agents/skills/scan-smells/SKILL.md` to name `npm run check:smells`, `npm run check:patterns`,
  `npm run check:filesize`, `npm run lint:ruff`, and the real rule identifiers from
  `documentation/conventions/smell-prevention.md`.
- Rewrite `.agents/skills/create-plan/SKILL.md` to name `documentation/guides/exec-plan-authoring.md`, the required
  section list, and `exec-plans/active/PLAN{N}.md` numbering.
- Rewrite `.agents/skills/doc-sync/SKILL.md` to name `documentation/TABLEOFCONTENTS.md`,
  `documentation/conventions/documentation-format.md`, `npm run docs:check`, and the README sync categories from
  `AGENTS.md` sections 3 and 11.
- Rewrite `.agents/skills/grill-me-repo/SKILL.md` to name the real architecture documents and the real polar model,
  persistence, filter, and viewer vocabulary of this repository.
- Add two project-local skills: one for adding an API endpoint across `server/`, `plugin.py`, and the viewer client, and
  one for reviewing a change against the validation and poisoning-resistance rules.
- Regenerate `skills-lock.json` for all seven skills: a `computedHash` for each rewritten `SKILL.md`, and a new entry
  per project-local skill with `"sourceType": "project-local"`. Baseline fact 12 records that
  `tests/js/skills-lock.test.mjs` fails on both stale hashes and a declared-set mismatch, so this is mandatory, not
  conditional.
- Each rewritten or new skill must reach at least 100 lines of substantive, path-bearing content and must contain no
  `## Related` entry that is unlinked prose.
- Extend `tests/js/skills-lock.test.mjs` - which Phase 1 already reshapes - with a per-skill depth floor, so this
  phase's exit conditions are decided by a command rather than by inspection and cannot regress later: every declared
  skill's `SKILL.md` holds at least 100 non-empty lines, names at least three repository paths that exist on disk, and
  names at least one npm script that exists in `package.json`. This is a positive contract replacing the deleted token
  ban in the same owner test, so no new checker is introduced.

Exit conditions:

- `npm run check:all` passes, including `npm run docs:check`.
- Seven skills exist; each is at least 100 lines and names at least three real repository paths and at least one real
  npm script, proven by the extended `tests/js/skills-lock.test.mjs` rather than by reading the files.
- Every `SKILL.md` passes `npx prettier --check '.agents/skills/**/*.md'` and `npm run docs:lint`. Baseline fact 42
  records that both tools cover `.agents/`, and that `npm run check:filesize` does not, so no 400-line ceiling applies.
- The two new project-local skills each name at least one `server/` path, one `viewer/` path, and one test path.
- `skills-lock.json` declares exactly seven skills and every `computedHash` matches its `SKILL.md` bytes.

### Phase 4 - Finish the inventory generator and clear the last stale tooling names

Intent: close the one remaining hand-edit in this repository's inventory workflow, and rename the one policy module
whose filename is now actively misleading.

Dependencies: Phase 2, because the `tsconfig` files lists shrink there and the generator must produce the post-deletion
state, and because Phase 2 clears the three stale `ALLOWED_OUTSIDE_CHECK_ALL` entries that this phase adds one to.

Deliverables:

- Extend `writeInventory()` in `tools/quality-policy/test-inventory.mjs` so `--write` rewrites the `files` array of
  `tsconfig.tests.json` in the same pass as `test-inventory.json`, preserving any `.d.ts` entry that
  `diffTsconfigTestsInventory()` already excludes from the diff at line 270, and using the same
  `discoverExecutableTestHelpers()` source of truth that the check path already uses. Baseline fact 15 records that no
  new discovery logic is needed. The writer must splice the `files` array in place: the file has exactly
  `compilerOptions` and `files` and no `include` key, and its two-space JSON with a trailing newline is what prettier
  expects. `tsconfig.tests.json` holds **zero** `.d.ts` entries today, so that carve-out is defensive and must be proven
  against a synthetic tsconfig fixture rather than against the committed file.
- Export `writeInventory()` and give it injectable paths - `{root = ROOT, tsconfigPath = TSCONFIG_PATH}` - because it is
  module-private today and hardcodes `inventoryPath(ROOT)` at line 326, so the synthetic-fixture owner test below cannot
  be written against it at all. `discoverExecutableTestHelpers(root)` and
  `diffTsconfigTestsInventory(root, tsconfigPath)` are already exported and already parameterized, so this closes the
  one gap between the check path and the write path. `runTypecheckTests()` calls `diffTsconfigTestsInventory()` with no
  arguments and so ignores its own `root` parameter; leave that as is unless the new writer needs otherwise, and do not
  fix it as a drive-by.
- Expose the generator as `npm run inventory:write` and update the committed inventory note to name the npm script
  rather than the raw node invocation.
- Add `inventory:write` to `ALLOWED_OUTSIDE_CHECK_ALL` in `tests/js/command-graph.test.mjs`, in the same commit that
  declares the script. Baseline fact 39 records that lines 185-186 fail any declared script that is neither reachable
  from `check:all` nor allowlisted, and that `check:all` reaches that test through the `test-split` role - so a
  write-mode script without an allowlist entry makes this phase end red on its own first exit condition. Every other
  writer script (`format`, `requirements:lock`, `release:prepare`, `release:create`) is already listed there, and Phase
  2 has by now removed the three allowlist entries whose scripts it deleted.
- Add owner-test cases in `tests/js/test-inventory.test.mjs` proving the write path is idempotent, removes stale
  `tsconfig.tests.json` entries, adds missing ones, and preserves a `.d.ts` entry seeded into a synthetic tsconfig
  fixture.
- Confirm that a new production `.js` or `.py` file still needs no coverage entry under the family-plus-default schema,
  and record that property explicitly in `documentation/conventions/quality-gates.md` so a future change cannot silently
  regress to a per-file model.
- Update `documentation/conventions/testing-infrastructure.md` lines 79 and 83 to name `npm run inventory:write` as the
  regeneration command and to correct `tsconfig.tests.json`'s `include` to `files`, correct the identical `include`
  error for `tsconfig.tools.json` at line 85 in the same pass - neither tsconfig has an `include` key, both hold exactly
  `compilerOptions` and `files` - and add the command to `CONTRIBUTING.md`'s local workflow list.
- Rename `tools/quality-policy/eslint-complexity-config.mjs` to `tools/quality-policy/complexity-limits.mjs`, updating
  all five binding sites from baseline fact 18 and no others: the import at line 10 and the header comment at line 4 of
  `tools/quality-policy/eslint.complexity.config.mjs`, the import at line 16 of
  `tests/js/quality-gates-doc-numbers-contract.test.mjs`, the `ADAPTER_RELATIVE_PATH` literal at line 118 of
  `tests/js/complexity-policy.test.mjs`, and line 51 of `tsconfig.tools.json`. Baseline fact 18 records that the two
  filenames differ only by `-` versus `.` before `complexity`, which is the confusion this rename removes, and that
  those five sites are exhaustive today: no locked manifest ever named this module and no `documentation/` file mentions
  it, so there is no sixth site.

Exit conditions:

- `npm run check:all` passes.
- Creating a scratch test file, running `npm run inventory:write`, and running `npm run check:all` passes with no hand
  edit. Removing the scratch file and rerunning `npm run inventory:write` restores the committed artifacts byte for
  byte.
- `git grep -n 'eslint-complexity-config' -- ':!exec-plans'` returns nothing.
- `git grep -nE 'tsconfig\.(tests|tools)\.json' documentation/` shows the generator command, not a hand-edit
  instruction, and no longer says `include` for either file.
- `inventory:write` appears in `ALLOWED_OUTSIDE_CHECK_ALL` and
  `vitest run --project tools tests/js/command-graph.test.mjs` passes.

### Phase 5 - Write the missing product-extension guides

Intent: give a human or agent a documented path for the two most common product changes, which this repository has never
had.

Dependencies: Phase 4, so the guides can point at `npm run inventory:write`.

Deliverables:

- Add `documentation/guides/add-new-api-endpoint.md` covering the route registration point, the handler contract, the
  request and response schema, the persistence boundary, the required pytest and vitest coverage, and the closing gate
  commands.
- Add `documentation/guides/add-new-viewer-panel.md` covering viewer module registration, the theming and CSS token
  contract, the settings surface, the required vitest coverage, and the closing gate commands.
- Both guides must follow the documented page shape: title, `**Status:** Current.`, `## Overview`, `## Key Details`,
  `## Related`.
- Both guides must clear every mechanical gate that applies to a file under `documentation/`. `npm run docs:check`
  composes eight of them - `docs:lint` (markdownlint), `docs:links:proof`, `docs:links`, `docs:format` (the page-shape
  contract in `tests/js/doc-format-contract.test.mjs`), `docs:reachability`, `docs:toc`, `docs:smell-catalog`, and
  `docs:pointer`. Three more apply from outside it: `npm run format:check` (prettier, via `check:standard`); the 400
  non-empty-line limit enforced by `npm run check:filesize` (`documentationScanRoot` covers `documentation/`); and
  `tests/js/tool-path-existence-contract.test.mjs`, which per baseline fact 38 scans every `documentation/**/*.md` file
  and fails on any `tools/…{.mjs,.py,.sh}` path that does not exist - so both guides may name only live tool paths, and
  must not cite any entrypoint Phase 2 deleted.
- Link both from `documentation/TABLEOFCONTENTS.md` so the `docs:reachability` and `docs:toc` contracts pass.
- Add a contract test asserting every `documentation/guides/add-new-*.md` file names `npm run inventory:write` and
  `npm run check:all`, so the gap cannot reopen. Register the new test file with `npm run inventory:write`, which Phase
  4 made the single command for `test-inventory.json` and the `tsconfig.tests.json` files list.

Exit conditions:

- `npm run check:all` passes, including `npm run docs:check`, the reachability contract, and the new contract test.
- Both guides are reachable from `documentation/TABLEOFCONTENTS.md` and both are under 400 non-empty lines.
- Manual acceptance, explicitly **not** machine-checkable: following either guide end to end on a scratch change reaches
  a green `npm run check:all` with no undocumented step. The mechanical half of this property is owned by the contract
  test above; the walkthrough result belongs in the commit message.

### Phase 6 - Reduce gate output noise and consolidate what the focus scanners can share

Intent: stop spending reader and agent context on green-run policy rosters, and share whatever the two focused-test
scanners can share without crossing a parser boundary.

Dependencies: Phase 2, so the removed roles are already out of the summary surface.

Deliverables:

- Trim the printed green-run summary of exactly the two checkers baseline fact 44 measures as enumerating their full
  policy surface, and no others: `tools/check-patterns/runner.mjs` (a 2389-character summary line, all 29 rules printed
  three times over) and `tools/check-file-size.mjs` (325 characters, of which a 300-character summary line carries a
  nine-entry all-zero `onelinerByKind` roster). Each must print total counts plus only its non-zero per-rule entries.
  Change only the **print** path, not the returned `summary` object: baseline fact 44 records that
  `tests/js/check-patterns.test.mjs` asserts on `result.summary.byRule` with `print: false` and never asserts a zero
  count, so no owner test changes and no in-process consumer loses a field. The other four surviving emitters baseline
  fact 44 counts are explicitly out of scope: `tools/portable-core/gate-orchestrator.mjs`, whose `executed` array is the
  gate's own audit trail; `tools/release-archive.mjs`, which prints a summary only under `--version`, never under the
  `--dry-run` that `package:check` runs; and `tests/js/viewer-dependency-contract.test.mjs` and
  `tests/js/viewer-structure-contract.test.mjs`, whose lines are per-test contract evidence inside the vitest run rather
  than a policy roster. `tools/check-python-filesize.py` is also out of scope: its 38 characters are the rest of
  `npm run check:filesize`'s 363-character output and it enumerates nothing.
- Do **not** collapse `tools/check-test-focus.mjs` (233 lines) and `tools/check-test-focus.py` (101 lines) into one
  scanner. A single scanner covering both languages is not feasible: the JavaScript half walks an `acorn` AST
  (`check-test-focus.mjs` line 21) and the Python half walks a CPython `ast` (`check-test-focus.py` line 14), and
  neither parser reads the other language. A merged scanner would need a hand-rolled parser for whichever language lost
  its native AST, which the no-additional-hand-rolled-tooling constraint forbids and which would weaken the gate. Two
  language front ends stay.
- What may be shared is the policy and reporting layer already factored into
  `tools/portable-core/focused-test-engine.mjs`, which `check-test-focus.mjs` imports at line 27 and the Python half
  does not use. Decide whether to route the Python half's findings through the same reporting shape, adopting it only if
  every marker both halves block today stays blocked. This deliverable is complete either way, but the outcome must be
  recorded in `documentation/conventions/quality-gates.md` alongside the parser-boundary finding below - "adopted" or
  "rejected, because <reason>" - so the decision is not silently dropped and not re-litigated later.
- Do **not** replace either scanner with the native affordances. Baseline fact 33 records that `allowOnly: false` blocks
  `.only` alone, while the scanners block `.skip`, `.todo`, `skipIf`, `runIf`, the options-object form, and the Python
  `skip`/`skipif`/`xfail` markers. Substituting the native affordance would weaken the gate and violate the no-weakening
  constraint.
- Record the measured parser-boundary reason for keeping two language front ends in
  `documentation/conventions/quality-gates.md`, so a future reader does not re-propose the collapse.

Exit conditions:

- `npm run check:all` passes.
- A green `npm run check:patterns` prints at most 400 characters in total, down from 2411 (a 2389-character summary line
  plus a 21-character pass line), and a green `npm run check:filesize` prints at most 200, down from 363 - of which 38
  characters belong to `tools/check-python-filesize.py` and do not change, so the JavaScript half must come down from
  325 to at most 162.
- A committed focused test is still blocked in both Python and JavaScript for every marker listed in baseline fact 33,
  proven by `tests/js/test-focus.test.mjs` and `tests/test_test_focus_checker.py`, each extended with a case per marker
  class rather than merely retained.
- `git grep -n 'focused-test-engine' documentation/conventions/quality-gates.md -- ':!exec-plans'` returns at least one
  line, and that line records the shared-reporting outcome as adopted or as rejected with its reason. This is what makes
  the "complete either way" deliverable above decidable by a command instead of by inspection.
- A seeded failure still names the rule, the file, and the line.

## Documentation Impact

`README.md` **is** in scope, contrary to a first reading: lines 514-517 currently advertise `npm run check:shared-core`,
`npm run check:generic-surface`, and `npm run portable-core:attest` to readers, and those scripts cease to exist; line
521 points at a "source-owned distribution and archive/peer-copy workflow" that also ceases to exist. The edit is a
removal of stale gate advertising, not a user-facing behavior change. This plan touches no API contract, no persistence
format, no configuration key users set in AvNav, and no installation or packaging step - `npm run package:check` loses
two composed steps but `tools/release-archive.mjs` and the release workflow are untouched (baseline fact 26).

Required documentation deliverables, by owner:

- `AGENTS.md`: surviving gate set at lines 164-166, and removal of the `SHARED_INSTRUCTIONS` marker pair at lines 10 and
  81 (Phase 2).
- `README.md`: the developer-quality-contract paragraph, line 514 through the sentence ending mid-line 517, rewrapped;
  and the distribution/peer-copy pointer at line 521 (Phase 2). The fresh-isolated-copy sentence that starts mid-line
  517 and ends on line 519 stays.
- `CONTRIBUTING.md`: quality-tooling command list at lines 58-59, the portable-core contract bullet at lines 60-61, and
  the entire distribution bullet at lines 89-93 including the `--peer` invocation (Phase 2); `npm run inventory:write`
  in the local workflow list (Phase 4).
- `documentation/conventions/quality-gates.md`: gate graph at lines 21 and 25, the gate paragraph at lines 86-88, the
  whole `## Generic-core inventory` section at lines 101-111 with its fresh-copy sentence (lines 110-111) rehomed into
  the surviving gate section, then the generator command, the coverage-schema property, and the Phase 6 decisions
  (Phases 2, 4, 6).
- `documentation/conventions/coding-standards.md`: portable-core paragraph, lines 128-131 (Phase 2).
- `documentation/conventions/testing-infrastructure.md`: the manifest-listed portable-core self-tests bullet at lines
  63-65 (Phase 2); the generator command at lines 79 and 83 and the `include` to `files` corrections at lines 79 and 85
  (Phase 4).
- `documentation/guides/documentation-maintenance.md`: command block at lines 43-45 and the contract bullet at lines
  96-98 (Phase 2).
- `documentation/guides/add-new-api-endpoint.md` and `add-new-viewer-panel.md`: new (Phase 5).
- `documentation/TABLEOFCONTENTS.md`: entries for the two new guides (Phase 5).

## Acceptance Criteria

Gate integrity:

- [ ] `npm run check:all` passes at every phase boundary.
- [ ] No coverage floor, complexity limit, or rule severity is weaker than at plan start; Python coverage stays gated at
      `--cov-fail-under=90` and the four narrated thresholds still match their config source.
- [ ] `coverage-floors.json` still uses the family-plus-default schema, `contractOwned` stays empty, and no _new_
      per-file entry was introduced beyond the 17 grandfathered `viewerPerFileLinePercent` overrides.
- [ ] `check:complexity` is still a direct ESLint invocation with no baseline file.
- [ ] `npm run check:suppressions`, `npm run check:python-contracts`, `npm run check:scaling`, `npm run check:filesize`,
      `npm run test:focus:check`, and `npm run test:coverage:check` all still run inside `check:all`.
- [ ] The focused-test scan still blocks `.only`, `.skip`, `.todo`, `skipIf`, `runIf`, the options-object form, and the
      Python `skip`/`skipif`/`xfail` markers.
- [ ] No hand-rolled runner, linter, orchestrator, or timing-based performance gate was added, and none from baseline
      fact 3 returned.
- [ ] Every case that only a deleted test file owned has a named surviving owner: the 12 engine cases in
      `tests/portable-core/portable-policy-engines.test.mjs`, and the clean-corpus and fail-closed cases in
      `tests/js/check-patterns-registry.test.mjs`. No deleted test's assertions vanished unowned.

Removal:

- [ ] The eight entrypoints from baseline fact 6 are absent from the working tree, as are
      `tools/portable-core/lint-policy.mjs`, the ten locked data files, `tools/quality-policy/shared-instructions.md`,
      the three schemas, the six test files, and `tests/fixtures/portable-core/`.
- [ ] The four vendored-distribution files from baseline fact 26 are absent, their three npm scripts are gone,
      `package:check` composes only `schema:check`, the release-archive dry run, and the four release tests, and
      `npm run package:check` passes.
- [ ] No `SHARED_INSTRUCTIONS` marker remains in `AGENTS.md`.
- [ ] `tools/quality-policy/profile-schema.mjs`, `tools/portable-core/gate-orchestrator.mjs`,
      `tools/portable-core/gate-role-engine.mjs`, `tools/portable-core/schema-engine.mjs`,
      `tools/portable-core/suppression-engine.mjs`, and every `tools/portable-core/generic-rule-*.mjs` module are
      present and imported.
- [ ] All 12 surviving engines from baseline fact 23 still have owner-test coverage.
- [ ] `npm run schema:check` and `npm run package:check` pass with no portable-core attestation and no distribution
      check.
- [ ] No repository file outside `exec-plans/` asserts byte-identity or digest-identity against another repository, or
      names a peer repository path, the `avnav-plugin-ai-environment` owner, a `vendored-contract-output`
      materialization, or a `--peer` flag.

Agent experience:

- [ ] Seven skills exist, each at least 100 lines, each naming at least three real paths and one npm script, enforced by
      `tests/js/skills-lock.test.mjs` rather than by inspection.
- [ ] Two project-local skills exist and each name at least one `server/` path, one `viewer/` path, and one test path.
- [ ] `skills-lock.json` declares exactly seven skills with matching `computedHash` values.
- [ ] No `## Related` section in `.agents/skills/` contains unlinked prose in place of a link.
- [ ] A green `npm run check:patterns` prints at most 400 characters in total, down from 2411, and a green
      `npm run check:filesize` at most 200, down from 363, with the returned `summary` objects unchanged.
- [ ] The shared-reporting decision for the two focused-test front ends is recorded in
      `documentation/conventions/quality-gates.md` as adopted or rejected-with-reason.

Automation:

- [ ] `npm run inventory:write` regenerates `test-inventory.json` and the `tsconfig.tests.json` files list together, is
      idempotent, and preserves `.d.ts` entries, proven on a synthetic tsconfig fixture because the committed file has
      none.
- [ ] A scratch test file reaches a green `npm run check:all` with zero hand edits to JSON or tsconfig.
- [ ] `inventory:write` is listed in `ALLOWED_OUTSIDE_CHECK_ALL` and `tests/js/command-graph.test.mjs` passes, so the
      new script does not break the reachability contract in baseline fact 39.
- [ ] `git grep -n 'eslint-complexity-config' -- ':!exec-plans'` returns nothing.

Documentation:

- [ ] `documentation/guides/add-new-api-endpoint.md` and `add-new-viewer-panel.md` exist, follow the required page
      shape, stay under 400 non-empty lines, name `npm run inventory:write` and `npm run check:all`, and are linked from
      `documentation/TABLEOFCONTENTS.md`.
- [ ] `AGENTS.md`, `README.md`, `CONTRIBUTING.md`, and every file under `documentation/` describe only gates that exist,
      and `tests/js/tool-path-existence-contract.test.mjs` passes, proving no surviving doc or `package.json` script
      names a deleted `tools/` path.
- [ ] No file outside `exec-plans/` cites this plan number or a phase number; `npm run check:smells` confirms.

## Related

- [../../documentation/guides/exec-plan-authoring.md](../../documentation/guides/exec-plan-authoring.md)
- [../../documentation/conventions/quality-gates.md](../../documentation/conventions/quality-gates.md)
- [../../documentation/conventions/testing-infrastructure.md](../../documentation/conventions/testing-infrastructure.md)
- [../../documentation/conventions/smell-prevention.md](../../documentation/conventions/smell-prevention.md)
- [../../documentation/conventions/coding-standards.md](../../documentation/conventions/coding-standards.md)
- [../../AGENTS.md](../../AGENTS.md)
