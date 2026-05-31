# Kilo Agent Bootstrap

This directory contains project-local Kilo Code configuration for the active execution-plan workflow.

## One-Time Setup

Configure OpenRouter as the model provider in Kilo Code. Keep the OpenRouter API key in Kilo/user settings only; never commit provider keys or secrets to this repository.

Before the first `/exec-plan` run, perform two setup checks:

1. Slug verification: confirm these model slugs resolve in the live OpenRouter catalog:
   - `openrouter/deepseek/deepseek-v4-pro`
   - `openrouter/deepseek/deepseek-v4-flash`
2. Kilo capability verification: confirm the installed Kilo Code version supports:
   - per-agent model assignment;
   - read-only subagents via permissions;
   - controller delegation to named subagents and expected nesting behavior.

If either model slug has changed, update the affected agent files. If read-only subagents cannot be enforced, treat verifier output as advisory and rely on `tools/check-all.sh` as the binding arbiter once Phase 1 creates it.

## Usage

- `/exec-plan` starts or continues the next incomplete phase from the active plan in `exec-plans/active/`. The next phase is the first phase not marked `done` in `exec-plans/active/<PLAN>.progress.md`.
- `/verify-phase` runs both Pro verifiers against the current or named phase without editing files.

The controller never implements the human-authored foundation phases. It starts agent-driven work only after Phase 0 and Phase 1 are marked `done`, `AGENTS.md` and `CLAUDE.md` exist, and `tools/check-all.sh` exits 0.

## Schema Assumptions - Verify In Kilo

- Project agents are Markdown files under `.kilo/agents/*.md`.
- Project commands are Markdown files under `.kilo/commands/*.md`.
- Agent frontmatter supports `description`, `mode`, `model`, `temperature`, and `permission`.
- Command frontmatter supports `description` and `agent`.
- Permission rules support `read`, `grep`, `glob`, `edit`, `bash`, and `task`, including deny rules and command/file patterns.
