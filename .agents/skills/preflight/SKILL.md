---
name: preflight
description: Mandatory session bootstrap for repository work.
---

# Skill: preflight

## Description

Establish the repository rules and the smallest relevant context before work begins.

## Instructions

1. Read the documentation index, coding standards, and smell-prevention guidance in that order.
2. Classify the request and read only the additional documentation relevant to that class.
3. Check the size of files that will receive substantial edits.
4. Record a short internal summary: task, category, constraints, reusable utilities, and completion gate.
5. Apply documented precedence when guidance conflicts.
6. Treat command wait or yield limits as polling intervals, not process lifetime limits. If a long-running command
   returns a live session, poll it until completion. Do not invent a config-file timeout setting or split a required
   gate solely because the initial wait interval elapsed.

## Related

- The repository documentation index
