# T-Bank cabinet collector

Purpose: close the documented QR gap in the public T-Bank acquiring API while
keeping bank access least-privilege and outside VPS.

## Security boundary

- A dedicated Edge profile uses a T-Business employee with `Кассы и эквайринг:
  Наблюдатель` only. It has no accounts, payments or signing rights.
- The browser listens only on `127.0.0.1:9333` on the owner's Mac.
- The collector never reads or exports cookies, storage, passwords or SMS.
- The uploaded JSON contains only operation ID, card RRN where available, time, amount in kopecks,
  debit/credit type, card/SBP source and the mapped terminal ID.
- Delivery uses the owner's existing SSH key and an atomic rename. The VPS does
  not receive the T-Business session.
- Portal matching fails closed when the snapshot is older than ten minutes,
  does not cover the requested period, contains an unknown operation, or is
  otherwise incomplete.
- A cabinet/CDP request is bounded by a 20-second timeout. A failed attempt
  never overwrites the last valid snapshot and the LaunchAgent retries later.

## Mac runtime

- Dedicated profile: `~/Library/Application Support/OFFONIKA TBank Monitor`
- Collector: `scripts/tbank-cabinet-collector.mjs`
- Wrapper: `scripts/tbank-cabinet-monitor.sh`
- LaunchAgent: `ru.offonika.tbank-cabinet-monitor`
- Interval: three minutes
- Logs: `~/Library/Logs/offonika-tbank-monitor.log` and
  `~/Library/Logs/offonika-tbank-monitor.error.log`

The dedicated Edge window may stay in the background. If T-Business asks for a
new login, only the owner enters the password or SMS. Until login is restored,
the portal receives no fresh snapshot and the source becomes incomplete.

## Production rollout

The compose mount exposes `/home/bela/offonika-tbank-cabinet/current.json` to
the portal read-only. Keep `TBANK_CABINET_SNAPSHOT_ENABLED=false` during an
initial shadow comparison. Production was enabled only after card and QR totals
and both terminal mappings were verified against the cabinet, 1C and OFD.
