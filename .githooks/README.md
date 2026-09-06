# Git Hooks

**Status:** Current.

## Overview

This directory holds the tracked `pre-push` hook that runs the full quality gate (`npm run check:all`) before any push.
Git does not activate a repository's tracked hooks automatically, so the project's normal setup activates them for each
clone.

## Key Details

Normal one-time setup for a clone runs the hook installer along with the rest of the development toolchain:

```sh
npm run setup
```

To repair or reinstall only the hook, run `npm run hooks:install`. The installer sets `core.hooksPath` to `.githooks`
and ensures `pre-push` is executable. Verify the hook is active at any time with:

```sh
npm run hooks:doctor
```

`hooks:doctor` prints the exact repair command (`npm run hooks:install`) if the hook path is unset, points elsewhere,
the hook file is missing, or it is not executable.

`pre-push` resolves the repository root (`git rev-parse --show-toplevel`), `cd`s into it, exports stable `LC_ALL`/`LANG`
values, prepends a project-local `venv/bin` (or `POLARRECORDER_VENV/bin`) to `PATH` when present, and runs exactly one
`npm run check:all`, propagating its exit status. A failing gate blocks the push.

## Related

- [Quality gates](../documentation/conventions/quality-gates.md)
- [Coding standards](../documentation/conventions/coding-standards.md)
