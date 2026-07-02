# AIAgentAPI Boundary Playbook

## Ownership Boundary

The portal repo consumes AIAgentAPI. It does not own production 1C extension
release management.

Portal changes belong here:

- UI that displays 1C data;
- `lib/one-c.ts` client calls;
- portal API routes and parsing;
- PostgreSQL state owned by the portal.

AIAgentAPI changes belong in the separate `ai-business-os` workspace:

- BSL module code;
- HTTP service URL templates and rights;
- extension packages;
- release notes;
- Yandex Disk release metadata.

## Before Assuming A 1C Endpoint Is Missing

Check all three:

1. live `/hs/agent/version`;
2. AIAgentAPI release memory/regламент in `ai-business-os`;
3. portal client usage in `lib/one-c.ts`.

Production 1C release truth is Yandex Disk `/AgentAPI_Project` plus live
`/version`. Local source may be older than production.

## Safe 1C Rules

- Read-only first.
- Do not write to 1C documents, registers or SQL.
- Do not install a package with a lower version than production.
- Do not build a production AIAgentAPI package from stale local source.
- For manual probes, keep them explicitly temporary until promoted into a
  versioned release.
- Never store passwords, tokens, SQL dumps or customer report dumps in this repo.

## Portal Integration Rules

- If an AIAgentAPI response has unreliable `has_more`, paginate by `offset` and
  stop on short page plus safety cap.
- Preserve human fallback states when 1C is unavailable.
- For business UI, hide raw AIAgentAPI fields under technical details.
- If data quality is uncertain, say so in UI/report instead of inventing a
  confident match.

