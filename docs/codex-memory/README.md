# Codex Memory For Offonika Portal

This folder stores durable, practical context for future Codex sessions working
in the portal repository. It should prevent repeated mistakes and repeated
re-discovery of already-known architecture.

## Start Here

1. Read repository root `AGENTS.md`.
2. Open the playbook for the task area.
3. Verify current git state before editing.
4. Keep these notes updated when a rule, workflow or repeated trap changes.

## Files

- `project-index.md` - fast orientation map across portal modules, 1C,
  deployment, Prisma and memory files.
- `tool-registry.md` - which commands/tools run locally, on VPS, in Prisma, in
  1C/AIAgentAPI and in smoke checks.
- `error-playbook.md` - repeated failures and exact prevention/fix patterns.
- `portal-map.md` - modules, routes, data sources and ownership boundaries.
- `product-vision.md` - product principles such as trust-but-verify.
- `launch-checklist.md` - practical launch gates for employee rollout.
- `deploy-playbook.md` - concise deployment memory and command pitfalls.
- `git-worktree-playbook.md` - dirty-tree, staging and commit hygiene.
- `agentapi-boundary.md` - how portal work depends on AIAgentAPI/1C releases.
- `one-c-workday-audit.md` - current 1C read-only data useful for Workday
  automation and cash control.
- `session-checklist.md` - self-checks before coding, deploy and final answer.
- `ofd-one-c-playbook.md` - OFD/SABY/1C rules and current direction.
- `workday-playbook.md` - workday pilot, shift control and cash statement notes.
- `payroll-playbook.md` - payroll calculation constraints and alias decisions.
- `decision-log.md` - dated decisions that future sessions should not rediscover.

## Maintenance Rules

- Keep this memory short and operational.
- Prefer exact file paths and commands.
- Do not store secrets, env values, passwords, personal tokens or report dumps.
- Mark dated observations as stale-prone.
- When a mistake repeats twice, add the prevention rule here instead of relying
  on memory.
- Update memory when the project actually evolves: roadmap/maturity status,
  meaningful phase start/finish, architecture decision, workflow, persistent
  rule or Definition of Done. Do not turn memory into a log of every small
  bugfix, UI patch or refactor.

