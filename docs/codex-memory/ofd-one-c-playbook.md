# OFD / SABY / 1C Playbook

## Current Purpose

`/admin/ofd` is diagnostic/read-only. It helps understand OFD receipts, returns,
1C realizations and linked documents. It is not yet the final control system.

The next major architecture step is `OfdControlEvent V1` with PostgreSQL state,
assignment, lifecycle and notifications. Do not keep doing small UI tweaks as a
substitute for that model unless the user explicitly asks.

## Important Files

- `app/(dashboard)/admin/ofd/page.tsx`
- `app/api/admin/ofd/probe/route.ts`
- `lib/saby-ofd.ts`
- `lib/one-c.ts`

## External 1C Dependency

The portal calls AIAgentAPI. AIAgentAPI source/release work is not in this repo.
Check the separate repo:

```text
C:\Users\kbr4\OneDrive\Рабочий стол\ai-business-os
```

Before assuming an endpoint is missing, check live `/hs/agent/version` and the
AIAgentAPI release memory there.

## Current 1C Endpoints Used

- `/sales-realizations`
- `/sales-realization-links`
- `/cash-statement-dimensions`
- `/cash-statement-summary`
- `/version`

## Matching Lessons Already Learned

- Date strings from 1C can be `DD.MM.YYYY HH:mm:ss`; do not rely blindly on
  `new Date()` for scoring.
- Product matching must be strict enough not to confuse similar iPhones and
  accessories.
- Amount mismatch greater than 1 RUB should not be shown as a normal candidate.
- Same-day and time proximity are strong signals.
- Credit/instalment customer is a useful signal for credit receipts.
- A single 1C realization can conflict across multiple OFD receipts; flag it.
- Some SABY returns do not provide a direct original receipt link. The portal
  uses fallback lookback matching for correction chains.
- SABY/OFD limit and period can hide old original receipts; use lookback data as
  evidence, not main registry rows.

## UX Direction

The business question is not "which documents exist?" but:

```text
What is wrong, who is responsible, and what should be checked?
```

Current simplified statuses should stay business-facing:

- open error
- manager check
- fixed
- information

Technical algorithm terms belong in collapsible technical details.

## Guardrails

- Do not change backend, database, SABY API or AIAgentAPI from an OFD UI task.
- Do not auto-close errors.
- Do not write to 1C or OFD.
- Keep all OFD/1C actions read-only until `OfdControlEvent V1` is designed and
  implemented.

