# Documentation Format

**Status:** Current.

## Overview

Use this contract for every new or updated file under `documentation/`. Documentation should be short, routed from the table of contents, and complete enough for maintainers and agents to act without reading the whole tree.

## Key Details

Mandatory structure:

```markdown
# Title

**Status:** Current.

## Overview

One or two sentences explaining when to use the document.

## Key Details

Compact bullets, tables, signatures, config keys, constants, and file paths.

## Related

- Links to nearby source-of-truth docs.
```

Content rules:

- Start from [the documentation index](../TABLEOFCONTENTS.md) and add every new documentation file there.
- Keep docs focused on contracts, workflows, data shapes, configuration keys, and implementation touchpoints.
- Prefer bullets and small tables over long narrative sections.
- Include concrete names for APIs, parameters, files, reason codes, fixtures, commands, and checker rule IDs when they are part of the contract.
- Keep user-facing behavior changes synchronized with `README.md` when the change affects installation, configuration, export/import, requirements, or visible viewer behavior.
- Keep AvNav behavior docs self-contained; state the host contract instead of citing machine-local paths.
- Keep every Markdown file below the 400 non-empty-line limit.

Forbidden content:

- Empty sections, stub placeholders, or undocumented follow-up promises.
- Decorative formatting, large diagrams, or prose that does not help implementation or operation.
- Machine-local absolute paths.
- Future-roadmap sections unless the document is explicitly a roadmap or active execution plan.
- Duplicated rule catalogs that drift from [smell prevention](smell-prevention.md) or [quality gates](quality-gates.md).

Validation:

```bash
npm run check:docs
```

For normal development work, finish with the full gate:

```bash
tools/check-all.sh
```

## Related

- [Documentation index](../TABLEOFCONTENTS.md)
- [Documentation maintenance](../guides/documentation-maintenance.md)
- [Coding standards](coding-standards.md)
- [Quality gates](quality-gates.md)
- [Smell prevention](smell-prevention.md)
