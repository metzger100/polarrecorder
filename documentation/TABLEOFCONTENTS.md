# Documentation Table of Contents

**Status:** Current | AI routing index for Polar Recorder documentation.

## Overview

Start here for project documentation. Use the questions below to open the smallest useful set of docs for the task.

## Key Details

## Repository Orientation

- **Where are the non-negotiable project rules?** -> [core-principles.md](core-principles.md)
- **Where is the quality policy and required gate?** -> [QUALITY.md](QUALITY.md)
- **Where are known issues and accepted debt tracked?** -> [TECH-DEBT.md](TECH-DEBT.md)
- **Where is the root architecture summary?** -> [../ARCHITECTURE.md](../ARCHITECTURE.md)
- **Where is contributor workflow guidance?** -> [../CONTRIBUTING.md](../CONTRIBUTING.md)

## AvNav Integration

- **How does AvNav load, start, stop, and status-report the Python plugin?** -> [avnav/plugin-lifecycle.md](avnav/plugin-lifecycle.md)
- **How does Polar Recorder map that lifecycle into `plugin.py`?** -> [architecture/plugin-lifecycle.md](architecture/plugin-lifecycle.md)
- **How are plugin API requests routed and static viewer files served?** -> [avnav/request-routing-and-static-files.md](avnav/request-routing-and-static-files.md), [architecture/api.md](architecture/api.md)
- **How do AvNav editable parameters work, and where are Polar Recorder's 23 settings defined?** -> [avnav/editable-parameters.md](avnav/editable-parameters.md), [user/configuration.md](user/configuration.md)
- **Which AvNav store keys and units feed learning?** -> [avnav/keys-and-units.md](avnav/keys-and-units.md)

## Architecture

- **What endpoints does the viewer call?** -> [architecture/api.md](architecture/api.md)
- **How does raw AvNav data become accepted, rejected, or quarantined samples?** -> [architecture/data-pipeline.md](architecture/data-pipeline.md)
- **How are learned speeds stored and queried?** -> [architecture/polar-model.md](architecture/polar-model.md)
- **How is `polar.json` written, recovered, and migrated?** -> [architecture/persistence.md](architecture/persistence.md)
- **How is the static browser viewer organized?** -> [architecture/ui.md](architecture/ui.md)

## Validation and Poisoning Resistance

- **What are R1 through R16, their reason codes, and candidate/quality gates?** -> [filters/rejection-rules.md](filters/rejection-rules.md)
- **How does the model resist bad samples and undetected slow tails?** -> [filters/poisoning-resistance.md](filters/poisoning-resistance.md)
- **Which configuration keys tune validation thresholds?** -> [user/configuration.md](user/configuration.md)

## User Workflows

- **How do users configure recording, thresholds, flushes, and debug logging?** -> [user/configuration.md](user/configuration.md)
- **How do CSV export, presets, JSON backup, and future restore fit together?** -> [user/export-import.md](user/export-import.md)
- **How should common runtime symptoms be diagnosed?** -> [user/troubleshooting.md](user/troubleshooting.md)

## Conventions

- **What Python and viewer JavaScript standards are binding?** -> [conventions/coding-standards.md](conventions/coding-standards.md)
- **Which smells are blocking, and what replaces them?** -> [conventions/smell-prevention.md](conventions/smell-prevention.md)
- **How are fakes, clocks, integration tests, and mock data organized?** -> [conventions/testing-infrastructure.md](conventions/testing-infrastructure.md)

## Maintenance Guides

- **How do docs stay synchronized with behavior?** -> [guides/documentation-maintenance.md](guides/documentation-maintenance.md)
- **How do I write a multi-session execution plan?** -> [guides/exec-plan-authoring.md](guides/exec-plan-authoring.md)
- **How do I remove dead code or stale docs safely?** -> [guides/garbage-collection.md](guides/garbage-collection.md)
- **How are local release artifacts prepared and checked?** -> [guides/release-workflow.md](guides/release-workflow.md)

## Feature-Specific Lookups

- **Single-lock and snapshot discipline** -> [architecture/api.md](architecture/api.md), [architecture/plugin-lifecycle.md](architecture/plugin-lifecycle.md), [architecture/persistence.md](architecture/persistence.md)
- **No AvNav imports in domain modules** -> [core-principles.md](core-principles.md), [conventions/smell-prevention.md](conventions/smell-prevention.md)
- **TWA/TWS/STW key and unit assumptions** -> [avnav/keys-and-units.md](avnav/keys-and-units.md), [architecture/data-pipeline.md](architecture/data-pipeline.md)
- **Viewer namespace and no-build static runtime** -> [architecture/ui.md](architecture/ui.md), [conventions/coding-standards.md](conventions/coding-standards.md)

## Related

- [Root architecture](../ARCHITECTURE.md)
- [Contributing](../CONTRIBUTING.md)
