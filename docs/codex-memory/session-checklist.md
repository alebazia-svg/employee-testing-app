# Codex Session Checklist

## Before Coding

Ask:

- Which business area is this: workday, payroll, OFD, AIAgentAPI, deploy, docs?
- What files already implement this flow?
- Is there a playbook in `docs/codex-memory/`?
- Are there unrelated dirty files?
- Does this require DB migration, 1C change, env change or deploy approval?
- Can this be solved by extending existing helpers/components?

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

