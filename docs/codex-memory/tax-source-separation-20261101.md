# Tax source separation — owner-approved correction, 2026-11-01

Status: implemented and locally verified; NOT released. No new runtime version
assigned. Preserve newer deployment changes when preparing the release.

Owner requires three distinct sources: FNS accepted income, actual bank/KKT
payments, and 1C accounting. Actual headroom must not be inferred from an
unverified accounting report or the smaller of two scenarios.

The overview now leads with the source table. FNS remains a dated snapshot;
actual payments and standalone 1C balances explicitly remain unconfirmed.
The existing combined 1C-bank-documents/KKT report, forecast, calculator,
reconciliation, archive and income structure are retained and clearly labelled.
The five-VTB scenario is retained as a limited conditional scenario. Telegram,
FNS, 1C, canonical runner and database schema are unchanged.

Code commits: d329d6e and 2ee8513. Tests: 8 existing evidence tests plus 2 source
separation render tests; TypeScript and production build passed. Real development
preview uses existing AdminShell/TaxesWorkspace and saved owner sources, without
DB access or writes: localhost:3236/taxes-development-preview?scenario=audit.
Desktop and 390px mobile reviewed; viewport reset. Preview fixtures remain
explicitly labelled and are unavailable outside development.

Primary bank evidence was found in the existing bank.integration Mail.ru
account: VTB regular daily thread (83 messages in list), Alfa daily statements
including 2026-10-31. Download through Edge returned ERR_BLOCKED_BY_CLIENT.
Do not weaken browser security. Existing server bank-mail.env is readable only
by root/bankstmt. Prepared separate read-only IMAP helper in /tmp, EXAMINE and
BODY.PEEK, no 1C calls and no mailbox mutations. Exact sudo approval requested
and not yet received. Do not run the live bank statement automation pipeline.

Read-only helper SHA256:
9e57c478ddbd105117b91bcf4d3e9fd77fdd11d0d34a4f20a5b7a8beb3cd4893

Pending: obtain exact sudo authority for that read; download/verify originals,
resolve bank/KKT overlap and returns; independently confirm completeness before
publishing actual headroom. New portal release requires its own applicable sudo
scope, fresh version/branch check, rollback image gate and authenticated UI readback.
The current real annual headroom has NOT been established.
