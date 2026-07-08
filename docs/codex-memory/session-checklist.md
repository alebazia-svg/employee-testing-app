# Codex Session Checklist

## Before Coding

Ask:

- Which business area is this: workday, payroll, OFD, AIAgentAPI, deploy, docs?
- What files already implement this flow?
- Is there a playbook in `docs/codex-memory/`?
- Are there unrelated dirty files?
- Does this require DB migration, 1C change, env change or deploy approval?
- Can this be solved by extending existing helpers/components?
- Before proposing a new architecture, screen, endpoint, service or mechanism:
  is there an existing implementation that can be extended instead?
- If proposing a large change, can I clearly explain why the current solution is
  insufficient, what alternatives exist, why this path is best, and what risks
  it introduces?

If the answer depends on current production state, verify it instead of relying
on memory.

## While Coding

- Keep edits scoped to the requested area.
- Prefer existing helpers and local style.
- Avoid duplicating matching, date parsing, payroll alias or workday shift logic.
- Add comments only where they reduce real future confusion.
- Do not start a wider refactor because the nearby code is imperfect.

## Before Commit

Run:

```powershell
git status --short
git diff --stat
git diff --cached --stat
```

Confirm:

- staged files match the task;
- old dirty files are not staged;
- Prisma migrations are included only when intended;
- generated uploads/env/tmp files are not staged.

## Verification Defaults

Most app changes:

```powershell
npx tsc --noEmit
npm run build
```

Payroll:

```powershell
npm run test:payroll
npx tsc --noEmit
npm run build
```

Docs-only memory changes: no app build required.

## Before Final Answer

Report:

- changed files;
- checks run and result;
- commit hash if committed;
- deploy result if deployed;
- remaining dirty files when relevant;
- what was intentionally not touched.
- whether this task changed actual project state: roadmap or maturity status,
  start/finish of a meaningful phase, architecture decisions, workflow,
  persistent development rules, Definition of Done or stale Codex memory.
- if yes, update the relevant docs before calling the task complete:
  `AGENTS.md`, `decision-log.md`, task playbooks, product vision, launch
  checklist or maturity/roadmap docs.
- if this was only a local bugfix, small UI patch, refactor or technical change
  without architecture/roadmap impact, do not update docs. Report:
  "Документация не обновлялась, так как задача не изменила состояние проекта".
- keep docs commits separate from code commits unless the user explicitly asks
  for one combined commit.

## Before VPS Deploy From Windows

- Read `docs/codex-memory/deploy-playbook.md`.
- Do not send long nested SSH commands containing `sudo docker`, `curl`, `grep`,
  command substitutions or heavy quoting from PowerShell.
- If sudo password entry is needed, first create a small script on the VPS, then
  open only `ssh -t bela@portal.alebazia.xyz "sh /tmp/<script>.sh"` for the
  user to type the password.
- After the user sends output, verify server commit, container restart, route
  status and expected bundle text.
