# Add a New API Endpoint

**Status:** Current.

## Overview

Use this guide to add an endpoint while preserving the AvNav boundary and snapshot discipline.

## Key Details

- Read `documentation/architecture/api.md`, `AGENTS.md`, and `documentation/conventions/coding-standards.md`.
- Add pure domain behavior under `server/polarrecorder/`; keep AvNav access in `plugin.py`.
- Register routing at the existing handler boundary and define request and response shapes in the API owner.
- Keep persistence writes behind the existing `plugin.py` snapshot and persistence handoff.
- Add pytest coverage under `tests/` for accepted, rejected, and malformed requests.
- Add Vitest coverage under `tests/js/` for any viewer client call or rendering change.
- Update API fixtures when the response shape changes.
- Run `npm run inventory:write` after adding executable test helpers.
- Run `npm run check:all` before committing.

## Related

- [API architecture](../architecture/api.md)
- [Persistence](../architecture/persistence.md)
- [Testing infrastructure](../conventions/testing-infrastructure.md)
