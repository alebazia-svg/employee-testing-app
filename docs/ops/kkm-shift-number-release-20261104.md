# OFD receipt shift identity — verified production 1.21.25

Owner explicitly approved correcting the equal-minute case, deploying it and
checking all employees while preserving photo/not-printed fallback and existing
behavior. Runtime commit: `19bb846435b2fd9b57b86edb99b1ac135c526f42` (code fix
`be8a160`). Public build: `2026-11-04T19:25:16.619Z` /22:25MSK.
Image: `sha256:93d27b467ad4d58346802778550752d84302c9be8c09d3238635c4fb2cabfe78`.

## Exact difference

The portal retains the already supplied optional positive OFD receipt shift
number as `fiscalShiftNumber`. A receipt and closing report with equal timestamps
can confirm when KKT, FN and fiscal shift identity match. Different/missing/
conflicting identity retains fallback; known empty reopenings stay supported.
Equal-time receipts on one FN use numeric fiscal document order, not response
array order. Conflicting same-document identity remains unconfirmed.

No employee layout/copy/action, accounting formula, notification policy, timer
unit, env setting, source credentials or database schema changed in this patch.
The separate authorized cash/photo release1.21.24 was preserved: this deployment
waited for its successful completion, included its exact code, checked its already
applied migration READ ONLY and did not execute migrations or alter its flags.

## Verified behavior

- Local focus44 passed; merged workday269+10 passed; terminal-fiscal295 passed,
  one existing environment-dependent test skipped, plus2 presentation checks passed.
  Typecheck, production build and release-metadata5 checks passed.
- Real authenticated task PATCH on dedicated disposable local DB: stored OFD
  proof plus equal-minute receipt352 closes without a photo; source outage
  closes via photo and via not-printed. Cash input history retained. Photo
  metadata was seeded in this local test; physical phone camera not exercised.
- Installed image, network-isolated test container:25 tests passed, none skipped.
  Covers the actual DTO shape, source order reversal, later unmatched shift,
  missing/invalid shift numbers, FN/KKT separation and all existing fallback cases.
- Production source verifier with forced READ ONLY DB transactions: Milana's
  November2 shift83 confirmed; Zukhra's November3 shift352 confirmed, with
  receipt shift352 and both KKT closures351/352 retained in source evidence;
  Magomed's November4 shift353 confirmed. Report and receipt reads complete.
- All7 active employees /39 handovers (October24–November4) checked:0 active
  false photo requests,0 false ADMIN alerts,0 active related employee notices.
  Runtime photo-mandatory policy remains false. No historical task was rewritten
  to substitute later physical KKT events for its original saved evidence.
- Existing notification and OFD service/timer definitions compared identical;
  `server.env` hash unchanged. Dedicated minute timer active, scheduled19:33UTC
  execution succeeded with exit0; persistent fiscal/upload volumes preserved.
- 182 protected saved records compared equal: payroll runs/results and completed
  handover facts, cash/reserve/photos/original audit/input history/confirmation.
- Server commit, public version/build and authenticated ADMIN footer independently
  checked. Public `revision:null` / `source:unknown` is unchanged metadata behavior;
  commit/image identity was verified separately. Health returned `ok:true`.
- Release workflow exited0 and registered current plus two existing verified
  rollback images. Final free space18,089,246,720 bytes /16.85GiB; no volume cleanup.
  Reserves: `sha256:fe6f54339c4591657f6e35c236d2f7693c91d77ef3e9304f754d20b6900014ab`
  and `sha256:242a2ad2dc9a810fa28f521d41752a79f6643deab468dc635a152dfb64347d53`.

## Changed files

- `lib/terminal-fiscal-matching.ts`
- `lib/terminal-fiscal-ofd-adapter.ts`
- `lib/kkm-shift-close-control.ts`
- `tests/kkm-close-durable-chain.test.ts`
- `tests/terminal-fiscal-ofd-adapter.test.ts`
- `package.json`, `package-lock.json`
- This release note, prior release follow-up and project index (separate docs commit).

Evidence is local in `output/kkm-shift-number-release-20261104/`: release log,
all-employee source audit, metadata, authenticated screenshot and local test logs.
Unrelated `.cache/` and `output/` contents were preserved. Runtime/photo failures
were simulated only on isolated data/image; no production outage was induced.
