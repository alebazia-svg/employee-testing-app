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

## Architecture Direction

Do not keep solving OFD control with only server-rendered diagnostics forever.
The agreed next serious step is a database-backed `OfdControlEvent V1`:

- detected event;
- business status;
- assigned manager;
- evidence snapshot;
- deadline;
- notification state;
- resolution/confirmation state.

Until that model exists, `/admin/ofd` should stay read-only and avoid pretending
that temporary classifications are permanent case management.

## Before Changing Matching

Ask:

- Are we changing data loading, candidate scoring or only presentation?
- Does the issue come from missing OFD rows, missing 1C pages, weak product
  matching, date parsing, amount mismatch, or AIAgentAPI data quality?
- Are returns being treated as real товарный возврат or receipt correction
  `приход -> возврат -> новый приход`?
- Is the selected period hiding old original receipts? Lookback may be needed.
- Is 1C production endpoint version current enough for the portal expectation?

## Guardrails

- Do not change backend, database, SABY API or AIAgentAPI from an OFD UI task.
- Do not auto-close errors.
- Do not write to 1C or OFD.
- Keep all OFD/1C actions read-only until `OfdControlEvent V1` is designed and
  implemented.
- Do not add Prisma OFD models casually. If future DB work appears early, park
  it in `.wip/` until the user explicitly starts `OfdControlEvent`.

## Terminal Fiscal Matching Production Runtime

The isolated read-only `T-Bank -> 1C -> Platforma OFD` matching audit runs in
production without employee UI, notifications or incidents.

- `portal-app` and `agentapi-read-proxy` share the internal Docker network
  `offonika-agentapi-read`; no proxy port is published externally.
- `PLATFORMA_OFD_PROXY_BASE_URL` in portal `server.env` contains only the
  internal proxy URL. The Platforma OFD token remains inside AgentAPI.
- The proxy's `agentapi-read-proxy.service` has a systemd drop-in that restores
  the network attachment whenever the proxy container is recreated.
- `offonika-terminal-fiscal-current.timer` runs every 5 minutes using a
  completed bucket with a 10-minute source delay. The practical first complete
  check therefore happens about 10-15 minutes after a bank operation.
- `offonika-terminal-fiscal-final.timer` finalizes the previous Moscow day at
  00:14.
- T-Bank calendar-day reads are split into windows no longer than 12 hours to
  avoid the provider's exact 24-hour boundary behavior.
- `pending`, `unavailable` and `needs_review` stay non-accusatory. Source delay
  alone must not convert them to `mismatch`.
