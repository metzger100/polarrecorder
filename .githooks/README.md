# Git Hooks

**Status:** Current.

## Overview

This directory holds the tracked `pre-push` hook that runs the full quality gate
(`npm run check:all`) before any push. Git does not activate a repository's tracked
hooks automatically; each clone must opt in once.

## Key Details

One-time per-clone setup:

```sh
npm run hooks:install
```

This sets `core.hooksPath` to `.githooks` and ensures `pre-push` is executable. Verify
the hook is active at any time with:

```sh
npm run hooks:doctor
```

`hooks:doctor` prints the exact repair command (`npm run hooks:install`) if the hook path
is unset, points elsewhere, the hook file is missing, or it is not executable.

`pre-push` resolves the repository root (`git rev-parse --show-toplevel`), `cd`s into it,
exports stable `LC_ALL`/`LANG` values, prepends a project-local `venv/bin` (or
`POLARRECORDER_VENV/bin`) to `PATH` when present, and runs exactly one
`npm run check:all`, propagating its exit status. A failing gate blocks the push.

## Related

- [Quality gates](../documentation/conventions/quality-gates.md)
- [Coding standards](../documentation/conventions/coding-standards.md)
