# Cash handover release 1.25.31

Installed 28 November 2026 Moscow time. Runtime commit
`a5fad32b596e86225a318cd95e8307ad027028a9`, built
`2026-11-27T20:10:16.951Z`. Guarded release session
`f371fe9bf5164b508305cf9ff538a0ca` reached COMPLETE.

The shift handover explains the cash limit in the form. A separately posted
cash transfer after the saved count requires a fresh personal cash count.
When closing a retail store, transfer to the shared reserve also requires
its fresh count. No schema, Compose or AIAgentAPI deployment changes.

Before installation, isolated PostgreSQL tests covered both transfer paths,
retail destinations, KKM blocking and retry with simulated 1C/KKM evidence,
and both form registration orders. Employee and ADMIN preview were compared
on the same isolated records. After installation, the server SHA, public
metadata, login HTTP status, authenticated ADMIN version label, and read-only
wholesale and retail cabinets were checked. No live cash transfer or shift
closure was submitted during production verification.

Verified current image:
`sha256:5b3b358927a246decf371451d29a01897ff2092c3dcdf426f44c2dcb34a3c7fa`.
The previous image (1.25.30) and second reserve (1.25.29) remained present
and pinned after registration. The exact archive was retained on the build host.
