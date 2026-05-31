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
- `tools/check-agent-setup.sh` verifies the project Kilo config, required agents, command frontmatter, controller delegation permissions, and legacy-path conflicts before you attempt `/exec-plan`.

The controller never implements the human-authored foundation phases. It starts agent-driven work only after Phase 0 and Phase 1 are marked `done`, `AGENTS.md` and `CLAUDE.md` exist, and `tools/check-all.sh` exits 0.

## Compatibility Notes

- Current Kilo docs list project agent Markdown files under `.kilo/agents/*.md`; some creation flows also mention `.kilo/agent/*.md`. This repository keeps the canonical definitions only in `.kilo/agents/` so Kilo does not load duplicate same-name agents from both paths.
- Current Kilo docs identify project `kilo.jsonc` at the repository root as the project config. This repository also keeps `.kilo/kilo.jsonc` for compatibility with `.kilo/` directory config loading. Keep the root and `.kilo/` config values mirrored.
- The root and `.kilo/` configs set `default_agent` to `plan-controller`, enable the Agent Manager tool, and restrict `task`/`agent_manager` to primary agents. The subagents also deny `task` in their own frontmatter.
- The optional CLI verification is `kilo agent list`. If the standalone CLI is unavailable, verify through the VS Code Kilo agent picker and command picker.

## Schema Assumptions - Verify In Kilo

- Project agents are Markdown files under `.kilo/agents/*.md`; `.kilo/agent/*.md` is not mirrored to avoid duplicate definitions when both paths are supported.
- Project commands are Markdown files under `.kilo/commands/*.md`.
- Agent frontmatter supports `description`, `mode`, `model`, `temperature`, and `permission`.
- Command frontmatter supports `description` and `agent`.
- Permission rules support `read`, `grep`, `glob`, `edit`, `bash`, and `task`, including deny rules and command/file patterns.
