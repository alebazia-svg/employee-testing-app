#!/usr/bin/env bash
set -euo pipefail

YANDEX_TOKEN_FILE=${YANDEX_TOKEN_FILE:-/etc/offonika-portal/yandex-token}
YANDEX_BACKUP_DIR=${YANDEX_BACKUP_DIR:-app:/Offonika_Portal_Backups}
MAX_AGE_HOURS=${MAX_AGE_HOURS:-30}

[[ -f "$YANDEX_TOKEN_FILE" && ! -L "$YANDEX_TOKEN_FILE" ]] || { echo 'offsite token file unavailable' >&2; exit 1; }
token=$(tr -d '\r\n' < "$YANDEX_TOKEN_FILE")
encoded=$(python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$YANDEX_BACKUP_DIR")
payload_file=$(mktemp)
trap 'rm -f "$payload_file"' EXIT
curl --fail --silent --show-error -H "Authorization: OAuth $token" \
  "https://cloud-api.yandex.net/v1/disk/resources?path=$encoded&limit=100&fields=_embedded.items.name,_embedded.items.created,_embedded.items.size" \
  -o "$payload_file"
python3 - "$MAX_AGE_HOURS" "$payload_file" <<'PY'
import datetime as dt, json, re, sys
max_age = int(sys.argv[1])
data = json.load(open(sys.argv[2]))
items = data.get('_embedded', {}).get('items', [])
pattern = re.compile(r'^offonika-portal-(\d{8}T\d{6}Z)\.tar\.cms$')
copies = []
for item in items:
    match = pattern.match(item.get('name', ''))
    if match and int(item.get('size', 0)) > 0:
        copies.append((dt.datetime.strptime(match.group(1), '%Y%m%dT%H%M%SZ').replace(tzinfo=dt.timezone.utc), item))
if not copies:
    raise SystemExit('no encrypted offsite backup found')
created, item = max(copies, key=lambda value: value[0])
age_hours = (dt.datetime.now(dt.timezone.utc) - created).total_seconds() / 3600
if age_hours > max_age:
    raise SystemExit(f'latest offsite backup is stale: {age_hours:.1f}h')
print(f'offsite_backup_fresh age_hours={age_hours:.1f} encrypted_bytes={item["size"]}')
PY
