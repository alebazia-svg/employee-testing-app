#!/usr/bin/env bash
set -euo pipefail

APP_CONTAINER="${APP_CONTAINER:-portal-app}"
STATUS_PATH="${TERMINAL_FISCAL_OWNER_STATUS_PATH:-/var/lib/offonika-terminal-fiscal/owner-report.json}"
STATUS_GROUP="${TERMINAL_FISCAL_OWNER_STATUS_GROUP:-codex-vps}"
REPORT=$(/usr/bin/docker exec "$APP_CONTAINER" node --conditions=react-server --import tsx scripts/terminal-fiscal-owner-report.ts)

STATUS_DIR=$(dirname "$STATUS_PATH")
/usr/bin/install -d -m 0750 -o root -g "$STATUS_GROUP" "$STATUS_DIR"
TEMP_STATUS=$(/usr/bin/mktemp "$STATUS_DIR/.owner-report.XXXXXX")
trap '/usr/bin/rm -f "$TEMP_STATUS"' EXIT
printf '%s\n' "$REPORT" > "$TEMP_STATUS"
/usr/bin/chown root:"$STATUS_GROUP" "$TEMP_STATUS"
/usr/bin/chmod 0640 "$TEMP_STATUS"
/usr/bin/mv -f "$TEMP_STATUS" "$STATUS_PATH"
trap - EXIT

printf '%s' "$REPORT" | /usr/bin/python3 /docker/employee-testing-app/ops/systemd/send-offonika-terminal-fiscal-report.py
