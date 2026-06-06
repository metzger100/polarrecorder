# Technical Debt

**Status:** Current.

## Overview

This file records known debt and intentional temporary states.

## Key Details

No open technical debt is currently recorded.

### Rule rollout (severity model)

Every gate rule is blocking; there is no permanent warn tier (see [QUALITY.md](QUALITY.md)). This file is the only place a temporary non-blocking state may be recorded, and only while a newly introduced rule's cleanup is in flight. Each entry must name the rule, the owner, and the date the rule is promoted to blocking. An empty list above means the gate is fully blocking with no deferred rules.

## Related

- [Roadmap](../ROADMAP.md)
- [Quality](QUALITY.md)
