# Release Workflow

**Status:** Current.

## Overview

Polar Recorder releases are created locally as runtime-only AvNav plugin artifacts under `releases/`. The release zip is the installable artifact; release notes describe the user-visible changes for that exact version. GitHub Releases is a secondary publishing target that copies the already-created zip and notes when a release tag is pushed.

## Key Details

Release artifact names:

- `releases/polarrecorder-X.Y.Z[-prerelease][+build].zip`
- `releases/polarrecorder-X.Y.Z[-prerelease][+build].md`

Version authority:

- The release version is supplied to local release tooling with `--version` and
  becomes the `vX.Y.Z[-prerelease][+build]` git tag.
- The development checkout does not carry a release version in `plugin.json`.
- `pyproject.toml` declares the project version as dynamic.
- `tools/release-zip.py --version <version>` stamps that version into the
  packaged copy of `plugin.json`, which is what runtime `pluginInfo()` reads
  from an installed release zip.
- A development checkout without a stamped `plugin.json` reports the benign
  development fallback defined in release tooling.

Prerequisites:

- Python dev tools available in the project virtual environment or on `PATH`.
- Node.js available for documentation and viewer checks.
- No runtime dependency that requires `pip install` on target AvNav devices.
- GitHub publishing requires the committed release zip, committed release notes,
  and an annotated tag named `vX.Y.Z` or `vX.Y.Z-prerelease`.

Step-by-step release flow:

1. Prepare release context.

```bash
npm run release:prepare
```

2. Review the JSON evidence and decide the next SemVer version from actual user and compatibility impact.
3. Write concrete user-facing release notes directly in the canonical release notes file:
   `releases/polarrecorder-X.Y.Z[-prerelease][+build].md`.

```bash
$EDITOR releases/polarrecorder-X.Y.Z.md
```

4. Create the release artifacts, commit, and annotated tag.

```bash
npm run release:create -- --version=X.Y.Z
```

`release:create` accepts full SemVer release versions, including prereleases
such as `1.0.0-beta.1`. It runs the required gate (`tools/check-all.sh`), builds
the runtime zip with `python tools/release-zip.py --version <version>`, validates
it with `python tools/check-release.py`, commits the zip and notes, and creates
an annotated `v<version>` tag.

The zip must contain a single top-level `polarrecorder/` directory. Inside that
directory, it must contain only runtime files: `plugin.py`, `plugin.mjs`,
`plugin.css`, stamped `plugin.json`, `viewer/`, and
`server/polarrecorder/**/*.py`. It must not contain README, tests, tools,
documentation, release sources, data files, caches, licenses, or development
configuration.

Manual inspection commands remain useful before publishing:

```bash
python -m zipfile --list releases/polarrecorder-X.Y.Z.zip
python tools/check-release.py releases/polarrecorder-X.Y.Z.zip
```

GitHub release publishing:

- `.github/workflows/publish-release.yml` runs when a `v*` tag is pushed.
- The workflow checks out the tag ref, verifies the matching committed zip and
  notes exist, then creates the GitHub Release from those artifacts.
- Build and commit release artifacts locally before pushing the tag. The workflow does not build artifacts on GitHub.
- If the artifacts are not present at the tagged commit, the workflow fails closed.
- Tags with a SemVer prerelease suffix publish GitHub prereleases. Plain
  `vX.Y.Z` tags publish normal releases.

SemVer decision guide:

| Bump | Use when |
|---|---|
| Major | Breaking user-facing behavior, incompatible data/config/runtime contracts, or required migration |
| Minor | New user-facing capability or non-breaking runtime behavior that exposes new functionality |
| Patch | Bug fixes, stability fixes, documentation, tests, refactors, release tooling, and non-breaking maintenance |

Release notes writing guide:

- Write for AvNav users first.
- Describe visible behavior, data-format changes, configuration changes, and upgrade impact.
- Prefer concrete wording over broad phrases.
- Mention user action only when the upgrade requires it.
- Keep each bullet understandable without reading the diff.
- `release:prepare` intentionally does not infer SemVer from Conventional Commit prefixes. Decide the next version by reviewing commit messages, diffs, and the touched runtime, viewer, configuration, export/import, documentation, and release code paths.

Troubleshooting:

| Symptom | Likely Cause | Fix |
|---|---|---|
| `release:create` fails on `tools/check-all.sh` | Lint, typing, test, docs, release, or viewer gate failure | Run `tools/check-all.sh`, fix all failures, rerun release |
| `release:create` fails on notes | Missing or empty companion notes file | Create `releases/polarrecorder-X.Y.Z.md` and rerun |
| `release:create` fails with duplicate tag | `vX.Y.Z` already exists | Choose next version or delete/retarget the tag intentionally |
| Zip contains unexpected files | Runtime allowlist drift | Update `tools/release_manifest.py` deliberately and rerun the gate |
| GitHub workflow fails on missing artifacts | Tag points at a commit without matching zip or notes | Commit both files, retag intentionally, and push the corrected tag |

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Documentation maintenance](documentation-maintenance.md)
- [Quality gates](../conventions/quality-gates.md)
- [Testing infrastructure](../conventions/testing-infrastructure.md)
- [Contributing](../../CONTRIBUTING.md)
