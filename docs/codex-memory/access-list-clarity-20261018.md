# Device list clarity — release verification, 18 October 2026

Owner approved release on 18 October. Runtime 1.5.3 (`cc650ea`) deployed and
verified; corrective 1.5.4 (`d07d92359730095aad94858c829cd7796a745bbe`) is now live.
Public build date: 2026-10-18T12:25:31.566Z (15:25 Moscow). Deployment exited 0;
container healthy, public health OK, independent SSH HEAD matches runtime commit.
Authenticated Edge footer shows 1.5.4. Magomed's latest 7 October visit is visible
above the older distinct subscription. Service view preserves Mac Бэлы and
iPhone Бэлы, including the latter's employee-account use and push subscription.

- Employee cards retain device/mode, last portal contact, notification status,
  portal version and Details. Account login, repeated normal-status explanations
  and observation timestamps moved out of the main list. Technical facts and
  push delivery details are collapsed inside the detail dialog; version and safe
  update control remain directly visible there.
- Service view groups accounts by exact stable browser ID. Labels, IP, OS and
  similar browser names never merge connections. Each account retains its own
  notification/version observations. Unidentified rows remain separate.
- Overview keeps identified browsers and distinct active subscriptions. Among
  unidentifiable legacy rows, only the latest per account/device/browser type is
  shown when no equally recent or newer identified counterpart exists. An older
  subscription must never hide a newer visit (1.5.4 regression test). This is display prioritization,
  not a physical-device match. Other device types and legacy-only employees stay
  visible; every event remains in the unchanged paginated history.
- Authenticated read-only `/connection` displays only the caller's exact browser
  comparison code. ADMIN Details shows the matching code under technical facts.
  This permits identification of dedicated Codex IAB even while signed in as an
  employee, without copying authentication cookies or guessing from Mac/Chrome.
  It performs no naming, writes or permission changes. Existing explicit owner
  assignment must follow exact code verification after deployment.
- Production Codex mapping is STILL NOT assigned. Do not present the synthetic
  Codex card in the local future preview as proof of production classification.
  User-confirmed real Mac Бэлы / iPhone Бэлы labels must remain untouched.
- Live verification found that the dedicated IAB's current connection code and
  the existing Astemir Mac/Chrome session's code differ. Session identity remains
  bound to the original authenticated session; a changed browser cookie does not
  overwrite it. A fresh normal login is needed before exact comparison and
  owner/service assignment. Do not label Mac/Chrome based on OS, IP or timing.
- Local preview uses the real component; future records are explicitly examples,
  observed data remains the labelled 18 October 14:19 snapshot, not live data.

Verification: 5 release-metadata tests, 27 UI/identity/overview tests,
17 auth/route checks (one additional DB integration check skipped), TypeScript; clean
tracked-source production build and interactive desktop/mobile review. Search
reset, Details open/close and responsive list checked. No production data,
subscriptions, 1C, auth permissions or unrelated work changed. Runtime versions
incremented using live metadata and the deployment branch. 1.5.3 was verified
by server commit, health, public build metadata and authenticated Edge footer.
Exact live Codex code matching/assignment/readback remains pending. No promise
of retroactive legacy ownership.

## Owner-confirmed historical checks, 18 October 15:47 Moscow

The owner confirmed old employee-account visits were her checks, then explicitly
excluded Astemir's Windows/Chrome (16 October 16:44) and iPhone/Safari (16 October
17:14): both are his working connections and must remain in Employees.
Using the existing ADMIN service-classification dialog (not manual DB writes),
old unidentifiable Astemir Mac/Edge, Zuhra iPhone/Safari and Magomed iPhone/Safari
records were marked service. The refreshed Employees view retains Astemir's
Windows and iPhone and Liana's current iPhone app. Astemir Mac/Chrome remains
unassigned pending the separate identity check. Service view readback confirms
the transferred history; subscriptions and access were not changed. No runtime
code/version/deployment change was needed. Marks can be reversed in Details.

Changed files:
- `components/PortalAccessDevices.tsx`
- `components/portal-access-devices.css`
- `lib/portal-access-view.ts`
- `lib/portal-access-identity.ts`
- `app/connection/page.tsx`
- `tests/portal-access-devices.test.tsx`
- `tests/access-current-browser.test.ts`
- `tests/access-self-connection.test.ts`
- `package.json`, `package-lock.json` (1.5.4)
- Local-only `app/access-clarity-review/ObservedAccessPreview.tsx`
- This handoff.
