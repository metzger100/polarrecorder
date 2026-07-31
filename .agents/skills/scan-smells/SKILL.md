---
name: scan-smells
description: Review changes against the repository smell catalog before completion.
---

# Skill: scan-smells

## Description

Check proposed changes for duplicated defaults, defensive interior guards, hidden fallback paths, and policy escapes.

## Instructions

1. Keep validation and defaults at input boundaries; interior code trusts normalized contracts.
2. Reuse canonical helpers instead of adding local variants.
3. Do not hide findings with suppressions, skipped tests, ignored paths, or lower thresholds.
4. Use only documented, narrowly validated exception mechanisms when an external boundary genuinely requires one.
5. Run the repository smell and completion gates; fix findings at their root cause.

## Related

- The repository smell-prevention guidance
