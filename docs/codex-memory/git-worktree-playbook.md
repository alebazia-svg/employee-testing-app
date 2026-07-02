# Git And Worktree Playbook

## Why This Exists

This repo often has useful unfinished work from previous sessions. The main
failure mode is accidentally mixing unrelated files into the next commit or
deploy. Treat the worktree as shared space.

## Start Of Any Task

Run:

```powershell
git status --short
git diff --stat
```

Then classify dirty files:

- current task;
- old but valuable work;
- temporary/debug files;
- generated files;
- unknown, do not touch without investigation.

## Staging Rules

- Never use `git add .`.
- Stage exact paths requested by the user or required by the task.
- Before commit, run `git diff --cached --stat` and inspect the cached diff.
- If untracked files are temporary, remove or ignore them only with user consent.
- If future work is useful but not ready, park it in `.wip/` or a separate WIP
  branch. Do not leave Prisma migrations dangling in the active tree.

## Commit Rules

Use one commit per coherent task:

- docs-only memory changes;
- one UI improvement;
- one payroll logic fix;
- one workday/API change;
- one migration-backed DB change.

Do not combine:

- OFD with payroll;
- workday with OFD;
- Prisma schema with unrelated UI;
- deploy runbook changes with app behavior.

## Recovery From Prior Mistakes

Known repeated issues:

- untracked root-owned migration files on VPS can block checkout;
- local PowerShell can interpret remote Linux commands incorrectly;
- WIP Prisma models can accidentally become deployable if left in tree;
- old diagnostics/scripts can look important but be stale.

When in doubt, stop and produce a worktree report before editing.

