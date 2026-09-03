#!/bin/zsh
set -eu

readonly CDP_URL='http://127.0.0.1:9333/json/version'
readonly PROFILE_DIR='/Users/bela/Library/Application Support/OFFONIKA TBank Monitor'
readonly COLLECTOR='/Users/bela/Projects/employee-testing-app/scripts/tbank-cabinet-collector.mjs'
readonly NODE_BIN='/opt/homebrew/bin/node'

log() {
  /bin/date '+%Y-%m-%dT%H:%M:%S%z' | /usr/bin/tr -d '\n'
  echo " $1"
}

if ! /usr/bin/curl -fsS --max-time 2 "$CDP_URL" >/dev/null 2>&1; then
  log 'Edge control endpoint is unavailable; reopening the dedicated monitor window.' >&2
  /usr/bin/open -g -na 'Microsoft Edge' --args \
    --user-data-dir="$PROFILE_DIR" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9333 \
    --no-first-run --disable-sync \
    'https://business.tbank.ru/cashier/operations'
  # Give Edge time to restore the dedicated profile and retry in this same
  # launch instead of waiting three minutes for launchd to invoke us again.
  for _ in 1 2 3 4; do
    /bin/sleep 3
    if /usr/bin/curl -fsS --max-time 2 "$CDP_URL" >/dev/null 2>&1; then break; fi
  done
fi

if ! /bin/test -x "$NODE_BIN"; then
  log "Node runtime is unavailable at $NODE_BIN." >&2
  exit 1
fi

# A page can be briefly busy while T-Business refreshes its session. Retry
# inside one launch so one transient CDP failure cannot age the snapshot until
# the server raises a connection-loss alert.
for attempt in 1 2 3; do
  if "$NODE_BIN" "$COLLECTOR"; then exit 0; fi
  log "Collection attempt $attempt failed; retrying." >&2
  /bin/sleep 8
done

log 'All collection attempts failed.' >&2
exit 1
