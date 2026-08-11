---
name: create-release
description:
  Prepare, create, verify, and publish Polar Recorder releases with the repository release tooling. Use when Codex is
  asked to assess release readiness, choose a SemVer version, draft release notes, build the local release ZIP, create
  the release commit and annotated tag, guide real-AvNav validation, or push a release for GitHub publication.
---

# Create Release

Create Polar Recorder releases through the repository-owned workflow. Treat local artifact creation, manual AvNav
validation, and remote publication as separate authorization boundaries.

## Read the live release contract

1. Run the mandatory `preflight` skill.
2. Read `documentation/TABLEOFCONTENTS.md`, `documentation/conventions/coding-standards.md`, and
   `documentation/conventions/smell-prevention.md` in that order.
3. Read `documentation/guides/release-workflow.md` completely.
4. Read `documentation/guides/manual-avnav-validation.md` before guiding validation or publication.
5. Follow the live guides and repository rules if this skill becomes stale; do not preserve conflicting instructions
   from this file.

## Use the repository owners

- `AGENTS.md` owns scope, quality, README synchronization, and release workflow constraints.
- `tools/release-prepare.mjs` owns release evidence collection.
- `tools/release-create.mjs` owns local release orchestration.
- `tools/release-archive.mjs` owns the runtime manifest, version stamping, ZIP staging, and archive validation.
- `plugin.py` is the AvNav integration entry point included in the artifact.
- `server/polarrecorder/` supplies all packaged Python domain modules.
- `viewer/viewer.html` owns the static viewer load order; its runtime scripts, styles, and icon must be packaged.
- `tests/` and development tooling validate the release but must never appear in the ZIP.
- `releases/` owns canonical ZIP and notes pairs; do not invent alternate artifact locations.

The artifact must contain one top-level `polarrecorder/` directory and only the runtime allowlist documented by the
release guide. The installed archive's stamped `plugin.json`, not the development checkout, is version authority at
runtime.

## Classify the request

- **Prepare**: inspect readiness, collect evidence, propose a version, or draft notes. Do not commit, tag, or push.
- **Create locally**: build the ZIP and notes commit and create the annotated tag. This is authorized only when the user
  asks to create a release with an exact version, or explicitly approves the proposed exact version.
- **Publish**: push the release commit and tag. Require explicit push/publication authorization and recorded manual
  AvNav validation.

A request to review changes, recommend a version, prepare notes, or check readiness does not authorize `release:create`,
a commit, a tag, or a push.

## Prepare release evidence

1. Inspect `git status --short --branch`; preserve all existing user changes.
2. Inspect the latest version tags and reject an already-used target tag.
3. Run `npm run release:prepare` and review its JSON evidence.
4. Review actual user-facing and compatibility impact since the last release. Do not infer SemVer from Conventional
   Commit prefixes alone.
5. Choose the version by impact:
   - major for breaking behavior, incompatible data/config/runtime contracts, or required migration;
   - minor for new non-breaking user-facing capability;
   - patch for fixes, refactors, documentation, tests, or tooling-only maintenance.
6. For prereleases, preserve valid full SemVer and advance the intended prerelease series deliberately.

If the version was not supplied, present the proposed exact version and reasoning, then obtain confirmation before the
local creation step.

## Draft release notes

1. Write `releases/polarrecorder-<version>.md` using `apply_patch`.
2. Write for AvNav users first. Cover visible behavior, data or configuration changes, upgrade impact, and required user
   action.
3. Keep every bullet concrete and understandable without the diff.
4. Do not pad notes with quality-system, test-count, or internal refactoring detail unless it materially affects users.
5. Confirm the canonical notes file exists and contains non-whitespace text.

## Create the local release

Immediately before creation, confirm:

- the exact version is authorized and valid SemVer without a `v` prefix;
- the canonical notes file matches that version;
- the target tag does not exist;
- the worktree has no changes outside `releases/`.

Run exactly:

```bash
npm run release:create -- --version=<version>
```

Treat command yields as polling intervals and wait for completion. The command runs `npm run check:all`, stamps and
validates the runtime-only ZIP, commits the ZIP and notes, and creates annotated tag `v<version>`. Do not duplicate its
full quality gate immediately before or after it, and do not manually create a competing archive, commit, or tag.

## Verify without rebuilding

After successful local creation:

1. Confirm the worktree state and the new release commit.
2. Confirm annotated tag `v<version>` points at that commit.
3. Confirm both `releases/polarrecorder-<version>.zip` and `.md` are committed at the tag.
4. List the ZIP and verify one top-level `polarrecorder/` directory containing only runtime files.
5. Inspect the archived `polarrecorder/plugin.json` and confirm its stamped version.

Do not rerun `release:create`, rebuild the artifact, amend the release commit, delete/retarget the tag, or force-push
unless the user explicitly authorizes the exact recovery action.

## Require real AvNav validation before publication

Use `documentation/guides/manual-avnav-validation.md` against a real AvNav host. Automation may assist with recording
results, but it must never claim the manual checklist passed. If validation is absent or fails, stop before pushing.

## Publish only when explicitly authorized

Before pushing, re-confirm that the tag, release commit, ZIP, notes, and recorded manual validation agree. Then run the
normal non-force pushes requested by the user, typically:

```bash
git push origin main
git push origin v<version>
```

Pushing the tag triggers the GitHub release workflow. Do not rebuild artifacts or rerun quality during the publication
step. Never force-push or delete a remote tag as an inferred recovery.

## Fail closed

Stop and report the exact state when any of these occurs:

- dirty files outside `releases/`;
- missing or empty canonical notes;
- invalid/reused version or existing tag;
- failed required gate, schema, archive build, or archive validation;
- partial commit/tag creation;
- missing or failed manual AvNav validation before publication;
- absent authorization for the next mutating boundary.

Fix root causes rather than weakening tests, suppressing checks, modifying the runtime allowlist casually, or bypassing
the repository tooling.

## Handoff

Report the exact version, tag, release commit, ZIP path, notes path, automated validation result, manual AvNav
validation state, and whether anything was pushed. Clearly state the next authorized action still pending.
