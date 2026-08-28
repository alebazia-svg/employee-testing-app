#!/usr/bin/env bash
set -euo pipefail

YANDEX_TOKEN_FILE=${YANDEX_TOKEN_FILE:-$HOME/.config/1c-integration/yandex-token}
OFFSITE_PRIVATE_KEY=${OFFSITE_PRIVATE_KEY:-$HOME/.config/offonika-portal/offsite-backup-private.pem}
OFFSITE_CERT_FILE=${OFFSITE_CERT_FILE:-$HOME/.config/offonika-portal/offsite-backup-cert.pem}
YANDEX_BACKUP_DIR=${YANDEX_BACKUP_DIR:-app:/Offonika_Portal_Backups}

for file in "$YANDEX_TOKEN_FILE" "$OFFSITE_PRIVATE_KEY" "$OFFSITE_CERT_FILE"; do
  [[ -f "$file" && ! -L "$file" ]] || { echo 'required readback credential unavailable' >&2; exit 1; }
done
work_dir=$(mktemp -d)
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT
token=$(tr -d '\r\n' < "$YANDEX_TOKEN_FILE")
urlencode() { python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }

curl --fail --silent --show-error -H "Authorization: OAuth $token" \
  "https://cloud-api.yandex.net/v1/disk/resources?path=$(urlencode "$YANDEX_BACKUP_DIR")&limit=100&fields=_embedded.items.name,_embedded.items.size" \
  -o "$work_dir/list.json"
latest=$(python3 - "$work_dir/list.json" <<'PY'
import json, re, sys
items=json.load(open(sys.argv[1])).get('_embedded',{}).get('items',[])
names=[i.get('name','') for i in items if re.match(r'^offonika-portal-\d{8}T\d{6}Z\.tar\.cms$', i.get('name',''))]
if not names: raise SystemExit('no encrypted offsite backup found')
print(max(names))
PY
)

download() {
  local remote_name=$1 target=$2 response href
  response=$(curl --fail --silent --show-error -H "Authorization: OAuth $token" \
    "https://cloud-api.yandex.net/v1/disk/resources/download?path=$(urlencode "$YANDEX_BACKUP_DIR/$remote_name")")
  href=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["href"])' <<<"$response")
  curl --fail --silent --show-error --location "$href" -o "$target"
}

download "$latest" "$work_dir/$latest"
download "$latest.sha256" "$work_dir/$latest.sha256"
(cd "$work_dir" && sha256sum -c "$latest.sha256" >/dev/null)
openssl cms -decrypt -binary -inform DER -in "$work_dir/$latest" \
  -recip "$OFFSITE_CERT_FILE" -inkey "$OFFSITE_PRIVATE_KEY" -out "$work_dir/bundle.tar"
mkdir "$work_dir/restored"
tar -xf "$work_dir/bundle.tar" -C "$work_dir/restored"
(cd "$work_dir/restored" && sha256sum -c SHA256SUMS >/dev/null)
tar -tzf "$work_dir/restored/uploads.tar.gz" >/dev/null
if command -v pg_restore >/dev/null 2>&1; then
  database_entries=$(pg_restore --list "$work_dir/restored/postgres.dump" 2>/dev/null | grep -vc '^;' || true)
elif command -v docker >/dev/null 2>&1; then
  database_entries=$(docker run --rm -v "$work_dir/restored/postgres.dump:/backup/postgres.dump:ro" postgres:16-alpine \
    pg_restore --list /backup/postgres.dump 2>/dev/null | grep -vc '^;' || true)
else
  echo 'pg_restore or Docker is required for database validation' >&2
  exit 1
fi
[[ "$database_entries" =~ ^[0-9]+$ && "$database_entries" -gt 0 ]] || { echo 'decrypted database dump is invalid' >&2; exit 1; }
echo "offsite_readback_ok backup=${latest%.tar.cms} database_entries=$database_entries"
