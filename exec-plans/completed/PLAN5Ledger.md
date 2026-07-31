# PLAN5 Execution Ledger

Execution-status ledger for `exec-plans/completed/PLAN5.md`. This is distinct from the
plan's own machine-readable policy ledgers (`tools/quality-policy/*.json`), which record
immutable captures and active policy state, not task-progress.

## in Work

(none)

## finished

### 10A-10F. Clean reproducibility, manual smoke, and completion

- Start/Finish: 2026-07-25 (same session, continuing directly from Phase 9)
- **10A (Clean, offline-capable setup):** Made a full working-tree copy (via `rsync`,
  including `.git` so `git ls-tree` calls against the frozen Phase 0 commit still resolve,
  since no commit exists yet this session) into a disposable scratch directory with
  `node_modules`/`venv`/`coverage`/`.hypothesis` excluded. `npm run setup` from that
  from-scratch state produced a fresh `node_modules` and `venv` with declared Node 26/npm
  12.0.1 and the locked developer-Python contract. Network was then genuinely intercepted
  (`http_proxy`/`https_proxy`/`HTTP_PROXY`/`HTTPS_PROXY` set to an unreachable
  `http://127.0.0.1:1`, plus `npm_config_offline=true`), and `npm run actions:lint`,
  `npm run check:standard`, and `npm run check:core` (the full non-coverage gate) all
  passed clean under that interception, proving ordinary checks touch only locked/
  cache-local inputs. The disposable copy was deleted afterward; nothing in the real
  working tree was touched by this proof.
- **10B (Complete focused/aggregate proof):** Ran every command from the plan's list
  individually against the real repo: `format:check`, `lint`, `actions:lint`,
  `duplication:check`, `typecheck`, `test:split`, `test:contract`, `test:focus:check`,
  `check:python-contracts`, `package:check`, `check:smells`, `check:complexity`,
  `check:scaling`, `check:docs` (substituting for the plan's never-introduced
  `docs:check`), `check:filesize`, `test:coverage:check`, `check:all`, `tools/
check-all.sh`, and `git diff --check` — all exit 0. Recorded final counts: 387 pytest
  tests, 225 `test:tools` Node tests (full `test:node`/`test:split` is substantially
  larger), Python aggregate coverage 95.77%, complexity baseline 0 tracked entries/0
  regressions, release manifest 58 runtime file/directory entries.
- **10C (Clone-local hook behavior):** `npm run hooks:doctor` and `npm run hooks:install`
  both pass in the real implementation clone (`core.hooksPath` was already correctly set
  to `.githooks`). The isolated-unconfigured-temp-repo fail-then-repair behavior is
  covered by the existing `tests/js/hooks.test.mjs` (12 tests, passing).
- **10D (Negative residue checks):** Verified exactly one `.github/workflows/*.yml`;
  no `CODEOWNERS`, `.pre-commit-config.yaml`, mutation config/dependency, or
  browser-driver dependency; no `check-performance.py`; no `check:ci` script; the sole
  workflow trigger is `push: tags: ["v*"]` (no branch/PR trigger); both `uses:` steps
  pinned to full 40-character SHAs (no mutable tag); no ordinary-gate `curl`/`wget`
  outside `install.sh`/`setup`/`actionlint.sh`; `venv/`/`node_modules/`/`.hypothesis/`/
  `coverage/` all correctly `git`-ignored, never untracked; no devDependency version
  range; smell-catalog/rule-parity-ledger completeness (enforced by `check:docs`/pytest)
  proves no generic checker is retained without a parity-ledger reason.
- **10E (Manual runtime smoke):** Started `tools/mock-server.py` and confirmed
  `viewer/viewer.html`/`.js`/`.css` serve `200` and `/api/status`/`/api/timeline` return
  correctly shaped JSON. Recorded, as an explicit and honest limitation rather than a
  false pass, that full interactive-browser visual confirmation (status cards, history
  strip, tooltip, day/night polar chip colors, presets, timeline, export preview,
  settings) was not performed, since this execution environment has no display or
  browser — the plan explicitly allows this ("No browser automation is required"); the
  underlying rendering logic is otherwise covered by the passing
  `tests/js/viewer-*.test.mjs` fake-DOM suite.
- **10F (Complete the plan):** Discovered and fixed a real pre-existing gap during
  closeout: `package-lock.json` existed on disk but was untracked by git even though
  `package.json` has been tracked since before this migration — staged it with `git add`
  (staging only, no commit). Moving the plan out of `exec-plans/active/` broke
  `tests/js/format-scope.test.mjs`'s "historical artifacts are excluded, not unsupported"
  test, which had hardcoded `exec-plans/active/PLAN5.md` as its one proof that
  `exec-plans/active/` paths are included (not caught by the `exec-plans/completed/`
  historical-exclusion regex) — fixed by adding an `exec-plans/completed/PLAN5.md`
  exclusion assertion (extending the existing completed-plan checks) and replacing the
  stale inclusion proof with `exec-plans/active/.markdownlint-cli2.jsonc`, a real file
  that remains under `exec-plans/active/` after the move. Updated
  `exec-plans/active/PLAN5.md`'s Status section with a
  completion note and the two transparent deviations (the `docs:check`/`check:docs`
  naming substitution, and the mock-server-level-only manual smoke), added a "Phase
  Progress Log" section with full Phase 10 evidence, and checked all 68 Acceptance
  Criteria checkboxes after verifying each against this session's actual evidence (no
  criterion checked without a corresponding passing command, test, or file inspection).
  Re-ran the complete `bash tools/check-all.sh` gate and `git diff --check` one final
  time after these documentation edits — both exit 0. Moved the plan to
  `exec-plans/completed/PLAN5.md` in the same change, per plan's own completion rule (no
  release, commit, tag, push, or GitHub Release side effect).
- Full-gate proof: `bash tools/check-all.sh` (⇒ `npm run check:all`) exits 0 — the final,
  post-completion-edit gate run before archiving the plan.

### 9A-9D. Consolidate documentation and audit canonical guidance

- Start/Finish: 2026-07-25 (same session, continuing directly from Phase 8)
- Documentation-only phase; no source, tool, package-script, hook, runtime, workflow, or
  release artifact changed.
- **9A (Root developer guidance):** README's developer section already linked
  CONTRIBUTING and named the canonical `npm run check:all`/`hooks:install`/
  `hooks:doctor`/`npm run setup` (done proactively during 8F); added the missing local
  release-authority statement and a link to the release workflow guide. CONTRIBUTING was
  missing several 9A-required items: added the Node 26/npm 12.0.1 + developer-Python
  statement, a `format`/`format:check`/`check:standard`/`check:fast`/`check:core`/
  `test:split`/`check:all` summary line (deferring full detail to quality-gates.md), a
  local release preparation/validation/create/push flow line, a standard-tool-first/
  focused-custom-checker-exception line, and `Related` links to quality-gates.md and
  release-workflow.md.
- **9B (Canonical agent guidance):** Confirmed `AGENTS.md` deliberately stays a routing
  map (per its own "use it to find focused docs" rule) rather than enumerating command
  names itself; verified `documentation/TABLEOFCONTENTS.md` correctly routes the
  command-graph/hook/release/coverage/complexity questions to the now-updated
  quality-gates.md/testing-infrastructure.md/documentation-maintenance.md/
  release-workflow.md. Confirmed `CLAUDE.md` is only the 8F-installed checked pointer, the
  obsolete `ai:check`/`ai:sync:*` commands and `sync-ai-instructions.mjs`/
  `check-ai-instructions.mjs` are already absent (removed in 8F), and the replacement
  `tools/check-agents-pointer.mjs` has clean-repo and 8-fixture deliberate-negative proof
  in `tests/js/agents-pointer.test.mjs`.
- **9C (Cross-cutting documentation consolidation):** Dispatched a read-only audit
  subagent over the full 9C document list to find concrete stale claims (wrong command
  name, deleted-tool reference, outdated composition, wrong path) rather than style
  nitpicks. Findings and fixes: `documentation/guides/documentation-maintenance.md` still
  named the deleted `npm run check:js:all` in its default-gate description and its
  targeted-checks example — rewrote the gate description around the real
  `check:core`/`test:coverage:check` split and swapped the targeted example to
  `npm run check:fast`. `ARCHITECTURE.md` had no repository-layout section at all for
  `types/`, `tests/js/`, or `tools/quality-policy/` (all created across Phases 2-8) — added
  a "Repository layout" paragraph naming each root's purpose and the explicit
  Python/JavaScript quality-tooling boundary (parallel authorities sharing only the
  command graph, no shared code). `documentation/architecture/ui.md` already correctly
  named the Phase 2 status extraction (`viewer/status-ui.js`/`StatusUI`) — confirmed
  clean, no change needed. `documentation/core-principles.md` rules 10 and 13 still said
  `tools/check-all.sh` where the canonical local-gate wording is now `npm run check:all`
  (the exact "canonical local gate wording only" scope named by the plan for this file) —
  updated both. Added an explicit "deliberately out of scope" paragraph to
  `documentation/conventions/quality-gates.md` stating the absence of CI governance
  (CODEOWNERS, branch/PR-triggered workflow, tag-triggered quality job), pre-commit,
  mutation testing, and browser automation/timing benchmarks, and restating the
  publisher-as-transport-only model — the plan's 9C consistency list named this
  explicitly and no existing doc stated it in one place. The remaining 9C files
  (`documentation/conventions/coding-standards.md`, `documentation-format.md`,
  `smell-fix-playbooks.md`, `smell-prevention.md`, `testing-infrastructure.md`,
  `documentation/guides/exec-plan-authoring.md`, `documentation/guides/
release-workflow.md`) were confirmed already consistent with the locked Phase 8 state
  (most had already been synchronized directly during 8F); no changes needed.
- **9D (Documentation-only proof):** Grepped for machine-local absolute paths.
  absolute-path residue across every `*.md` file outside `exec-plans/completed/` and
  `releases/` — none found. Grepped for lingering active claims naming
  `check-performance.py`/`check-coverage.py` as live checkers — the one match
  (`testing-infrastructure.md`) is explicit historical context ("replaces the old ...")
  documenting the Phase 7B removal, not a live claim; no change needed. Confirmed every
  command example referenced across the edited docs exists in `package.json`'s current
  `scripts` block.
- **Full Phase 9 exit-condition proof** (all exit 0): `npm run format:check`; `npm run
check:docs` (substituting for the plan's literally-named but never-introduced
  `docs:check`, per the same deviation recorded in the Phase 8 entry); `npm run
check:filesize`; `npm run check:core`; `git diff --check`. Line-count spot-check on
  every file touched this phase (`README.md` 354, `CONTRIBUTING.md` 53, `ARCHITECTURE.md`
  18, `documentation/core-principles.md` 22, `documentation/conventions/quality-gates.md`
  66, `documentation/guides/documentation-maintenance.md` 56 non-empty lines) — all far
  below the 400-line limit.
- Full-gate proof: `bash tools/check-all.sh` (⇒ `npm run check:all`) exits 0.

### 8A-8F. Harden local hooks, packaging, releases, and the pure publisher

- Start/Finish: 2026-07-24 (same session, continuing directly from Phase 7)
- **8A (Hooks):** Rewrote `.githooks/pre-push` to `set -euo pipefail`, resolve/`cd` to
  `git rev-parse --show-toplevel`, export stable `LC_ALL`/`LANG`, prepend
  `venv`/`POLARRECORDER_VENV` to `PATH`, and run exactly one `npm run check:all`. Renamed
  `install-hooks.mjs`/`check-hooks.mjs` to `hooks-install.mjs`/`hooks-doctor.mjs`
  (package aliases `hooks:install`/`hooks:doctor` unchanged), each exporting a testable
  `{root, print}` entry point. Added `tests/js/hooks.test.mjs` (12 tests): real `git init`
  temp repos prove install/doctor idempotence, drift detection, non-executable detection,
  missing-repo/missing-hook-file fail-closed, and pre-push argument/repo-root/gate-pass/
  gate-fail behavior via a fake injectable `check:all` script — no real clone's Git config
  is ever touched. Added `.githooks/README.md` documenting the one-time per-clone setup.
- **8B (SemVer/dirty-tree authority):** Added `tools/release-version.mjs` as the single JS
  SemVer/tag parser (`SEMVER_REGEX`, `parseSemver`, `isValidSemver`, `isPrerelease`,
  `tagFor`, `versionFromTag`, `githubOutputLines`, CLI `--github-output`). Added
  `tools/quality-policy/semver-corpus.json`, a shared valid/invalid corpus consumed by
  both `tests/js/release-version.test.mjs` (9 tests) and `tests/test_release_manifest.py`,
  so `release_manifest.py`'s byte-equivalent `SEMVER_RE`/new `is_prerelease()` can never
  silently diverge from the JS authority. Added `tools/release-git.mjs`
  (`parsePorcelainStatusZ`, `entryPaths`, `isDirtyOutsidePrefix`) with
  `tests/js/release-git.test.mjs` (8 tests) proving real `git init` rename/copy/space-
  containing-path parsing. `release-prepare.mjs` gained `--help`/`-h` (side-effect-free),
  `parseReleasePrepareArgs` (rejects unknown args), and `requireCleanTree` (fails unless
  `git status --porcelain=v1 -z` is fully empty); `tests/js/release-prepare.test.mjs` (8
  tests). `release-create.mjs` rewritten onto the shared `release-version.mjs`/
  `release-git.mjs` helpers, with its required-gate command changed from
  `tools/check-all.sh` directly to `["npm", "run", "check:all"]`; `tests/js/release-
create.test.mjs` (11 tests) prove invalid version/missing notes/existing tag/dirty
  tree/failing-gate-zero-side-effects/prerelease-and-build-metadata variants using fakes
  only.
- **8C (Manifest authority + package checks + installer tests):** Kept
  `release_manifest.py` as the sole runtime-file-list authority; removed
  `release-runtime.mjs`'s duplicate `buildReleaseManifest`/`validateManifest`, keeping
  only the explicitly non-authoritative advisory `isRuntimePath`. Added
  `manifest.build_zip_bytes(version, entries)`, shared by `release-zip.py` (disk write,
  now also prints a `SUMMARY_JSON={"filesIncluded":N,"totalSizeBytes":M}` line) and
  `check-release.py --dry-run` (real in-memory `io.BytesIO` build+validate of a
  `DEV_VERSION = "0.0.0-dev"` artifact, never touching `releases/`). `check-release.py`
  split into `validate_zip_file`/`validate_zip_bytes`/shared `validate_zip_archive`. Added
  `tests/test_check_release.py` (14 tests) and fixed a real cross-module bug in
  `load_release_manifest()`: it now registers the dynamically loaded module in
  `sys.modules["release_manifest"]` so every other dynamic loader (e.g.
  `check-release.py`) shares one `ReleaseError` class instead of silently creating a
  second, distinct one that broke `pytest.raises` across module boundaries. Added
  `tools/check-schema.mjs` (`plugin.json` dev-form vs. version-stamped release-form
  validator, `SCHEMA_OWNED_ARTIFACTS` inventory with a fail-closed completeness guard) —
  discovered mid-implementation that a standalone `schema:check` npm script is explicitly
  forbidden by Phase 8E's own text and by a pre-existing `tests/js/setup.test.mjs`
  assertion; fixed by folding `node tools/check-schema.mjs` directly into `package:check`'s
  command chain instead, and documented the constraint in the tool's header comment (the
  same lesson was reapplied for 8D's publisher-workflow checker below). Added
  `check:python-contracts`/`package:check` as real npm scripts (`command-graph.json`'s
  `notYetActivatedLeaves` shrank accordingly). Closed the previously-deferred install.sh
  test gap named in Phase 8C's exit list: added `tests/js/install-script.test.mjs` (12
  tests) covering help/argument parsing, dry-run source/target selection (including
  latest-tag resolution via a fake `curl` and explicit prerelease+build-metadata URL
  construction preserving the full version string verbatim), download failure with zero
  target mutation, unsafe-ZIP rejection (two top-level dirs; missing `plugin.json`) with
  zero target mutation, and a full install from a local ZIP proving only the fake
  `curl`/`wget`/`systemctl` are ever invoked, never a real network or AvNav command.
  Updated `tools/quality-policy/phase0-rule-parity-ledger.json`'s `installer-behavior` row
  (regenerated via `generate_phase0_rule_parity_ledger.py --write`, digest re-anchored in
  `tests/test_phase0_captures.py`) to record this as complete rather than the prior
  "untested" state.
- **8D (Publisher hardening):** Rewrote `.github/workflows/publish-release.yml` to the
  exact minimal boundary: `v*`-tag-only trigger, top-level `contents: read` +
  job-scoped `contents: write`, ref-scoped non-canceling concurrency, 10-minute timeout,
  exactly 4 steps (tag-ref checkout, `id: release_version` running exactly
  `node tools/release-version.mjs --github-output "$GITHUB_REF_NAME" >>
"$GITHUB_OUTPUT"`, `id: release_assets` artifact lookup under `set -euo pipefail`,
  GitHub Release creation), with `actions/checkout`/`softprops/action-gh-release` pinned
  to real full 40-character commit SHAs (looked up via `git ls-remote --tags` against the
  real GitHub repositories) with readable `# vX.Y.Z` comments. Added
  `tools/check-publisher-workflow.mjs` (parses the workflow with `js-yaml`'s named
  `load` export — v5 has no default export — and asserts an exact allowlist: job ID,
  ordered step list, `uses` identities/SHA-pin format, `with` fields, normalized `run`
  lines), folded into `actions:lint` rather than exposed as a new standalone script (same
  naming-discipline lesson as 8C's `schema:check`). Fixed a SHA-pin regex bug (stripping
  the `uses:\s*` prefix before testing, since the anchored character class didn't include
  `:`/space). Added `tests/js/check-publisher-workflow.test.mjs` (8 tests): real-repo
  pass, 6 negative fixtures (extra workflow file, extra trigger event, `needs` declared,
  renamed step, tag-instead-of-SHA pin, extra `with` field), and a real dependency-free-
  execution proof (copies only `release-version.mjs` into an empty tmpdir with no
  `node_modules`, runs it directly, asserts exact stdout) — proving the publisher's `run`
  step needs nothing beyond Node built-ins.
- **8E (Final command-authority lock):** Replaced every transitional alias with the
  literal Phase 1C graph in the same change `check:migration` was deleted. Added
  `typecheck:python` (`mypy --strict`, folded into `typecheck` alongside
  `typecheck:source`/`typecheck:tests`); expanded `check:python-contracts` to run
  `check-python-compat.py`, `check-py-contracts.py`, `check-py-dependencies.py`, and
  `check-runtime-contracts.py` (explicitly not `check-duplication.py`, owned only by
  `duplication:python`); combined `check:filesize` to run both
  `check-file-size.mjs --oneliner=block` and `check-python-filesize.py`. Deleted
  `check:js:core`/`check:js:all` entirely (their JS/viewer/contract leaves are already
  reached through `test:node`/`test:contract`, part of `test:split`). Replaced
  `check:core` with the exact literal composition (`check:standard && typecheck &&
package:check && test:focus:check && check:smells && check:python-contracts &&
test:split && check:complexity && check:scaling && check:docs && check:filesize`),
  `check:all` with `check:core && test:coverage:check`, added `check:strict` as an exact
  alias, and added `check:fast` (`check:standard && typecheck && test:split &&
check:python-contracts`). Rewrote `tools/check-all.sh` to a 4-line pure compatibility
  wrapper (`cd` to repo root, `npm run check:all`). Updated
  `tools/quality-policy/command-graph.json` (`notYetActivatedLeaves` emptied) and
  regenerated `phase0-rule-parity-ledger.json`'s `check-core-inclusion` row (digest
  re-anchored). Added `tests/js/command-graph.test.mjs` (20 tests): exact ordered
  `check:core` composition, exact `check:all`/`check:strict` strings, exact 4-line
  wrapper content, no forbidden script name (`check:migration`/`check:ci`/`schema:check`/
  `check:js:core`/`check:js:all`), no undeclared `npm run` reference, no recursive script
  cycle, hook/release automation each invoking `check:all` exactly once (grep-verified
  against the real files), and — the plan's explicit "deliberate failing fixture per
  required group" requirement — a from-scratch fixture package graph (real `npm run`,
  isolated tmpdir, injectable per-leaf failure via `POLARRECORDER_FAIL_LEAF`) proving both
  `check:core` and the real `tools/check-all.sh` wrapper propagate failure for every one
  of the 11 required groups, plus one all-passing baseline. Discovered and fixed two
  git-index-staleness false gate failures along the way: `tools/check-hooks.mjs` and
  `tools/install-hooks.mjs` (renamed away in 8A) were still `git ls-files --cached`-
  visible because their deletions were never staged, which made
  `tools/quality-policy/generate-format-scope.mjs` (which deliberately unions `--cached`
  with `--others --exclude-standard` so uncommitted new files are never silently
  unscoped) keep re-emitting stale rows referencing files that no longer exist on disk;
  fixed by `git add`-ing the deletions (staging only, no commit) and regenerating
  `format-scope.json`.
- **8F (Delivery-owner sync + AGENTS.md/CLAUDE.md consolidation):** Made `AGENTS.md` the
  sole canonical instruction owner and replaced `CLAUDE.md` with a 24-line pointer (link
  to `AGENTS.md`, the 3 mandatory preflight files, and the existing Claude-specific
  notes) — removed the old `<!-- BEGIN/END SHARED_INSTRUCTIONS -->` markers from both
  files, since nothing syncs them anymore. Added `tools/check-agents-pointer.mjs`
  (`runAgentsPointerCheck({root, print})`: AGENTS.md/CLAUDE.md existence, no re-expanded
  shared-instruction block, a hard 40-non-empty-line pointer budget, a literal
  `[AGENTS.md](AGENTS.md)` link, and each mandatory preflight file both named in the text
  and present on disk), folded into `check:docs` in place of the retired `ai:check`.
  Deleted `tools/sync-ai-instructions.mjs` and `tools/check-ai-instructions.mjs` and their
  `ai:sync:agents`/`ai:sync:claude`/`ai:check` package scripts only after the new pointer
  contract was active. Added `tests/js/agents-pointer.test.mjs` (9 tests): real-repo pass,
  a clean fixture pass, and 6 fail-closed negative fixtures (missing `AGENTS.md`, missing
  `CLAUDE.md`, re-expanded shared-instruction block, over-budget line count, missing
  `AGENTS.md` link, missing/nonexistent preflight-file citation) — directly satisfying the
  plan's "negative test proves instruction drift or a broken pointer fails" requirement.
  Updated every live citation of the old byte-sync contract: `AGENTS.md`'s own checklist
  and smell-prevention bullet, `documentation/conventions/coding-standards.md`,
  `documentation/guides/documentation-maintenance.md`, `documentation/conventions/
smell-prevention.md` (renamed the "AI instruction drift" catalog row to "CLAUDE.md
  pointer drift" in both the table and `check-smell-catalog.mjs`'s `REQUIRED_SMELL_RULES`,
  keeping them in lockstep), and the "CLAUDE.md Section 8" source citations in
  `check-duplication.py`/`check-js-duplication.mjs`/`check-py-contracts.py` (now
  "AGENTS.md Section 8", since AGENTS.md is the canonical body going forward). Rewrote
  `documentation/conventions/quality-gates.md` in full (it still described the pre-8E
  migration-phase gate) to the final locked `check:core`/`check:all`/`check:strict`/
  `check:fast` composition table. Updated `README.md`'s developer section (canonical
  `npm run check:all`, `tools/check-all.sh` named as the wrapper, `npm run setup`/
  `hooks:install`/`hooks:doctor` named per Phase 9A's audit criteria) and
  `CONTRIBUTING.md` (added `hooks:doctor`, replaced `tools/check-all.sh`-as-primary-name
  citations with `npm run check:all`). `.githooks/README.md` and
  `documentation/guides/release-workflow.md` needed only two `tools/check-all.sh` →
  `npm run check:all` wording fixes; already otherwise current.
- **Deviation (recorded, not silently substituted):** PLAN5's own Phase 8 exit-condition
  code block and `tools/quality-policy/command-graph.json`'s `finalCheckCoreComposition`
  literally say `npm run docs:check`, but no script by that name was ever introduced
  anywhere in the plan or this repository — the actual, consistently-used script name
  throughout every other PLAN5 code block, `check-core-inclusion`'s ledger row, and this
  session's own work is `check:docs`. Treated as a plan-prose naming inconsistency (not a
  real missing leaf) and ran `npm run check:docs` in its place for the exit-condition
  proof below; did not add a duplicate `docs:check` alias script, which would itself
  violate 8E's "no duplicate leaf command" requirement.
- **Full Phase 8 exit-condition proof** (run in order, all exit 0): `npm run
format:check`; `npm run test:tools` (225 tests); `npm run test:contract`; `npm run
package:check` (36 Node + 19 pytest); `npm run actions:lint`; `bash -n
.githooks/pre-push`; `npm run check:docs` (docs:check substitution, see deviation
  above); `npm run check:filesize`; `npm run check:core`; `git diff --check`.
  Repository-search proofs: exactly one file under `.github/workflows/`
  (`publish-release.yml`); no `CODEOWNERS` file anywhere; no `.pre-commit-config.yaml`;
  the workflow's only trigger is `push: tags: ["v*"]` (no branch/PR trigger, no tag
  quality job, no remote build path); `git status --porcelain releases/` is empty,
  proving every historical release artifact under `releases/` is byte-unchanged.
- Full-gate proof: `bash tools/check-all.sh` (⇒ `npm run check:all`) exits 0 — 387 pytest
  passed, full Node test/coverage suite passed, `check:coverage-inventory` passed.

### 7A-7D. Add complexity ratchets and deterministic scaling contracts

- Start/Finish: 2026-07-24 (same session, continuing directly from Phase 6)
- **7A (JavaScript complexity no-regression policy):** Found and adapted the sibling
  `paired-project` plugin's own `tools/quality-policy/complexity-scan.mjs`/
  `complexity-budget.mjs`/`phase0-complexity-capture.mjs` (explicitly named in the plan
  text) for Polar's production JS roots (`PRODUCTION_ROOTS = ["viewer"]`, plus the two
  entrypoints). Unlike the temporary Phase 2A `complexity-scan-lib.mjs` (hand-rolled
  metric counting for every function), the permanent scanner delegates to ESLint's own
  `complexity`/`max-statements`/`max-depth`/`max-params` rule implementations via the
  programmatic `Linter` API and reports only functions already over the strict 10/40/4/6
  limits, each keyed by a stable lexical-nesting-and-naming identity (occurrence-counted
  `#n` suffix for same-named siblings) built by a small AST walker independent of ESLint's
  own traversal. Added `tools/quality-policy/phase0-complexity-capture.mjs` (reads the
  exact Git blobs named by the existing, frozen `phase0-complexity-source-capture.json`
  via `git cat-file -p <blob>`, verifies each blob's content still hashes to its recorded
  `contentSha256`, fails loudly on any mismatch, then scans that exact historical content
  with the locked scanner to produce immutable `complexity-findings-capture.json`) and
  `tools/quality-policy/complexity-budget.mjs` (verifies the findings capture still
  matches what's derived from the blobs, verifies every active `complexity-baseline.json`
  entry against that immutable capture -- never above its Phase 0 value, never new,
  duplicate, or malformed -- then scans the live tree and requires every finding at or
  below its baseline value, and every baseline entry to still have a matching live
  finding). The immutable capture holds exactly 4 historical findings (3 `max-statements`
  in the pre-split `export-ui.js`/`polar-chart.js`/`viewer.js`, 1 `max-params` in
  `polar-chart.js`'s `addCurve`) -- all 4 were already fixed during Phases 2 and 4 (the
  viewer.js split; `addCurve`'s param-bundling into a `BandInfo` typedef), so
  `complexity-baseline.json` starts empty, confirmed by running the new scanner against
  the live tree before writing the baseline (zero findings). Deleted
  `check-complexity-migration.mjs`, `complexity-scan-lib.mjs`, and
  `tests/js/complexity-migration.test.mjs` (the Phase 2A temporary owner and its
  self-test) in the same change as their replacement. Added 17 self-tests in
  `tests/js/complexity-budget.test.mjs` (adapted from `paired-project`' own
  `complexity-budget.test.js`, minus its `jsonc-parser`-based duplicate-JSON-key
  detection -- a deliberate scope reduction, since no other Polar quality-policy checker
  uses that hardening and adding a new dependency for one lone check would be
  inconsistent with the rest of this ledger's checkers, all of which use plain
  `JSON.parse`), independently anchoring `phase0-complexity-source-capture.json`'s
  SHA-256 the same way prior phases anchor their own frozen captures. Exposed
  `check:complexity` (`phase0-complexity-capture.mjs --check && complexity-budget.mjs`)
  and wired it into `check:js:core` immediately before `check:docs`/`check:filesize`,
  matching the final `check:core` composition's recorded ordering in
  `command-graph.json`; removed `check:complexity` from `notYetActivatedLeaves`.
  - Real transitive typing debt found while bringing the new files under strict
    `checkJs` via `tsconfig.tests.json` (the same phenomenon recorded in the Phase 5B
    entry): `complexity-scan.mjs`'s adapted-from-paired-project AST-walking code had no
    JSDoc types at all (paired-project does not hold `tools/quality-policy/` to strict
    `checkJs`); added a full `AstNode`/`Finding`/`FunctionIndexEntry` typedef set and
    ~40 parameter/return annotations, fixed one ESLint `Linter.RulesRecord` cast and one
    `message.ruleId`-can-be-`null` narrowing gap (both real, both in the adapted code,
    neither present in the original hand-rolled Phase 2A scanner).
- **7B (deterministic scaling contracts):** Ported the sibling `paired-project` plugin's
  `operation-count-evaluator.mjs` to Python as `tests/operation_count_evaluator.py`
  (`evaluate_linear_scaling`: `work(2n) <= 2*work(n) + fixed_overhead`;
  `evaluate_bounded_by_configured_steps`: `work(steps) <= steps*tolerance_per_step`; both
  pure functions over caller-supplied integer operation counts, never a clock), with 13
  self-tests in `tests/test_operation_count_evaluator.py` covering a clean linear
  workload, a synthetic quadratic sequence that violates the envelope, a
  bounded-by-steps pass and an input-length-dependent-work violation, and fail-closed
  rejection of non-integer/negative/too-few-samples inputs. Added a shared
  `tests/counting_dict.py` (`CountingDict`, a `dict` subclass counting every `get`/
  `__setitem__` against a caller-supplied shared counter -- a test-only observable, not
  an instrumentation change to production code) after noticing the first real contract
  needed the identical technique a second time; refactored `tests/test_polar_model.py`'s
  already-written local copy to import the shared one instead of leaving a duplicate.
  Added the three named real contracts: (1) `PolarModel.update_accepted`'s per-sample
  dict/histogram operations stay linear in accepted-sample count, and instrumented vs.
  ordinary runs produce identical generation/histogram/total_accepted
  (`tests/test_polar_model.py`, via directly substituting `model._bins`/`Bin.histogram`
  with `CountingDict` instances before the update loop -- a legitimate direct-attribute
  test substitution, not a change to `PolarModel`'s source); (2)
  `projection.project_grid`'s raw-bin reads stay linear in raw-bin count for a fixed
  production-equivalent grid, and instrumented vs. ordinary cells are identical
  (`tests/test_projection_scaling_contract.py`, via wrapping each raw bin's data mapping
  in `CountingDict` -- `project_grid` already accepts an abstract `Mapping` per its own
  type annotation, so this needed no production code change); and (3)
  `api_handlers.format_polar`'s projection-facing reads stay linear in raw-bin count for
  a fixed grid, its curve/cell assembly (`_polar_entry` calls, monkeypatched with a
  counting wrapper via `pytest`'s `monkeypatch`) stays exactly bounded by
  `len(tws_grid) * 360` for a fixed snapshot with increasing TWS-grid cell counts, and
  the complete response (format/percentile/generation/tws_bands/curves, including
  missing-cell `None`s) from instrumented and ordinary runs is byte-identical
  (`tests/test_api_handlers_scaling_contract.py`) -- proving the full-formatter contract
  the plan requires, not just a lower-level `project_grid` result. Extracted the shared
  collision-free raw-bin-fixture builder (`build_model_bins`, spreading bins bijectively
  across a 360x61 TWA/TWS space via `twa = i % 360, tws = i // 360`) into
  `tests/scaling_contract_fixtures.py` once the second contract needed the identical
  construction, rather than duplicating it. Deleted `tools/check-performance.py` and its
  dedicated `tests/test_performance_checker.py` in the same change as the deterministic
  replacements, after confirming all new contracts pass; removed the corresponding line
  from `tools/check-all.sh`. Exposed `check:scaling` as
  `pytest tests/test_operation_count_evaluator.py tests/test_polar_model.py
tests/test_projection_scaling_contract.py tests/test_api_handlers_scaling_contract.py`
  and wired it into `check:js:core` next to `check:complexity`, before `check:docs`;
  removed it from `notYetActivatedLeaves`.
  - Real Python one-line-compression violations found and fixed (not suppressed): four
    `collapsed-literal`/`lambda-packed` findings in the new property/scaling test files
    where a 4+-item literal or an inline `lambda` pushed a call past the 80-column
    checker threshold even though the line was under Ruff's own 100-column limit (so
    `ruff format` kept re-collapsing naive line-break attempts). Fixed by extracting
    named local functions in place of inline lambdas and, for one 5-field tuple
    comparison, replacing a comprehension-built tuple list with direct
    field-by-field assertions -- clearer anyway, not just a formatting workaround.
- **7C (wire policies into core):** `check:complexity` and `check:scaling` now run inside
  `check:js:core` (which `tools/check-all.sh` already calls via `check:js:all`)
  immediately before `check:docs`/`check:filesize`, matching
  `command-graph.json`'s `finalCheckCoreComposition` ordering
  (`... && check:complexity && check:scaling && docs:check && check:filesize`) even
  though the literal final `check:core` promotion itself is still Phase 8E's job.
  Removed the stale `check:complexity:migration` step from `check:migration`'s
  composition (superseded; `check:complexity` already runs earlier via
  `check:js:core`/`check-all.sh`).
- **7D (documentation sync):** Updated `documentation/conventions/quality-gates.md`
  (removed the retired `check-performance.py` Python-gate row; added
  `check:complexity`/`check:scaling` rows to the JS gate table; fixed the stale
  `check:complexity:migration` reference in the `check:migration` row),
  `documentation/conventions/testing-infrastructure.md` (replaced the wall-clock
  performance bullet with two new bullets describing the complexity ratchet and the
  three counted-operation scaling contracts in full), `documentation/conventions/
coding-standards.md` (replaced the `MAX_UPDATE_SCALING_RATIO` wall-clock description
  with the new deterministic mechanisms), and `documentation/conventions/
smell-prevention.md`/`tools/check-smell-catalog.mjs` (updated "Hot-path regression"'s
  enforcement column to name the new `check:scaling` contracts; added a new "JS
  complexity regression" row/rule, 93 total). Grepped `AGENTS.md`/`CLAUDE.md`/
  `ROADMAP.md` for stale `check-performance`/`check-complexity-migration`/
  `complexity-scan-lib` references before considering the phase done -- found none.
- Verification: `npm run check:complexity`, `npm run check:scaling`,
  `npm run test:python` (376 passed), `npm run check:docs`, and `npm run check:migration`
  each run standalone and green, matching the plan's exact Phase 7 exit-condition list;
  `bash tools/check-all.sh` green end-to-end afterward. `npm run test:tools` (121 tests,
  including the 17 new `complexity-budget.test.mjs` cases) and
  `npm run typecheck:tests`/`npm run typecheck:source` both clean.
  `python -m ruff check .`/`ruff format --check .`/`mypy --strict` clean repo-wide.
- Deviations: (1) skipped `paired-project`' `jsonc-parser`-based duplicate-JSON-key
  detection in `complexity-budget.mjs` for the reason recorded in 7A above (consistency
  with every other Polar quality-policy checker's plain-`JSON.parse` convention, not a
  correctness gap this project has ever guarded elsewhere); (2) the already-recorded
  `docs:check`-vs-`check:docs` naming gap, unchanged from prior phases.

### 6A-6D. Make coverage inventory-complete and add property tests

- Start/Finish: 2026-07-24 (same session, continuing directly from Phase 5)
- **6A (stable coverage reports):** Added `npm run test:coverage:python`
  (`pytest --cov=polarrecorder --cov=plugin --cov-branch --cov-report=json:coverage/python/coverage.json
--cov-fail-under=90`, cleaning/recreating only `coverage/python/`) and
  `npm run test:coverage:viewer` (`c8 --all --include 'viewer/*.js' --include 'plugin.js'
--include 'plugin.mjs' --temp-directory coverage/viewer/tmp --report-dir coverage/viewer
--reporter=json-summary --reporter=text --check-coverage --lines 80 --functions 80
--statements 80 --branches 65`, cleaning/recreating only `coverage/viewer/`, run over the
  five viewer test files plus the newly-included `tests/js/plugin-entrypoints.test.mjs`).
  `coverage/` was already `.gitignore`d from an earlier phase, no change needed. Installed
  `c8` (exact-pinned `12.0.0`, matching every other devDependency's no-caret convention) as
  a new devDependency; `npm install` required the sandbox's network access, which briefly
  needed a user-visible retry before the package resolved.
  - Proved c8's VM attribution directly before relying on it: ran c8 over the viewer +
    plugin-entrypoint tests and confirmed every real `viewer/*.js` file (including the
    Phase 2/4-added `status-ui.js`/`export-fields.js`/`export-presets.js`/
    `polar-chart-geometry.js`) and both `plugin.js`/`plugin.mjs` (loaded through
    `vm.runInNewContext(..., { filename })`) attribute correctly, with per-file
    percentages closely matching the retired hand-rolled `check-js-coverage.mjs`'s
    numbers. No V8 attribution adapter or fallback was needed.
  - Deleted `tools/check-js-coverage.mjs` (superseded by c8) and `tools/check-coverage.py`
    (its validation-package/histogram-core family logic folded into the new inventory
    checker) plus `tests/test_coverage_checker.py` (its self-test), in the same change as
    their replacement -- no dangling temporary owner.
- **6B (combined coverage inventory and ratchet):** Added
  `tools/quality-policy/coverage-floors.json` (the active, ratchetable floor set: 5
  family floors carried forward from `check-coverage.py`'s validation/histogram rules and
  the Python aggregate, 4 new family floors for the viewer family and the
  plugin-entrypoint family at 80/80/80/65 lines/functions/statements/branches, `plugin.py`'s
  own combined line+branch floor, all 17 real viewer files' per-file line floors, a
  default-new-file 80/65 line/branch floor, and an empty `contractOwned` section for both
  languages -- no file is currently contract-owned, matching the "prefer measured over
  fixture/exemption" default), `tools/quality-policy/coverage-floor-baseline.json` (the
  historical floor lock, mechanically re-derivable every run from
  `phase0-coverage-capture.json`'s `preMigrationConfiguredFloors` for the 5 families and 13
  original viewer files, and from `pluginPyCoverage.combinedLineAndBranchPercent` for
  `plugin.py`, since `plugin.py` had no pre-migration configured floor to inherit), and
  `tools/quality-policy/check-coverage-inventory.mjs` (the permanent owner: derives and
  diffs the baseline against the capture; ratchets the active floors against the baseline;
  classifies every `server/polarrecorder/**/*.py` + `plugin.py` + `viewer/*.js` +
  `plugin.js` + `plugin.mjs` file as measured or contract-owned, with contract ownership
  requiring a real, statically-verified owner test -- Python via an embedded `ast`
  subprocess proving the owner function exists and imports the target module, JavaScript
  via `test-inventory.mjs`'s `discoverExecutableTestHelpers`, reused rather than
  reimplemented -- and rejecting stale targets or owners that still show measured
  coverage; enforces every family/per-file floor against the live reports). Added 17
  self-tests in `tests/js/coverage-inventory.test.mjs`, independently anchoring
  `phase0-coverage-capture.json`'s SHA-256 the same way `test-inventory.test.mjs` anchors
  the exception baseline's digest, plus fake-root negative fixtures for every failure
  mode (baseline/capture mismatch, floor regression below baseline, unclassified
  file, per-file and family floor violations, and all four contract-ownership rejection
  shapes). Wired `test:coverage:check` (`test:coverage:python && test:coverage:viewer &&
check:coverage-inventory`) into `tools/check-all.sh` as its final step, removed
  `check:js-coverage` from `check:js:core`, and removed `test:coverage:check` from
  `command-graph.json`'s `notYetActivatedLeaves`.
  - Real bug found while writing the first draft: `requireAtLeast`'s live-vs-floor
    comparison used the raw, many-digit `percent_covered` value straight from
    coverage.py/c8, which is occasionally a hair below a floor that was itself captured
    rounded to 2 decimals (e.g. `plugin.py`'s live 94.31818...% failing its own 94.32%
    floor). Fixed by rounding the live measurement to 2 decimals before comparing,
    matching the Phase 0 capture generator's own rounding convention, rather than
    loosening the floor.
  - Retired the now-redundant `viewer-coverage-target-contract` smell contract (its
    "every viewer file has a coverage target" check is strictly subsumed by the new
    inventory's completeness check, now backed by real measured percentages instead of a
    name-list grep) -- removed it from `check-smell-contracts.mjs`, its rule ID, and the
    corresponding assertion/fixture in `tests/js/js-checkers.test.mjs` in the same change.
  - Updated `pyproject.toml`'s stale `[tool.coverage.run]` comment (previously said
    `plugin.py` was deliberately excluded from the 90% gate; it is now measured, gated by
    the new checker rather than by `fail_under`).
- **6C (Hypothesis invariants):** Added focused property tests, all with
  `allow_nan=False, allow_infinity=False` bounded strategies so no NaN/Infinity handling
  needed to be added to production code: `circular_distance` symmetry, rotation
  invariance, and `[0, 180]` boundedness, and `circular_range` `[0, 360]` boundedness
  (with a small epsilon since floating-point modulo can overshoot the exact bound by a
  few ULPs -- found by Hypothesis itself on `circular_range([-5.8e-10, -5.8e-10])`,
  fixed in the test's tolerance, not in `angle_math.py`) and rotation invariance, in
  `tests/test_angle_math.py`; `twa_bin`/`tws_bin` bounded output and `twa_bin`'s
  360-degree periodicity in `tests/test_bins.py`; knot/meters-per-second round trips
  within a named `rel_tol`/`abs_tol` in `tests/test_units.py`; and `percentile`'s
  `None`-only-for-empty-input, finite-and-observed-deciknot-key, and monotonicity
  invariants (extending the existing hand-picked monotonicity test with an
  arbitrary-histogram version) in `tests/test_histogram.py`. `hypothesis==6.161.2` was
  already present in `requirements-dev.in`/`requirements-dev.txt` from earlier
  preparation in this session; no new lock change was needed.
- **6D (documentation sync):** Updated `documentation/conventions/quality-gates.md`
  (removed the two retired `/tmp`-path Python coverage gate rows and the retired
  `check:js-coverage` row; added `test:coverage:python`/`test:coverage:viewer`/
  `check:coverage-inventory`/`test:coverage:check` rows to the migration-phase gate
  table; noted `test:coverage:check` as `tools/check-all.sh`'s final step),
  `documentation/conventions/testing-infrastructure.md` (rewrote the coverage bullets
  around the two reports and the new inventory checker; added a Hypothesis bullet),
  `documentation/conventions/coding-standards.md` (updated the custom-checker list and
  the per-file viewer coverage-floor bullet to name the new checker and its
  default-new-file floor), and `documentation/conventions/smell-prevention.md`/
  `tools/check-smell-catalog.mjs` (updated "Viewer coverage target"/"Untested viewer
  logic"/"Overall Python coverage"/"Validation coverage floor"/"Histogram coverage
  floor" to point at the new checker; added "Plugin.py coverage floor", "JS coverage
  family floor", "Coverage inventory completeness", and "Coverage floor regression" as
  four new required rules, 92 total).
- Verification: `npm run test:coverage:check`, `npm run check:coverage-inventory`,
  `npm run test:python` (356 passed), `npm run test:viewer`, and `npm run check:docs` each
  run standalone and green, matching the plan's exact Phase 6 exit-condition list (ran
  `check:docs` in place of the still-not-yet-named `docs:check`, the same recorded
  deviation as every prior phase); `bash tools/check-all.sh` and `npm run check:migration`
  both green end-to-end afterward. `npm run test:tools` and
  `python -m pytest tests/ --tb=short` (356 passed, up from 347) both green.
  `python -m ruff check .`/`ruff format --check .`/`mypy --strict` clean on the four
  edited property-test files.
- Deviations: none beyond the already-recorded `docs:check` naming gap. Two tracked-file
  deletions (`tools/check-coverage.py`, `tools/check-js-coverage.mjs`) and one
  (`tests/test_coverage_checker.py`) needed `git add -u` staging (not a commit) for
  `generate-format-scope.mjs`'s `git ls-files --cached` scan to stop treating them as
  live, the same class of housekeeping already recorded in the Phase 5 entry.

### 5A-5D. Standardize Node tests and enforce strict test-code ownership

- Start/Finish: 2026-07-24 (same session, continuing directly from Phase 4)
- **5A (migrate to `node:test`):** Converted all 15 `tools/test-*.mjs` executables into
  `tests/js/*.test.mjs` suites (one file per original, same filename minus the `test-`
  prefix): `check-patterns`, `complexity-migration`, `eslint-config`, `format-scope`,
  `hotspot-budgets`, `js-checkers`, `plugin-entrypoints`, `setup`,
  `typecheck-migration-tests` (later replaced in 5B), `typecheck-source`,
  `viewer-advanced`, `viewer-enhanced`, `viewer-polar`, `viewer-smoke`, `viewer-theme`.
  Every top-level `testX(); testY(); console.log("... passed.")` script became individual
  `test("description", () => {...})` blocks with no success sentinel; all assertions and
  behavior cases preserved verbatim (`git diff` per file was a mechanical
  function-call-to-`test()`-block transform plus import-path fixups, not a logic change).
  `tools/viewer-harness.mjs` stayed in `tools/` (452 non-empty lines; `tools/` is exempt
  from the 400-line limit, and moving it would have forced a split the plan explicitly
  allows skipping). Deleted all 15 original `tools/test-*.mjs` files and staged the 8
  that were git-tracked (`git add -u` on those exact 8 paths only) so
  `git ls-files --cached` -- which `generate-format-scope.mjs` and other discovery tools
  read -- stopped reporting them as still-present; the other 7 were never committed and
  needed no staging.
  - Real bug found and fixed during migration: running multiple test **files**
    concurrently (`node --test`'s default) raced two files that mutate real repo state
    -- `eslint-config.test.mjs` temporarily writes `viewer/__eslint_test_probe.js` and
    overwrites/restores `plugin.js`/`plugin.mjs` in place, while `typecheck-source.test.mjs`
    and `format-scope.test.mjs` independently scan the same live tree -- causing spurious
    "unexpected extra file" failures only when run together. Fixed by adding
    `--test-concurrency=1` to every multi-file `node --test` invocation
    (`test:tools`, `test:viewer`), restoring the same effective seriality the old
    `&&`-chained `tools/test-*.mjs` invocations always had, rather than papering over the
    race with a retry or a narrower scan.
  - `tools/check-js-coverage.mjs`'s `TEST_FILES` array and its `Depends:` header, plus
    `check-smell-contracts.mjs`'s `viewer-coverage-target-contract` string check and its
    `smellContractsWorkspace()` synthetic fixture (in `tests/js/js-checkers.test.mjs`),
    all still referenced the old `tools/test-viewer-*.mjs` paths and were updated to the
    new `tests/js/viewer-*.test.mjs` paths in the same change (a real drift the smell
    contract's own self-test caught).
- **5B (strict test inventory and typecheck):** Added
  `tools/quality-policy/test-inventory.json` (committed, regenerable via
  `node tools/quality-policy/test-inventory.mjs --write`), independently digest-anchored
  `tools/quality-policy/test-exception-baseline.json` (SHA-256
  `b9fe30b1...42400a7f0b`, hardcoded in `tests/js/test-inventory.test.mjs`, not derived
  from the file itself; `exceptions: []`, derived from `phase0-test-capture.json`'s
  verified-empty `executableTestExceptionSet`), `tools/quality-policy/test-inventory.mjs`
  (the permanent owner: `discoverExecutableTestHelpers` finds every
  `tests/js/**/*.test.mjs` plus `tools/*-harness.mjs`; every entry is classified
  `strict`, no harness exception class exists; `checkPlannedFixtureProvenance` validates
  any file under `tests/fixtures/quality/` against `phase0-planned-quality-fixtures.json`
  -- currently empty, so this path is proven only via fake-root negative tests, not a
  committed fixture), and `tsconfig.tests.json` (strict no-emit `checkJs`, `types:
["node"]` so `node:fs`/`node:test`/etc. resolve, unlike `tsconfig.checkjs.json`'s
  deliberately DOM-only `types: []`).
  - Bringing all 15 (now 17 after 5C) test/helper files under strict `checkJs` for the
    first time (they were never part of any prior strict-typing owner, unlike
    `viewer/*.js`) surfaced real transitive typing debt: importing a `tools/check-*.mjs`
    checker from a test file pulls that checker into the same TypeScript program, so
    ~470 lines of implicit-any/narrowing errors appeared across 11 previously-untyped
    tool files. Fixed by JSDoc-typing all of them in this same change (5 background
    agents worked disjoint file sets in parallel, verified independently, then merged):
    `check-namespace.mjs`, `check-naming.mjs`, `check-headers.mjs`,
    `check-smell-catalog.mjs` (Agent 1); `check-viewer-contracts.mjs`,
    `check-smell-contracts.mjs`, `check-dependencies.mjs` (Agent 2, fixed one genuine
    possibly-undefined `Map.get` access in `check-dependencies.mjs`'s `mapReferences`
    with a fail-loud `if (!bucket) throw` instead of a cast); `check-js-duplication.mjs`,
    `check-file-size.mjs` (Agent 3, fixed three genuine `Map.has`-then-`.get()` unsound
    patterns with a get-or-create local-variable rewrite); `check-patterns.mjs` (Agent 4,
    ~30 functions, no genuine null-safety bugs found -- all regex/match results were
    already correctly guarded); `tools/viewer-harness.mjs` (Agent 5, 17 typedefs, two
    genuine but previously-unreachable null-safety fixes now throwing descriptive errors
    instead of crashing on `undefined()`). Then typed the two test files with local fake
    DOM objects myself (`viewer-theme.test.mjs`, `viewer-polar.test.mjs`) and the three
    harness-consuming files after the harness agent finished
    (`viewer-smoke.test.mjs`, `viewer-advanced.test.mjs`, `viewer-enhanced.test.mjs`),
    adding a `polarrecorderOf(env)` any-cast helper for the harness's honestly-`unknown`
    `Polarrecorder` field and two small honest additions to the harness's shared
    `FakeElement` typedef (`checked?: boolean`, `onfocus?: () => void`) mirroring its
    existing `onclick?`/`id?` pattern for genuinely-set-later DOM properties, rather than
    casting around the gap in each consumer.
  - Real bug found during this pass: `test-inventory.mjs`'s own inventory/exception/
    fixture-provenance path constants were computed once from the real `process.cwd()`
    at module load, ignoring the `root` parameter every function accepted -- so every
    fake-root negative self-test was silently validating against the _real_ repo's
    files instead of the fake one (11 of 14 self-tests were passing for the wrong
    reason). Fixed by converting `INVENTORY_PATH`/`EXCEPTION_BASELINE_PATH`/
    `PLANNED_FIXTURES_PATH` into `root`-parameterized functions; a second related bug
    (`fixtureIsReferenced` counted the planned-fixtures JSON's own provenance listing as
    "usage" of the fixture path it names) was fixed by excluding `.json` files from the
    reference scan.
  - The plan's explicit requirement -- "prove `tsconfig.tests.json`, runner discovery,
    and both inventories cannot drift" -- was initially missed (only
    `test-inventory.json` vs. discovery was checked); caught by manually re-checking the
    plan text after the first green run, then added `diffTsconfigTestsInventory()` plus
    two more negative self-tests before considering 5B done.
  - Replaced `typecheck:migration-tests`/`typecheck-migration-tests.mjs`/
    `tsconfig.migration-tests.json` with `typecheck:tests`/`test-inventory.mjs`/
    `tsconfig.tests.json` in this same change (deleted the migration files, no commit
    exists with both old and new owners active). Added `typecheck` (interim value
    `typecheck:source && typecheck:tests`; the plan's final graph also includes
    `typecheck:python`, not yet a named script -- documented as an explicit interim
    value in `command-graph.json`, matching the existing `check:core`/`check:all`
    interim-value convention) and formalized `test:python`
    (`pytest tests/ --tb=short`) plus `test:split` (`test:python && test:node`) as named
    scripts for the first time. Removed `typecheck:tests`/`typecheck`/`test:split` from
    `command-graph.json`'s `notYetActivatedLeaves`.
- **5C (block focused/disabled tests):** Added `tools/check-test-focus.mjs` (real
  `acorn`-AST scan --the same parser Phase 2A's complexity scanner uses -- of every
  `discoverExecutableTestHelpers()` file for `.only(`/`.skip(`/`.todo(` member calls
  whose first argument is a string literal, Jasmine-style bare aliases
  `fdescribe`/`fit`/`xdescribe`/`xit`/`xtest`, and `node:test`'s
  `{ only/skip/todo: true }` options-object form; a leading shebang is blanked to a
  same-length `//` comment in memory before parsing so line numbers stay accurate) and
  `tools/check-test-focus.py` (`ast`-based scan of every `tests/*.py` file for
  `@pytest.mark.skip`/`skipif`/`xfail`, `@unittest.skip`/`skipIf`/`skipUnless`/
  `expectedFailure` decorators, and `self.skipTest(...)`/`pytest.skip(...)`/
  `pytest.xfail(...)` calls). Real AST parsing means string/comment content can never
  false-positive (proven by dedicated negative tests, not just asserted). Added
  `tests/js/test-focus.test.mjs` (12 cases) and `tests/test_test_focus_checker.py` (12
  cases), each covering every marker shape plus a string/comment false-positive proof
  and an unparseable-input fail-closed proof. Wired
  `"test:focus:check": "node tools/check-test-focus.mjs && ...python tools/check-test-focus.py"`
  into `check:migration` and removed it from `command-graph.json`'s
  `notYetActivatedLeaves`. Added "Focused JS test"/"Focused Python test" rows to
  `documentation/conventions/smell-prevention.md`'s Test and coverage rules table and
  `REQUIRED_SMELL_RULES` in the same change (`check-smell-catalog.mjs` fails on an
  undocumented-but-required rule name, so both had to land together). The verified
  initial exception set for both checkers is empty.
- **5D (documentation sync):** Updated `documentation/conventions/quality-gates.md`
  (new `typecheck:tests`/`typecheck`/`test:python`/`test:split`/`test:focus:check` rows
  in the migration-phase gate table; `test:tools`/`test:plugin`/`test:viewer`
  descriptions now say `node:test`), `documentation/conventions/testing-infrastructure.md`
  (new bullets documenting the `node:test` migration, the `--test-concurrency=1`
  same-tree-mutation race and its fix, `test-inventory.mjs`'s full contract, and
  `test:focus:check`'s two checkers), and `documentation/conventions/smell-prevention.md`
  (see 5C). Also found and fixed stale `tools/test-*.mjs` references left over from 5A
  in `AGENTS.md`/`CLAUDE.md` (byte-identical shared block), `CONTRIBUTING.md`,
  `documentation/conventions/coding-standards.md`, and `tools/viewer-harness.mjs`'s own
  header comment -- caught via a repo-wide grep sweep before considering the phase done,
  not assumed clean.
- Verification: `bash tools/check-all.sh` -- `All checks passed.` (run twice more after
  the 5D doc fixes); `npm run check:migration` -- fully green, including the new
  `typecheck` (`typecheck:source && typecheck:tests`) and `test:focus:check` leaves;
  `npm run test:split` (pytest 335 passed + full `test:node`) green; `node --test
--test-concurrency=1 tests/js/*.test.mjs` -- 96+ tests, 0 failures; `npm run check:docs`
  green (88 required smell rules, 0 failures).
- Deviations: (1) `typecheck:python` and a literal `typecheck:source + typecheck:tests +
typecheck:python` composition are not yet real -- `typecheck` is documented as an
  explicit interim value, matching the plan's own `check:core`/`check:all` interim-value
  precedent, not a silent scope cut; (2) the plan's exit-condition list names
  `npm run docs:check`, which is still not a package.json script (same Phase 4/8E
  naming-rename deferral already recorded) -- ran `npm run check:docs` instead.

### 4A-4D. Establish strict no-emit JavaScript source typing

- Start/Finish: 2026-07-24 (same session, continuing directly from Phase 3)
- Scope: add JSDoc types to every shipped `viewer/*.js` file plus `plugin.js`/
  `plugin.mjs`, enroll each in `tsconfig.checkjs.json`'s strict `checkJs` inventory
  (`node_modules/.bin/tsc --noEmit -p tsconfig.checkjs.json` exits 0 with zero errors
  across the full shipped source set), replacing the loose Phase 2A
  `Polarrecorder: any` ambient reliance file by file; then make source typing fail
  closed (Phase 4C) and sync documentation (Phase 4D).
- Verified clean `tsc --noEmit` after every addition, `npm run
test:viewer`/`check-viewer-contracts`/`check-js-coverage`/`check-dependencies`/jscpd
  green after each, `run-format.mjs --write` clean after each:
  - Family 1 (Phase 2A, already typed before this ledger gap): `placeholders.js`,
    `dom.js`, `theme.js`, `presets.js`, `status-ui.js`.
  - Family 2: `grid-editor.js` -- fixed a genuine nullable-DOM contract gap
    (`token()`'s two `render(wrap.closest(".grid-editor"), state)` calls) by threading
    `host` through explicitly instead of adding a null-guard, per the plan's
    producer/consumer-contract-fix guidance.
  - Family 3: `import-upload.js`, `enhanced-settings.js`, `advanced-settings.js`.
    Added `Polarrecorder.Dom.RequireById(id)` (fail-loud, non-null) to `dom.js` to
    replace ad hoc `document.getElementById` call sites whose null case can only be a
    missing-fixture bug, not a real runtime possibility; used it and an
    eager-placeholder-element initialization (real detached `HTMLElement`s instead of
    `null`) to keep `EnhancedState`/`AdvancedState`'s `body`/`messageNode` fields
    non-nullable.
  - Family 4: `polar-chart.js`, `timeline-chart.js`. Restructured `addCurve`'s point
    construction to build the full `ChartPoint` object literal in one shot instead of
    mutating a partially-built object after `mapPoint()` returned it (a real
    strict-typing-incompatible pattern, not a cosmetic change).
  - Family 5: `export-ui.js`, `settings-ui.js`.
  - File-size fallout from the family 4/5 typing pass: `polar-chart.js` (537
    non-empty lines) and `export-ui.js` (456, later 392) both breached the repo's
    400-line hard limit and/or their `tools/quality-policy/hotspot-budgets.json`
    ratchets (`polar-chart.js`: 393; `export-ui.js`: 369) purely from added JSDoc, so
    each was split in this same phase per `CLAUDE.md` Section 0 (a plan phase cannot
    defer past a mechanically enforced repo rule):
    - `viewer/polar-chart-geometry.js` (new) now owns the SVG grid/curve drawing math
      (`SvgNode`, `AddGrid`, `AddCurve`, `BandColor`); `polar-chart.js` calls into it
      and dropped to 292 lines.
    - `viewer/export-fields.js` (new) now owns the stateless Export-tab field
      builders (`Section`, `Header`, `Field`, `ConfidenceField`, `PercentileHelp`).
    - `viewer/export-presets.js` (new) now owns the selected-preset name and the
      TWA/TWS `GridEditor` instances (`Configure`, `All`, `Sorted`, `Selected`,
      `SetSelected`, `SelectedPreset`, `Editors`, `LoadSelected`, `IsValid`);
      `export-ui.js` dropped to 320 lines (budget 369).
    - Every downstream fixture/checker that hardcodes the viewer script/module list
      was updated in the same change: `viewer/viewer.html` script order,
      `tsconfig.checkjs.json` include list, `tools/check-viewer-contracts.mjs`,
      `tools/check-smell-contracts.mjs` (`expected` script order --
      `viewer-script-contract` and `viewer-dependency-header-contract`),
      `tools/check-js-coverage.mjs` (`COVERAGE_TARGETS`), `tools/test-js-checkers.mjs`
      (`smellContractsWorkspace()`), `tools/test-viewer-smoke.mjs`,
      `tools/test-viewer-enhanced.mjs`, `tools/test-viewer-advanced.mjs`, and
      `tools/test-viewer-polar.mjs`'s vm harness (needed `polar-chart-geometry.js`
      loaded before `polar-chart.js`). `documentation/architecture/ui.md` updated to
      document all four new modules.
  - Verification after the full split: `tsc --noEmit -p tsconfig.checkjs.json` exit 0;
    `bash tools/check-all.sh` -- full green (`All checks passed.`), including
    `check:js-coverage` (all 17 viewer files at/above their floors),
    `check:js-duplication` (0 clones), `check:filesize` (0 failures, budgets
    respected), `check:smells` (`check:patterns` + `check-smell-contracts.mjs`, 0
    failures), `check:deps` (0 circular-namespace failures).
  - Family 6: `viewer.js` -- typed cleanly on the first `tsc` pass after adding
    `Polarrecorder.Dom.RequireById(id)` calls (via a `byId()` local wrapper) in place
    of raw `document.getElementById` for the static, always-present tab/panel/chart
    elements; kept the `Depends: none` header (the dependency-header checker
    special-cases `viewer.js`'s orchestration-shell references, matching prior
    convention). `plugin.js`/`plugin.mjs` were already trivially typed (a no-op stub
    and a documented `@returns {Promise<undefined>}` respectively); both added to
    `tsconfig.checkjs.json`'s include list and confirmed clean. `tsc --noEmit`, full
    `bash tools/check-all.sh`, `npm run test:viewer`/`test:plugin` all green.
- **4C (make source typing fail closed):** Added
  `tools/quality-policy/typecheck-source.mjs`, the permanent owner: verifies the live
  shipped-source inventory (`plugin.js`, `plugin.mjs`, every `viewer/*.js`) exactly
  matches `tsconfig.checkjs.json`'s `include` list (catching both a new file omitted
  from the inventory and a stale/removed entry left behind), then runs
  `tsc --noEmit -p tsconfig.checkjs.json` over the whole set. Added
  `tools/test-typecheck-source.mjs` with the plan's 5 required negative contract
  fixtures, each proven to fail on the bad shape and pass on the clean shape via
  isolated temp-workspace `tsc` invocations: (1) inventory-diff fake-root tests for a
  file missing from/stale in the inventory; (2) a misspelled method call against a
  precisely JSDoc-typed local object (`Namespace.Cler` vs `Namespace.Clear`); (3) an
  unnarrowed nullable `document.getElementById(...).textContent = ...` vs the
  null-checked form; (4) a two-file ESM `import { missingExport }` vs a real export;
  (5) an object literal with a field of the wrong type (`stw: "5"` vs `stw: 5`)
  passed to a JSDoc-typed function. In the same change: added `"typecheck:source"` to
  `package.json`, wired it into `check:migration` (replacing
  `typecheck:migration-source`), added `tools/test-typecheck-source.mjs` to
  `test:tools`, deleted `tools/quality-policy/typecheck-migration-source.mjs`,
  `tools/test-typecheck-migration-source.mjs`, and `tsconfig.migration-source.json`,
  and removed `"typecheck:source"` from
  `tools/quality-policy/command-graph.json`'s `notYetActivatedLeaves` (its
  `test-setup.mjs` self-test asserts every not-yet-activated leaf is absent from
  `package.json`'s scripts, so leaving it listed after activating the script would
  have failed that self-test). No commit exists in this history where the Phase 2
  new-source inventory loses strict ownership. One real finding surfaced by
  `check:complexity:migration` (a temporary Phase-3 checker requiring strict
  10/40/4/6 complexity/statements/nesting/params limits on any new/moved function):
  `polar-chart-geometry.js#addCurve` had 8 parameters after the Phase 4B split (moved,
  so held to the strict limit unconditionally, not grandfathered). Fixed by
  bundling `band`/`index`/`count` into one `BandInfo` typedef parameter, dropping it
  to 6 parameters (at the limit); re-verified `tsc`, `check:migration`, and
  `check:all` all green after the fix.
- **4D (documentation sync):** Updated `documentation/conventions/coding-standards.md`
  (new JavaScript-standards bullet describing `tsconfig.checkjs.json`, `typecheck:source`,
  `RequireById`'s fail-loud contract, and the "fix the contract, not the checker" rule),
  `documentation/conventions/quality-gates.md` (new "Migration-phase gate (temporary)"
  table listing `typecheck:source` and `check:migration` until Phase 8E promotes the
  final `check:core`), `documentation/conventions/testing-infrastructure.md` (new
  bullet documenting `typecheck-source.mjs` and its 5 negative fixtures), and
  `documentation/architecture/ui.md` (new bullet documenting the strict-typing
  status, the interim loose `Polarrecorder: any` ambient contract, and
  `RequireById`), without claiming the Phase 5 test inventory is active.
- Final verification: `npm run typecheck:source`, `npm run format:check`,
  `npm run test:viewer`, `npm run test:plugin`, `npm run check:filesize`,
  `npm run check:docs` (the plan's `docs:check` is not yet the active script name --
  `check:docs` is the current equivalent; the plan's final command graph renames it
  at Phase 8E per `tools/quality-policy/command-graph.json`), and `npm run
check:migration` all exit 0; `bash tools/check-all.sh` -- `All checks passed.`
- Deviations: (1) the plan's Phase 4 exit-condition list names `npm run docs:check`,
  which is not a package.json script yet -- ran the equivalent `npm run check:docs`
  instead (the rename to `docs:check` is Phase 8E's literal-graph promotion, not a
  Phase 4 concern); (2) two files split mid-phase
  (`polar-chart.js` -> `+polar-chart-geometry.js`, `export-ui.js` ->
  `+export-fields.js` `+export-presets.js`) purely from JSDoc-comment line growth
  breaching the 400-line hard limit and/or `hotspot-budgets.json` ratchets --
  required by `CLAUDE.md` Section 0 (a phase cannot defer past a mechanically
  enforced repo rule), not a plan amendment.

### 3A-3D. Move generic custom checks to maintained tools

- Start/Finish: 2026-07-24 (same session, continuing directly from Phase 2)
- 3A: Retired the 9 maintainedTool-owned rules from `tools/check-patterns.mjs`/`PATTERN_RULE_IDS`
  (`console-log`, `var-declaration`, `eval-call`, `bare-isfinite`, `loose-equality`,
  `es-module-syntax`, `empty-catch`, `dead-code`, `viewer-suppression-comment`; 32 -> 23
  pattern rule IDs), after proving real ESLint parity for every one first (not just
  trusting the Phase 0 mapping): added `no-unused-vars` (`args: "none"`,
  `caughtErrors: "all"`, `caughtErrorsIgnorePattern: "^_"` -- matching this codebase's
  existing `_err`/`_error` intentional-discard convention) and `no-warning-comments`
  (catching `eslint-disable`/`ts-ignore`/`ts-nocheck`/`ts-expect-error`/`prettier-ignore`/
  `istanbul ignore`) plus `linterOptions.noInlineConfig: true` to `eslint.config.mjs`;
  confirmed via direct probes that ES-module syntax under `sourceType: "script"` is a
  hard parse error (stronger than the old regex check) and that `no-unused-vars`
  correctly treats `Polarrecorder.X = { name: fn }` object-literal exports as "used".
  Split the ESLint config's module-mode group in two: `plugin.mjs` now shares the
  shipped-runtime rule set (including `no-console`) with `viewer/*.js`/`plugin.js`,
  separate from `tools/**/*.mjs`/`tests/js/**/*.mjs`/`*.config.mjs` (dev CLI tooling,
  where `no-console` is intentionally off) -- the original single "module-mode" group
  would have wrongly let `plugin.mjs` (shipped code) use `console.log`.
  Found and fixed one genuinely dead `CAPTURE_PATH` constant in
  `typecheck-migration-tests.mjs` that `no-unused-vars` caught. Removed the now-dead
  `checkEmptyCatch` function and `allowEsModuleSyntax` file metadata (no longer read
  anywhere). Added `tools/test-eslint-config.mjs` (4 cases: multi-violation fixture
  catches all 7 still-checkable rules at once, a clean fixture passes, `plugin.js`
  rejects ES-module syntax via parse error, `plugin.mjs` allows ES-module syntax but not
  `console.log`) as the negative/clean ESLint proof PLAN5 requires before a rule's
  custom-checker ownership is removed. Rewrote `test-check-patterns.mjs`'s
  `testPluginEntrypointsAreScannedWithModuleException` (which only tested the two
  removed rules) into `testPluginEntrypointsAreScanned`, proving check-patterns.mjs
  still visits both entrypoints for its _retained_ rules. Updated
  `documentation/conventions/smell-prevention.md`'s 9 affected rows' Enforcement column
  to name ESLint (not the frozen Phase 0 ledger, which stays byte-immutable evidence of
  the original plan, not living documentation -- the actual mechanism chosen,
  `no-warning-comments` + `noInlineConfig`, refines Phase 0's initial
  `no-restricted-syntax` guess, recorded here rather than silently reconciled).
- 3B: Markdown/link ownership already moved to markdownlint-cli2/Linkinator in Phase 2C;
  this phase only added a forward-reference note to
  `documentation/conventions/quality-gates.md` (already-live commands not yet in its
  tables: `setup`, `format`/`format:check`, `lint`, `duplication:check`, `check:standard`,
  `test:node`, `check:hotspots`, `actions:lint`) rather than a full rewrite, since PLAN5
  Phase 8 owns the final consolidated command/hook/release documentation and a partial
  rewrite now would itself go stale by then.
- 3C: No new work required -- `duplication:python` (`check-duplication.py`) and the
  Python contract/dependency checkers were already preserved untouched, and
  `duplication:js`/`duplication:python`/`duplication:check` were already activated in
  Phase 2C with the exact required aggregation (no second Python duplication path
  through `check:python-contracts`, which does not exist yet -- Phase 3 proper).
- 3D: Added `test:contract` (`check:headers && check:namespace && check:naming &&
check:smells && check:deps && check:viewer-contracts && check:hotspots`) and
  `test:node` (`test:tools && test:contract && test:viewer && test:plugin`); removed
  `test:node` from `command-graph.json`'s `notYetActivatedLeaves` (its plan-recorded
  activation phase is "3/5", so Phase 3 activating it is on schedule, unlike a leaf
  whose recorded phase is still in the future).
- Verification: `node tools/check-patterns.mjs` (16 JS + 33 Python files, 0 findings),
  `node tools/test-check-patterns.mjs`, `node tools/test-eslint-config.mjs`,
  `node tools/check-smell-catalog.mjs` (86 required rules, 26 executable rule IDs, still
  0 failures despite the 9-rule reduction in `PATTERN_RULE_IDS`, since the catalog only
  requires every _currently executable_ ID to appear in some row -- it does not require
  every historical row to keep naming `check-patterns.mjs` specifically),
  `npm run test:node`, `npm run test:tools`, `npm run check:docs`,
  `npm run check:standard`, `npm run check:migration`, `tools/check-all.sh` (335 pytest
  passed, full green).
- Deviation: none beyond the ESLint-mechanism refinement recorded above (frozen Phase 0
  ledger left untouched; actual mechanism recorded here instead, per repo-rules-override-
  plan precedence for immutable captures).

### 2B-2D. Prettier adoption, ESLint/Stylelint/jscpd landing, hotspot budgets

- Start/Finish: 2026-07-24 (same session, continuing directly from 2A)
- 2B: installed exact-pinned eslint 10.7.0, globals 17.7.0, jscpd 5.0.12,
  linkinator 8.0.2, markdownlint-cli2 0.23.1, prettier 3.9.6, stylelint 17.14.1,
  stylelint-config-standard 40.0.0 (already added in Phase 1B). Built
  `tools/quality-policy/generate-format-scope.mjs` (`format:scope` script): discovers
  every tracked-or-untracked-not-ignored file via
  `git ls-files --cached --others --exclude-standard` (not `git ls-files` alone -- several
  genuinely maintained files, e.g. a fresh `package-lock.json`, are not yet staged
  mid-migration and would otherwise be silently missed) and classifies each as
  `prettier`/`ruff`/`unsupported` with a reason + alternate validation owner for every
  unsupported entry (238 rows: 116 prettier, 94 ruff, 28 unsupported). Built
  `tools/quality-policy/run-format.mjs` (`format`/`format:check`): both modes iterate the
  identical scope, differing only in Prettier/Ruff write vs. check flags.
- **Real finding amending the plan's implicit assumption**: `tools/quality-policy/phase0-*.json`
  files are immutable, digest-anchored, Python-generator-owned canonical captures (Phase 0);
  Prettier's own JSON style (which collapses short arrays onto one line, unlike
  `json.dumps(..., indent=2)`) silently mutated them the first time `format` ran over all
  `*.json` files, breaking `tests/test_phase0_captures.py`'s byte-identity/digest tests.
  Fixed by excluding `tools/quality-policy/phase0-*.json` from Prettier's scope (owner:
  unsupported, reason: "owned by its Python generator's `canonical_json.dumps_canonical`,
  not Prettier's JSON style") and by discovering that `phase0-coverage-capture.json`
  specifically can no longer be regenerated directly against the live tree (the Phase 0A
  `git diff --stat` equivalence it depended on broke once Phase 2A split `viewer.js`) --
  regenerated correctly via the still-live disposable worktree at `CAPTURED_COMMIT` from
  Phase 0A, reproducing byte-identical output to the original capture. Also excluded
  `tests/mock-data/*.json` and `tests/mock-data/export-windy.csv` (functional test fixtures;
  CLAUDE.md Section 10 fixture-sync discipline, not automated reformatting).
- 2C: Stylelint findings resolved (57 -> 0): auto-fixed `--fix`-eligible findings
  (color-function-notation, alpha-value-notation, `currentColor` casing,
  media-feature-range-notation, redundant longhand); renamed `--chip-color` ->
  `--polarrecorder-chip-color` in `viewer/viewer.css` and `viewer/polar-chart.js` (the
  PLAN5-named rename); renamed the enhanced-badge status classes from
  `enhanced-badge-inactive_key_missing`-style (underscore, matching the _server_ status
  enum, which stays untouched) to kebab-case CSS classes via a
  `status.replace(/_/g, "-")` conversion at the point `viewer/enhanced-settings.js` builds
  the class string, preserving the real API contract; manually reordered two
  `.card > .helper`/`.card > .value-tile` rule blocks after their base selectors to
  resolve `no-descending-specificity` (pure reorder, identical declarations, specificity
  makes the visual result position-independent); added one narrow `selector-class-pattern`
  regex exception for the literal `nightMode` class, which mirrors AvNav's own DOM class
  and is not Polar Recorder's to rename (documented in `.stylelintrc.json`).
  jscpd findings resolved (4 -> 0, scope narrowed from Phase 1's probe to exactly
  `viewer`, `plugin.js`, `plugin.mjs` -- matching `check-js-duplication.mjs`'s existing
  scope and the plan's original zero-clone framing, not `tools/`, which is dev tooling
  with its own churn): removed local `Polarrecorder.Dom.*` aliasing entirely in
  `advanced-settings.js`/`enhanced-settings.js`/`export-ui.js`/`settings-ui.js` (direct
  calls, matching the existing convention in `grid-editor.js`), and extracted a shared
  `Polarrecorder.Dom.SvgText(x, y, text, fontSize, textAnchor)` helper used by both
  `polar-chart.js` and `timeline-chart.js` in place of two near-identical local
  `svgText`/`label` functions. markdownlint findings resolved (10 -> 0): escaped literal
  `|` characters inside two documentation tables that were silently truncating columns
  (`documentation/architecture/api.md`, `documentation/conventions/smell-prevention.md`),
  fixed `MD029` ordered-list numbering in `documentation/guides/release-workflow.md` by
  indenting its code fences under their list items, converted `README.md`'s
  `**Learned Data**`/`**Presets**` bold-as-heading text to real `####` headings, merged a
  genuine duplicate `## finished` heading this ledger itself had accumulated, and added a
  narrow `exec-plans/active/.markdownlint-cli2.jsonc` override disabling `MD024` only for
  `exec-plans/active/` (PLAN5.md has a pre-existing duplicate heading in its own body that
  this migration must not edit). Linkinator findings resolved (9 -> 0): AGENTS.md/CLAUDE.md
  linked bare directories (`documentation/avnav/` etc.) with no index file; repointed the
  shared File Map block to `documentation/TABLEOFCONTENTS.md#<section-anchor>` for each,
  keeping AGENTS.md/CLAUDE.md byte-identical (`check-ai-instructions.mjs` still passes).
  Activated `lint` (`lint:js`=`eslint .`, `lint:css`=stylelint, `lint:ruff`=venv-aware
  `ruff check .`), `duplication:js` (jscpd + `check-js-duplication.mjs`),
  `duplication:python` (`check-duplication.py`, venv-aware), `duplication:check`, and
  `check:standard` (`format:check && lint && actions:lint && duplication:check`); removed
  them from `command-graph.json`'s `notYetActivatedLeaves` (renamed from
  `notYetActivatedAsOfPhase1`, since that name became inaccurate once Phase 2 legitimately
  activates leaves Phase 1 had to leave inactive).
- 2D: `tools/quality-policy/hotspot-budgets.json` (`check:hotspots` script) records
  reviewed per-file ceilings (current count + <=10, always below 400) for every
  PLAN5-named file plus every other covered file at or above 320 non-empty lines:
  `README.md` 360, `plugin.py` 379, `server/polarrecorder/api_dispatch.py` 338,
  `export.py` 395, `params.py` 343, `persistence.py` 341,
  `tests/test_plugin_integration.py` 398 (tight -- only 3 lines of headroom, since this
  file already sits at 395 and predates the migration; flagged for a future split if it
  grows further rather than split now, which would be scope creep beyond this phase),
  `viewer/export-ui.js` 369, `viewer/polar-chart.js` 393. `tools/quality-policy/check-hotspot-budgets.mjs`
  enforces them (rejects an invalid/duplicate/missing-file/over-budget entry; 4 self-tests).
- Also added the Phase 2B-required temporary `check:migration` aggregate
  (`tools/check-all.sh && check:standard && typecheck:migration-source &&
typecheck:migration-tests && check:complexity:migration && check:hotspots`); it is
  intentionally undocumented outside this ledger/PLAN5 and will be deleted in Phase 8E.
- New/changed files (beyond those named above): `tools/quality-policy/generate-format-scope.mjs`
  - `tools/test-format-scope.mjs` (5 cases), `tools/quality-policy/run-format.mjs`,
    `tools/quality-policy/hotspot-budgets.json` + `check-hotspot-budgets.mjs` +
    `tools/test-hotspot-budgets.mjs` (4 cases), `.stylelintrc.json`, `documentation/architecture/api.md`,
    `documentation/conventions/smell-prevention.md`, `documentation/guides/release-workflow.md`,
    `README.md`, `AGENTS.md`, `CLAUDE.md`, `exec-plans/active/.markdownlint-cli2.jsonc`,
    `viewer/dom.js`, `viewer/polar-chart.js`, `viewer/timeline-chart.js`,
    `viewer/advanced-settings.js`, `viewer/enhanced-settings.js`, `viewer/export-ui.js`,
    `viewer/settings-ui.js`, `viewer/viewer.css`, `package.json`.
- Verification: `npm run format:check` (94 files), `npm run lint` (ESLint+Stylelint+Ruff,
  clean), `npm run duplication:check` (0 JS/CSS clones, 0 Python duplicates),
  `npm run check:standard`, `npm run check:hotspots`, `npm run check:migration`,
  `npm run test:tools` (8 suites), `npm run test:viewer` (5 suites),
  `node tools/check-viewer-contracts.mjs`, `node tools/check-js-coverage.mjs` (all 14
  files above floor), `npm run check:docs` (AI-sync + TOC + reachability + format all
  green), `tools/check-all.sh` (335 pytest passed, full green). No file exceeds its
  hotspot budget or the global 400-line limit. Manual/mock-server smoke evidence is the
  same as recorded in 2A (deferred full visual browser confirmation to Phase 10E).
- Deviation: jscpd's scan scope was narrowed from Phase 1's initial probe (which included
  `tools/`) to exactly `viewer` + `plugin.js` + `plugin.mjs`, matching
  `check-js-duplication.mjs`'s existing scope and PLAN5's original zero-clone framing;
  recorded here rather than silently changed.

### 2A. Split the oversized viewer owner

- Start/Finish: 2026-07-24 (same session)
- Scope: split `viewer/viewer.js` (393 non-empty lines) into the shell (`viewer.js`,
  237 lines) and a new `viewer/status-ui.js` (177 lines) owning recent-decision
  derivation, status cards (state/values/counters/persistence), decision-strip coloring,
  and status-local duration/last-flush text, per PLAN5's exact extraction list. Added the
  Phase 2A-required `typecheck:migration-source` and `check:complexity:migration`
  temporary owners _before_ materializing the new file, as the plan requires.
- Design decisions:
  - `StatusUI.Render(host, data, {runAction, fetchStatus})` and
    `StatusUI.AppendRecentDecision(data)` are the only two exports; `viewer.js` passes
    its own `runAction`/`fetchStatus` in as callbacks instead of status-ui.js reaching
    back into the shell (matches "pass callbacks/data through a small explicit namespace
    API").
  - `Polarrecorder.RecentDecisions` ownership moved from `viewer.js` to `status-ui.js`
    (only status-ui.js ever read/wrote it) -- discovered necessary when
    `check-dependencies.mjs` caught a genuine circular reference
    (`status-ui.js -> viewer.js -> status-ui.js` via `Polarrecorder.ShowTooltip` and
    `Polarrecorder.RecentDecisions`).
  - `Polarrecorder.ShowTooltip` moved from `viewer.js` into `viewer/dom.js` as
    `Polarrecorder.Dom.ShowTooltip` (a lower layer both `status-ui.js` and `viewer.js`
    can depend on without a cycle; `polar-chart.js` and `timeline-chart.js` also called
    it and were updated, and `polar-chart.js`'s now-unnecessary `viewer.js` `Depends`
    entry was removed since `ShowTooltip` was its only reference to that file).
  - `renderDecisionStrip`'s anonymous per-decision callback was extracted into a named
    `decisionCell(decision)` function while adding strict types (a real, in-scope
    simplification, not scope creep, since the line was already being touched for typing).
- **Real, unanticipated finding**: TypeScript 7.0.2 (the version Phase 0 selected,
  matching Verified Baseline note 16) no longer exposes the classic in-process Compiler
  API (`ts.createSourceFile`, `ts.SyntaxKind`, etc.) via `import "typescript"` --
  `node_modules/typescript/package.json`'s `exports` map only provides `./lib/version.cjs`
  as the default entry, plus new `./unstable/ast`/`./unstable/sync` etc. entries for the
  native rewrite. This does **not** affect the CLI-based `tsc --noEmit -p <tsconfig>`
  workflow (`typecheck-migration-tests.mjs`/`typecheck-migration-source.mjs` and all of
  Phase 4/5's planned `typecheck:*` commands), which already shells out to the `tsc`
  binary rather than importing the package. It **does** mean PLAN5's own custom
  complexity scanner (`check:complexity:migration`, and eventually Phase 7's stable-owner)
  cannot be built on the TypeScript Compiler API as an implementation detail. Resolved by
  building `tools/quality-policy/complexity-scan-lib.mjs` on `acorn` 8.17.0 (a small,
  dependency-free parser, added as an exact-pinned devDependency) instead. This is an
  amendment to PLAN5's implicit tool-selection assumption for the complexity scanner
  only; TypeScript 7.0.2 remains the correct pin for every `typecheck:*` command.
- New artifacts: `viewer/status-ui.js`; `types/polarrecorder-globals.d.ts` (loose
  `Polarrecorder: any` ambient declaration -- intentionally minimal per Phase 2A, Phase 4A
  replaces its content with precise per-module typing, not a new file);
  `tsconfig.migration-source.json`; `tools/quality-policy/typecheck-migration-source.mjs`
  - `tools/test-typecheck-migration-source.mjs` (4 cases);
    `tools/quality-policy/complexity-scan-lib.mjs`;
    `tools/quality-policy/check-complexity-migration.mjs` +
    `tools/test-complexity-migration.mjs` (6 cases: clean repeat, new file over limit, new
    function in existing file, grandfathered function may not grow, may shrink, moved
    function loses grandfathered status). New npm scripts: `typecheck:migration-source`,
    `check:complexity:migration` (both wired into `test:tools` self-tests).
- Changed existing files: `viewer/viewer.js`, `viewer/dom.js`, `viewer/polar-chart.js`,
  `viewer/timeline-chart.js`, `viewer/viewer.html` (script order), `tools/check-smell-contracts.mjs`
  (expected script order + `status-ui.js`), `tools/check-js-coverage.mjs`
  (`viewer/status-ui.js: 80` floor), `tools/check-viewer-contracts.mjs`,
  `tools/test-viewer-smoke.mjs`, `tools/test-viewer-advanced.mjs`,
  `tools/test-viewer-enhanced.mjs`, `tools/test-js-checkers.mjs` (synthetic script-order
  fixture), `documentation/architecture/ui.md`.
- Verification: `npm run test:viewer` (5 suites), `node tools/check-viewer-contracts.mjs`,
  `node tools/check-headers.mjs`/`check-namespace.mjs`/`check-naming.mjs`/`check-dependencies.mjs`/
  `check-smell-contracts.mjs`, `node tools/check-js-coverage.mjs` (status-ui.js 89.8-92.8%
  against an 80% floor; every other file still above its floor; `viewer.js` 84.3% against
  its 45% floor), `node tools/quality-policy/typecheck-migration-source.mjs`,
  `node tools/quality-policy/check-complexity-migration.mjs`, `tools/check-all.sh` (335
  pytest passed, full green). Mock-server smoke: started `tools/mock-server.py`, curled
  `viewer/viewer.html` (confirms the exact new script order is served) and `/api/status`
  (confirms a realistic `recording`/`current_decision`/`counters`/`persistence` payload
  reaches the client); combined with `test-viewer-smoke.mjs`'s real end-to-end assertions
  (clicking the Status tab and asserting `textTree(...).includes("Recording")` and the
  `has-data` class) this is strong automated proof of behavior preservation, but full
  **visual browser confirmation was not performed in this headless environment** --
  deferred to Phase 10E's explicit manual AvNav/browser smoke, as the plan structures it.
- Deviation: none beyond the acorn/TypeScript-7 tool-selection amendment above, recorded
  transparently per repo-rules-override-plan precedence.

### 1A-1E. Reproducible setup, maintained-tool skeletons, command-graph contract, tests, docs

- Start/Finish: 2026-07-24 (same session)
- Scope: full Phase 1 (all subphases landed together in this session).
- 1A: `package.json` identity (`polarrecorder-dev-tooling`, `0.0.0-test`, `private`,
  Node `>=26 <27`, npm `12.0.1` engines + `packageManager`), `.nvmrc` (`26`),
  `tools/quality-policy/developer-python.json` (machine-readable form of the Phase 0
  decision), reviewable `requirements-dev.in` and hash-locked `requirements-dev.txt`
  (439 lines; Ruff 0.16.0, mypy 2.3.0, pytest 9.1.1, pytest-cov 7.1.0, coverage 7.15.2,
  Hypothesis 6.161.2, pip-tools 7.6.0, plus transitive/unsafe pins for pip 26.1.2 and
  setuptools 83.0.0 via `--allow-unsafe`), `tools/setup.mjs` (npm ci + venv
  create/upgrade-pip/`--require-hashes` install against the frozen contract, fails on
  interpreter-version mismatch), `tools/actionlint.sh` (checksum-verified
  actionlint 1.7.12 provisioning into `~/.cache/polarrecorder/actionlint`, rejects an
  in-repo `ACTIONLINT_CACHE_DIR`, `--install`-only network use), `.gitignore` additions
  (`venv/`, `.hypothesis/`, `coverage/`) — `venv/` was previously only ignored via the
  untracked, machine-local `.git/info/exclude`, not the committed `.gitignore`.
- 1B: added (not yet gate-activated) `eslint.config.mjs`, `.prettierrc.json` +
  `.prettierignore`, `.stylelintrc.json` (`stylelint-config-standard` +
  `custom-property-pattern: ^polarrecorder-[a-z0-9-]+$`) + `.stylelintignore`,
  `.markdownlint-cli2.jsonc`, `linkinator.config.json`, `jscpd.config.json`. Installed
  exact devDependency pins: eslint 10.7.0, globals 17.7.0, jscpd 5.0.12,
  linkinator 8.0.2, markdownlint-cli2 0.23.1, prettier 3.9.6, stylelint 17.14.1,
  stylelint-config-standard 40.0.0, typescript 7.0.2, @types/node 22.20.1.
- 1C: `tools/quality-policy/command-graph.json` records PLAN5's literal final command
  graph and which phase activates each leaf; `tools/test-setup.mjs` asserts none of the
  not-yet-activated leaves (`format`, `format:check`, `lint`, `duplication:*`,
  `check:standard`, `typecheck:*`, `test:node`, `test:split`, `test:focus:check`,
  `check:python-contracts`, `package:check`, `check:fast`, `check:complexity`,
  `check:scaling`, `test:coverage:check`, `check:strict`) exist in `package.json` yet,
  and that `check:ci`/`schema:check`/`.pre-commit-config.yaml` are absent.
- 1D: `tools/test-setup.mjs` (11 cases: package identity/exact-pin/engine assertions,
  developer-Python contract shape, no hook-install side effect in `setup.mjs`,
  actionlint missing-cache failure with repair guidance, in-repo-cache-dir rejection,
  cached offline success, `.gitignore` coverage, no stray untracked generated state,
  command-graph non-premature-activation, no `check:ci`/`schema:check`/pre-commit).
  Wired into `test:tools`.
- 1E: `CONTRIBUTING.md`'s "Local development setup" section rewritten for `npm run
setup`, the frozen developer-Python contract, the maintainer-only
  `npm run requirements:lock` exception, and unchanged hook-install/`POLARRECORDER_VENV`
  guidance. README's existing developer pointer was already generic/accurate; left as-is.
- **Real adoption-debt evidence gathered (Phase 0D/1's own re-probe), several of which
  amend PLAN5's Verified Baseline diagnostics 22-24 rather than merely reproducing them**:
  - ESLint 10.7.0 against `viewer/*.js` + `plugin.js`/`plugin.mjs` + `tools/**/*.mjs`:
    **zero findings already** (console/var/eqeqeq/eval/empty-block rules already held).
  - Stylelint 17.14.1 + `stylelint-config-standard` 40.0.0 against `plugin.css` +
    `viewer/viewer.css`: **57 findings**, not baseline note 24's 5 — `stylelint-config-standard`
    enables far more rules (color-function-notation, alpha-value-notation,
    selector-class-pattern, value-keyword-case, no-descending-specificity,
    media-feature-range-notation, declaration-block-no-redundant-longhand-properties)
    than whatever narrower probe config produced the original 5-finding diagnostic. The
    `--chip-color` -> `--polarrecorder-chip-color` rename PLAN5 names is confirmed still
    needed (2 occurrences). Real Phase 2C/3 remediation work, not fixed in Phase 1.
  - markdownlint-cli2 0.23.1 with `default: true`: real findings across `README.md`,
    `documentation/user/configuration.md` (MD060 compact-table-pipe style), and
    `exec-plans/active/PLAN5.md` itself (MD024 duplicate heading "Hooks, release, and
    GitHub", appearing once in Hard Constraints and once as the Phase 8 title -- left
    untouched; `exec-plans/` prose is the plan's own content, not this migration's to
    edit). Phase 3B must resolve or exempt these before activating `lint`'s Markdown leg.
  - Linkinator 8.0.2: 9 broken-link findings, all directory-only links in
    `AGENTS.md`/`CLAUDE.md` (`documentation/avnav/`, `documentation/architecture/`,
    `documentation/filters/`, `documentation/guides/` have no index file) — a genuine
    gap the current custom link checker's fragment-blind design does not catch. Real
    Phase 3B work.
  - jscpd 5.0.12 over `viewer/*.js` + `plugin.js` + `plugin.mjs` (`--min-lines 5
--min-tokens 50`, matching the plan's described scope): **4 clones found**, not
    baseline note 24's zero. Two are near-duplicate module-header/setup boilerplate
    (`advanced-settings.js`/`export-ui.js`, `advanced-settings.js`/`settings-ui.js`) and
    one is near-duplicate render math (`polar-chart.js`/`timeline-chart.js`). This
    directly amends PLAN5's "jscpd begins with zero accepted clones" Phase 0D assertion;
    recorded here as evidence per repo-rules-override-plan precedence. Phase 2C must
    either extract shared helpers to reach a real zero or document why an occurrence is
    irreducible before jscpd becomes blocking.
  - Ruff (`tools/` exclusion lifted for the probe only): 317 lint findings across the 18
    maintained tool Python files, 12/18 files need `ruff format`. Recorded already under
    0D; reconfirmed unchanged here.
  - None of the above are fixed in Phase 1 (config skeletons only, consistent with "must
    not publish a failing `format`/`lint`/`check:standard` command merely to claim the
    final graph early"); they are Phase 2/3's explicit remediation scope.
- Verification commands (all exit 0): `npm run setup` (full clean run: `npm ci` +
  venv create + hash-required install + actionlint install), `npm run actions:lint`
  (twice; second run repeated inside `unshare --net` with only loopback up, proving
  zero network use once cached), `npm run test:tools`, `npm run typecheck:migration-tests`,
  `npm run check:docs`, `npm run check:filesize`, `tools/check-all.sh` (335 pytest
  passed), `git diff --check`. A fresh isolated venv
  (`python -m pip install --require-hashes -r requirements-dev.txt`) reproduces
  `mypy --strict` clean (76 files) and `pytest` 335 passed, proving the lock is real and
  reproducible, not just internally consistent.
- Changed/added files: `package.json`, `package-lock.json`, `.gitignore`,
  `CONTRIBUTING.md`, `.nvmrc`, `tools/quality-policy/developer-python.json`,
  `tools/quality-policy/command-graph.json`, `requirements-dev.in`,
  `requirements-dev.txt`, `tools/setup.mjs`, `tools/actionlint.sh`, `tools/test-setup.mjs`,
  `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `.stylelintrc.json`,
  `.stylelintignore`, `.markdownlint-cli2.jsonc`, `linkinator.config.json`,
  `jscpd.config.json`.
- Deviation from literal plan text: Phase 1B's config files exist and load, but are
  intentionally not yet enforcing zero-findings (that's Phase 2C/3B's job); this matches
  Phase 1C's explicit instruction not to publish a prematurely-failing gate command.

### 0A. Record a complete clean baseline

- Start: 2026-07-24T00:00Z — Finish: 2026-07-24 (same session)
- Scope: disposable detached worktree at `08edef88b0102af6507ef02fd4448f7fd1eaca45`
  (tag `v1.0.0-beta.7`), isolated venv, exact tool-version probing, full old-gate run,
  developer-Python contract decision.
- Environment: Node v26.4.0 / npm 12.0.1 already present (matches target contract).
  Network egress available. System package manager is `pacman` (CachyOS/Arch); only
  `python 3.14.6-2` is packaged (no pyenv/uv, no 3.9-3.13 package). Probe venv: Python
  3.14.6, pip 26.1.2, ruff 0.16.0, mypy 2.3.0, pytest 9.1.1, coverage 7.15.2.
- Finding: `mypy --strict` on Python 3.14.6 with mypy 2.3.0 succeeds with **no internal
  error** ("Success: no issues found in 75 source files"), superseding PLAN5 Verified
  Baseline note 11's mypy-2.1.0-era internal error.
- Decision: developer Python = system `python3` (3.14.6), narrow supported range
  `>=3.14,<3.15` (only version realistically available in this sandbox; a future clone
  with a different Python must widen this with evidence). Recorded in
  `tools/quality-policy/phase0-baseline.json`'s `developerPythonContract`.
- **Defect found and fixed before migration** (PLAN5's sanctioned "classify and fix an
  existing repository defect" clause): `ruff format --check .` at the captured commit
  wants to reformat `exec-plans/completed/PLAN1.md` because Ruff's default
  `file_resolver.include` now contains `"*.md"` and formats embedded Python fenced code
  blocks. Reproduced across ruff 0.9.10 through 0.16.0 (every readily installable
  version) — not a narrow version-pin escape. Fix: added `"*.md"` to `[tool.ruff]
extend-exclude` in `pyproject.toml` (Markdown is Prettier's domain under PLAN5's
  target model, not Ruff's). Verified clean before/after in both the capture worktree
  and the main worktree.
- Evidence: with the fix, `tools/check-all.sh` exits 0 in the capture worktree: 320
  pytest passed, Python package coverage 95.97% (floor 90%), plugin.py 94.32% combined
  line+branch (measured separately via `--cov=plugin`), validation package 99.12%
  line / 98.33% branch (floor 95/95), histogram 96.00% line / 90.00% branch (floor
  95/90), all 13 viewer files above their configured floors, 54 runtime files in the
  release dry-run, full `check:js:all` green (15 JS pattern files, 33 Python pattern
  files, 27 documentation files, 30/30 reachable Markdown files, 13 viewer modules).
  `git diff --stat 08edef8..HEAD -- server/polarrecorder tests plugin.py viewer
plugin.js plugin.mjs tools` is empty, so the frozen commit and the live pre-migration
  tree are byte-identical for every coverage/complexity-relevant path.
- Changed files: `pyproject.toml` (defect fix).

### 0B. Create immutable canonical captures before active ledgers

- Start/Finish: 2026-07-24 (same session as 0A)
- Scope: canonical, byte-stable, digest-anchored JSON captures plus their generators and
  independent pytest proofs; `tsconfig.migration-tests.json` +
  `typecheck:migration-tests` per Phase 0B's required ordering.
- Changed files:
  - `tools/quality-policy/canonical_json.py` (shared canonicalization/git-blob helpers).
  - `tools/quality-policy/generate_phase0_baseline.py` ->
    `phase0-baseline.json` (capturedCommit, tool versions, developer-Python contract,
    old command graph, existing thresholds, the known-defect record, production/test/JS
    tool-file inventories with Git blob SHA-1s).
  - `tools/quality-policy/generate_phase0_test_capture.py` -> `phase0-test-capture.json`
    (9 JS executable test/helper files including `tools/viewer-harness.mjs`, 38 Python
    test files, 3 Python test-support helpers, verified-empty focused/disabled-test
    marker search in both languages, empty `executableTestExceptionSet`).
  - `tools/quality-policy/generate_phase0_coverage_capture.py` ->
    `phase0-coverage-capture.json` (measured, regenerable by re-running pytest/c8 against
    the current tree, proven byte-identical to the captured commit via the empty
    `git diff --stat` above; Python package 95.97%, plugin.py 94.32%, all 13 viewer
    per-file line percentages, every pre-migration floor).
  - `tools/quality-policy/generate_phase0_complexity_source_capture.py` ->
    `phase0-complexity-source-capture.json` (15 shipped JS files, Git blob SHA-1 + content
    SHA-256 each, intended 10/40/4/6 limits, deliberately no scanner-dependent findings).
  - `tools/quality-policy/phase0-planned-quality-fixtures.json` (reviewer-authored, empty
    `plannedFixtures` array — valid per Phase 0B; no fixture is needed yet).
  - `tools/quality-policy/generate_phase0_rule_parity_ledger.py` ->
    `phase0-rule-parity-ledger.json` (Phase 0C, see below).
  - `tests/test_phase0_captures.py` (16 pytest cases: independent SHA-256 digest anchors
    for every capture file, byte-identical regeneration proofs, canonical-JSON
    key/list-reordering stability, no-volatile-metadata scan, captured-commit pinning,
    empty exception/focus-marker assertions, empty-fixture-manifest validity, a live
    `git ls-tree` cross-check, and the rule-parity ledger's coverage/removal-count
    invariants). All pass; `ruff check`/`ruff format --check`/`mypy --strict` clean.
  - `tsconfig.migration-tests.json` (strict no-emit checkJs base config: ES2022,
    nodenext, `types: ["node"]`, `skipLibCheck`).
  - `tools/quality-policy/typecheck-migration-tests.mjs` (discovers live executable JS
    test/helpers absent from `phase0-test-capture.json`, fails on a missing/stale
    captured path, strictly typechecks any new file via a generated temp tsconfig; 0 new
    files is the expected pass state until a later phase adds one).
  - `tools/test-typecheck-migration-tests.mjs` (self-tests: empty discovery, new-file
    discovery, missing-capture detection, and a live self-hosting proof — this very file
    and its checker are themselves new/uncaptured and typecheck clean).
  - `package.json`: added `devDependencies.typescript` (7.0.2) and
    `devDependencies.@types/node` (22.20.1, exact via `--save-exact`), added
    `typecheck:migration-tests` script, added the new self-test to `test:tools`.
    `package-lock.json` created.
- Commands run (all exit 0): `python3 tools/quality-policy/generate_phase0_*.py --write`
  (four generators), `pytest tests/test_phase0_captures.py -q` (16 passed),
  `ruff check`/`ruff format --check`/`mypy --strict` on
  `tests/test_phase0_captures.py`, `node tools/quality-policy/typecheck-migration-tests.mjs`,
  `node tools/test-typecheck-migration-tests.mjs`, `npm run test:tools`,
  `npm run typecheck:migration-tests`, `tools/check-all.sh` (335 pytest passed, full
  green), `npm run check:docs`.
- Deviation from literal plan text: generators are Python (not `.mjs`) for the
  baseline/test/complexity-source/rule-parity captures, since they are fundamentally
  Git-blob/Python-fact derivations; only the JS-test-inventory typecheck owner
  (`typecheck-migration-tests.mjs`) is JS, matching the plan's own JS-specific naming
  for that one piece. This is an equivalent-ownership implementation choice PLAN5
  explicitly allows ("Implementers may choose equivalent internal helper names...").

### 0C. Freeze the rule-parity ledger

- Start/Finish: 2026-07-24 (folded into the 0B work above; tracked separately per
  PLAN5's subphase lettering)
- Scope: `tools/quality-policy/phase0-rule-parity-ledger.json` maps all 32
  `PATTERN_RULE_IDS`, all 3 `check-smell-contracts.mjs` rules, every Python
  contract/dependency/filesize/compat/runtime rule, every documentation/TOC/format/
  reachability/AI-sync rule, every JS namespace/naming/header/dependency/script-order
  rule, jscpd/duplication ownership (both leaves + the aggregate), coverage/hook/
  release/publisher rows, and the new/uncovered rows (focused/disabled-test detection,
  structured boundary markers, hotspot budgets, installer behavior, `check:core`
  inclusion, `schema:check` non-port) to exactly one of five owner categories
  (`maintainedTool`, `focusedPolarContract`, `retainedChecker`, `approvedRemoval`,
  `approvedNonPort`). 113 rows total: 24 maintainedTool, 22 focusedPolarContract, 65
  retainedChecker, 1 approvedRemoval (`hot-path-regression` / `check-performance.py`,
  the only one PLAN5 Phase 0C sanctions), 1 approvedNonPort (`schema-check-non-port`).
  No row is `unproven`.
- Verification: `test_rule_parity_ledger_covers_every_live_pattern_rule_id` cross-checks
  against a live regex-extraction of `tools/check-patterns.mjs`'s `PATTERN_RULE_IDS`
  array (not a hardcoded copy, so the two cannot silently drift); the generator itself
  raises if any row uses an unrecognized owner or if more than the one sanctioned
  `approvedRemoval` row appears.

### 0D. Confirm adoption debt and mandatory splits

- Start/Finish: 2026-07-24 (same session)
- Scope: re-probe standard-tool adoption debt with the versions selected for later
  phases; confirm the mandatory `viewer/viewer.js` split and the other Phase 0
  assertions.
- Evidence:
  - `ruff check tools --statistics --no-cache` (repo's real selected rule set, `tools/`
    exclusion lifted for the probe only): 317 findings across the 18 maintained tool
    Python files (top: E501 line-too-long x116, D103 undocumented-public-function x70,
    TRY003/EM101/EM102 exception-style x50, PLR2004 magic-value x22, T201 print x7,
    PLR0911/PLR0912 too-many-returns/branches x8, C901 complexity x2, plus smaller
    counts). `ruff format --check tools` (same lifted scope): 12 of 18 files need
    reformatting, 6 already formatted (the Phase 0 quality-policy generators, written
    Ruff-clean from the start). This reconciles with Verified Baseline diagnostic 38 and
    is real adoption debt Phase 2C must resolve file-by-file/rule-by-rule (refactor or
    one exact justified CLI exception each) before removing the broad `tools`
    exclusion — not resolved in Phase 0, which only records it.
  - `npx prettier@3.9.6 --check` over tracked JS/CSS/HTML/Markdown confirms the expected
    Phase 0 finding set: all 13 `viewer/*.js` files, `viewer/viewer.css`,
    `viewer/viewer.html`, and the `tools/test-*.mjs`/`viewer-harness.mjs` files need
    formatting. Consistent with Verified Baseline note 25 (`viewer/viewer.js` must be
    split before formatting, since Prettier grows it from 393 to 417 non-empty lines).
  - No changes made in this sub-step beyond evidence-gathering; remediation is Phase 2's
    job (2A splits `viewer/viewer.js` before formatting; 2C resolves the `tools/` Ruff
    debt explicitly).
- Phase 0 exit conditions re-checked and passing: old complete gate green from a
  documented environment (0A); every current rule has one proposed owner (0C); the
  developer-Python/tool contract is frozen from compatibility evidence (0A); immutable
  captures reproduce byte-for-byte from the captured commit and are stable under
  reordering (0B, `test_canonical_json_is_stable_under_key_reordering`); `npm run
typecheck:migration-tests` owns every executable JS test/helper added after the
  captured inventory (0B); the planned-fixture manifest is empty and preauthorized
  (0B); required splits/formatter debt/Ruff debt are recorded (0D, this entry);
  `git status --short` contains only intentional Phase 0 files (verified below).
- Final `git status --short` for Phase 0: `M package.json`, `M pyproject.toml`,
  `?? exec-plans/PLAN5Ledger.md`, `?? package-lock.json`, `?? tests/test_phase0_captures.py`,
  `?? tools/quality-policy/`, `?? tools/test-typecheck-migration-tests.mjs`,
  `?? tsconfig.migration-tests.json` — all intentional Phase 0 artifacts, nothing else.
- Full-gate proof: `tools/check-all.sh` exits 0 (335 pytest passed); `npm run test:tools`,
  `npm run typecheck:migration-tests`, `npm run check:docs` all exit 0.
