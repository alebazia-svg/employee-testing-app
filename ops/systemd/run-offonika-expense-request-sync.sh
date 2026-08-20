#!/bin/bash
set -euo pipefail

APP_CONTAINER=portal-app
FROM_DATE=$(TZ=Europe/Moscow date -d '30 days ago' +%F)
TO_DATE=$(TZ=Europe/Moscow date -d 'tomorrow' +%F)

sync_result=$(/usr/bin/docker exec "$APP_CONTAINER" node --conditions=react-server --import tsx scripts/expense-request-admin-sync.ts \
  --from "${FROM_DATE}T00:00:00+03:00" \
  --to "${TO_DATE}T00:00:00+03:00" \
  --confirm-audit-write \
  --queue-telegram)
printf '%s\n' "$sync_result"
source_complete=$(printf '%s' "$sync_result" | /usr/bin/python3 -c 'import json,sys; print("true" if json.load(sys.stdin).get("sourceComplete") is True else "false")')
if [ "$source_complete" != true ]; then
  echo 'EXPENSE_REQUEST_SOURCE_INCOMPLETE'
  exit 1
fi
