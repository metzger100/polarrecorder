# Add a New Viewer Panel

**Status:** Current.

## Overview

Use this guide to add a static viewer panel without breaking namespace, theme, or settings contracts.

## Key Details

- Read `documentation/architecture/ui.md`, `documentation/user/configuration.md`, and `AGENTS.md`.
- Register the module in `viewer/viewer.html` in documented script order.
- Export browser helpers through `window.Polarrecorder` and declare matching `Depends:` headers.
- Use `--polarrecorder-` CSS tokens and update `plugin.css` or the panel stylesheet for themes.
- Keep settings in AvNav configuration and route persistence through the existing API.
- Add Vitest coverage under `tests/js/` for rendering, absent values, and explicit zero values.
- Run `npm run inventory:write` after adding executable test helpers.
- Run `npm run check:all` before committing.

## Related

- [UI architecture](../architecture/ui.md)
- [Configuration](../user/configuration.md)
- [Testing infrastructure](../conventions/testing-infrastructure.md)
