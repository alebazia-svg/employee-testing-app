# Portal Decision Log

## 2026-07-02 - Codex Memory Split

The AIAgentAPI/1C extension memory lives in:

```text
C:\Users\kbr4\OneDrive\Рабочий стол\ai-business-os
```

The portal memory lives in this repository:

```text
C:\Projects\employee-testing-app-main
```

Do not assume one repo's `AGENTS.md` covers the other.

## 2026-07-02 - OFD Next Step

Stop treating `/admin/ofd` as an endless UI polishing task. The next major step
should be `OfdControlEvent V1` with database-backed event state, assignment,
status lifecycle and later notifications.

## 2026-07-02 - Workday Pilot

Workday pilot should prioritize:

- supported shift templates;
- no empty checklist runs;
- persistent photo uploads;
- clear stale-day closure;
- admin visibility of cash statement data and checklist state.

Early-close approvals, discipline impact and notification automation can come
after the basic pilot path is stable.

## 2026-07-02 - Cash Statements

1C cash statement endpoints are live through AIAgentAPI and useful for admin
workday checks. They should not automatically replace the employee's real cash
recount. The employee should not be encouraged to simply copy 1C balances.

## 2026-07-02 - Payroll Identity

Magomed Kosterenko and the old trainee retail account should be aggregated as
one payroll person for current historical data. The generic trainee account may
be reused later, so long-term identity needs a safer mapping than display-name
matching.

## 2026-07-02 - Push Notifications

Checklist timing notifications are important for pilot usability. The preferred
direction discussed was push notifications rather than Telegram as the first
channel.

