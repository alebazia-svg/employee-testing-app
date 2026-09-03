#!/bin/zsh
set -eu

readonly CDP_URL='http://127.0.0.1:9333/json/version'
readonly PROFILE_DIR='/Users/bela/Library/Application Support/OFFONIKA TBank Monitor'
readonly COLLECTOR='/Users/bela/Projects/employee-testing-app/scripts/tbank-cabinet-collector.mjs'

if ! /usr/bin/curl -fsS --max-time 2 "$CDP_URL" >/dev/null 2>&1; then
  /usr/bin/open -g -na 'Microsoft Edge' --args \
    --user-data-dir="$PROFILE_DIR" \
    --remote-debugging-address=127.0.0.1 \
    --remote-debugging-port=9333 \
    --no-first-run --disable-sync \
    'https://business.tbank.ru/cashier/operations'
  exit 1
fi

/opt/homebrew/bin/node "$COLLECTOR"
