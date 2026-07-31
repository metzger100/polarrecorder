**Critical:** This file is a routing map. Use it to find focused documentation, not to store implementation details.

---

## 0. Mandatory Session Preflight (No Exceptions)

Before planning, coding, review, or documentation edits, always read:

1. `documentation/TABLEOFCONTENTS.md`
2. `documentation/conventions/coding-standards.md`
3. `documentation/conventions/smell-prevention.md`

These three reads are mandatory for every task. Start implementation only after this preflight is complete.

If guidance conflicts, precedence is:

1. `documentation/core-principles.md`
2. `documentation/conventions/coding-standards.md`
3. `documentation/conventions/smell-prevention.md`
4. Task-specific documentation

---

## 1. Documentation Navigation Rule

1. **Read `documentation/TABLEOFCONTENTS.md` FIRST**
2. **Read `documentation/conventions/coding-standards.md` and `documentation/conventions/smell-prevention.md` for every
   task**
3. Identify 1-3 additional relevant files for your task
4. Read ONLY those additional files
5. **Never read all files sequentially** (wastes tokens)

---

## 2. Plan and Phase Citation Rule

A comment, docstring, config note, or documentation paragraph outside `exec-plans/` must not cite a historical exec-plan
number (`PLANn`) or phase identifier (`Phase N`) as authority. Describe the code or config standalone instead; a literal
pointer to a real `PLANn.md` file (for example in a "related plans" list) is still fine. Plan prose belongs only inside
`exec-plans/`.

---

## 3. README Sync Principle

`README.md` is mandatory documentation when user-facing behavior changes. Do not treat it as optional. Update
`README.md` in the same task whenever a change affects theming/configuration, user-selectable options, installation or
packaging, bundled assets, requirements/platform support, or contributor-visible workflow. For execution plans, include
explicit README deliverables and exit conditions for these categories.

---

## 4. Quality Checklist Skeleton

- [ ] Completed the mandatory preflight reads.
- [ ] Read only necessary additional documentation beyond mandatory preflight.
- [ ] Implementation complete.
- [ ] Updated relevant documentation, including the navigation index if a doc was added, moved, or removed.
- [ ] Updated `README.md` when the change is user-facing (see the README sync principle above).
- [ ] Ran the project's full quality gate — no failures.
- [ ] New/changed tests and coverage/complexity policy stay within this project's checked floors, budgets, and
      classifications; no suppression, skip, or lowered threshold was added to reach green.
- [ ] For releases, followed this project's release workflow exactly, without rerunning quality inside the publish step.

---

## Required Documentation Shape

Every maintained documentation page has a title, a plain `**Status:** Current.` line, and `## Overview`,
`## Key Details`, and `## Related` sections. Additional interface material is optional when it helps explain a public
contract. Keep documentation concise, concrete, and linked from the navigation index when it is new.
