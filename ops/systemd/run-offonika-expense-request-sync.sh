#!/bin/bash
set -euo pipefail

APP_CONTAINER=portal-app
PORTAL_PUBLIC_BASE_URL=https://portal.alebazia.xyz
: "${EXPENSE_REQUEST_ADMIN_CHAT_ID:?EXPENSE_REQUEST_ADMIN_CHAT_ID is required}"
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

for _ in $(seq 1 20); do
  claim=$(/usr/bin/docker exec "$APP_CONTAINER" node --conditions=react-server --import tsx scripts/admin-inbox-telegram-delivery.ts claim)
  has_delivery=$(printf '%s' "$claim" | /usr/bin/python3 -c 'import json,sys; print("true" if json.load(sys.stdin).get("delivery") else "false")')
  [ "$has_delivery" = true ] || break
  delivery_id=$(printf '%s' "$claim" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["delivery"]["deliveryId"])')
  lease_token=$(printf '%s' "$claim" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["delivery"]["leaseToken"])')

  set +e
  sender_result=$(printf '%s' "$claim" | /usr/sbin/runuser -u codex-vps -- env PORTAL_PUBLIC_BASE_URL="$PORTAL_PUBLIC_BASE_URL" \
    EXPENSE_REQUEST_ADMIN_CHAT_ID="$EXPENSE_REQUEST_ADMIN_CHAT_ID" \
    /usr/bin/python3 /docker/employee-testing-app/ops/systemd/send-offonika-admin-inbox-telegram.py)
  sender_status=$?
  set -e

  if [ "$sender_status" -eq 0 ]; then
    message_id=$(printf '%s' "$sender_result" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin)["messageId"])')
    /usr/bin/docker exec "$APP_CONTAINER" node --conditions=react-server --import tsx scripts/admin-inbox-telegram-delivery.ts sent \
      --delivery-id "$delivery_id" --lease-token "$lease_token" --message-id "$message_id" >/dev/null
    echo "telegram_delivery=sent delivery_id=$delivery_id"
    continue
  fi

  error_code=$(printf '%s' "$sender_result" | /usr/bin/python3 -c 'import json,sys; print(json.load(sys.stdin).get("errorCode") or "TELEGRAM_DELIVERY_FAILED")' 2>/dev/null || echo TELEGRAM_DELIVERY_FAILED)
  failure_flags=()
  [ "$sender_status" -eq 75 ] && failure_flags+=(--retryable)
  [ "$sender_status" -eq 76 ] && failure_flags+=(--uncertain)
  /usr/bin/docker exec "$APP_CONTAINER" node --conditions=react-server --import tsx scripts/admin-inbox-telegram-delivery.ts failed \
    --delivery-id "$delivery_id" --lease-token "$lease_token" --error-code "$error_code" "${failure_flags[@]}" >/dev/null
  echo "telegram_delivery=$error_code delivery_id=$delivery_id"
  break
done
