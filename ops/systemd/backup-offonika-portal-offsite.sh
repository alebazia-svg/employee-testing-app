#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/offonika-portal}
YANDEX_TOKEN_FILE=${YANDEX_TOKEN_FILE:-/etc/offonika-portal/yandex-token}
OFFSITE_CERT_FILE=${OFFSITE_CERT_FILE:-/etc/offonika-portal/offsite-backup-cert.pem}
YANDEX_BACKUP_DIR=${YANDEX_BACKUP_DIR:-app:/Offonika_Portal_Backups}

[[ -f "$YANDEX_TOKEN_FILE" && ! -L "$YANDEX_TOKEN_FILE" ]] || { echo 'offsite token file unavailable' >&2; exit 1; }
[[ -f "$OFFSITE_CERT_FILE" && ! -L "$OFFSITE_CERT_FILE" ]] || { echo 'offsite encryption certificate unavailable' >&2; exit 1; }
[[ $(stat -c '%a' "$YANDEX_TOKEN_FILE") == 600 ]] || { echo 'offsite token permissions must be 0600' >&2; exit 1; }

backup_dir=$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '*.tmp' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
[[ -n "$backup_dir" && "$backup_dir" == "$BACKUP_ROOT"/* && -d "$backup_dir" ]] || { echo 'safe local backup directory not found' >&2; exit 1; }
for file in postgres.dump uploads.tar.gz SHA256SUMS; do
  [[ -s "$backup_dir/$file" ]] || { echo "missing local backup file: $file" >&2; exit 1; }
done
(cd "$backup_dir" && sha256sum -c SHA256SUMS >/dev/null)

stamp=$(basename "$backup_dir")
[[ "$stamp" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || { echo 'unexpected backup directory name' >&2; exit 1; }
work_dir=$(mktemp -d)
cleanup() { rm -rf "$work_dir"; }
trap cleanup EXIT
encrypted="$work_dir/offonika-portal-$stamp.tar.cms"
checksum="$encrypted.sha256"

tar -C "$backup_dir" -cf - postgres.dump uploads.tar.gz SHA256SUMS \
  | openssl cms -encrypt -binary -stream -aes-256-cbc -outform DER -out "$encrypted" "$OFFSITE_CERT_FILE"
test -s "$encrypted"
(cd "$work_dir" && sha256sum "$(basename "$encrypted")" > "$(basename "$checksum")")

token=$(tr -d '\r\n' < "$YANDEX_TOKEN_FILE")
urlencode() { python3 -c 'import sys, urllib.parse; print(urllib.parse.quote(sys.argv[1], safe=""))' "$1"; }
api() { curl --fail --silent --show-error -H "Authorization: OAuth $token" "$@"; }

dir_code=$(curl --silent --show-error -o "$work_dir/create-dir.json" -w '%{http_code}' -X PUT \
  -H "Authorization: OAuth $token" \
  "https://cloud-api.yandex.net/v1/disk/resources?path=$(urlencode "$YANDEX_BACKUP_DIR")")
[[ "$dir_code" == 201 || "$dir_code" == 409 ]] || { echo "cannot prepare offsite directory: HTTP $dir_code" >&2; exit 1; }

upload_file() {
  local source=$1 remote_name=$2 response href
  response=$(api "https://cloud-api.yandex.net/v1/disk/resources/upload?path=$(urlencode "$YANDEX_BACKUP_DIR/$remote_name")&overwrite=false")
  href=$(python3 -c 'import json,sys; print(json.load(sys.stdin)["href"])' <<<"$response")
  curl --fail --silent --show-error --upload-file "$source" "$href" >/dev/null
}

upload_file "$encrypted" "$(basename "$encrypted")"
upload_file "$checksum" "$(basename "$checksum")"

metadata=$(api "https://cloud-api.yandex.net/v1/disk/resources?path=$(urlencode "$YANDEX_BACKUP_DIR/$(basename "$encrypted")")&fields=size,sha256")
remote_size=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("size", 0))' <<<"$metadata")
remote_sha=$(python3 -c 'import json,sys; print(json.load(sys.stdin).get("sha256", ""))' <<<"$metadata")
local_size=$(stat -c '%s' "$encrypted")
local_sha=$(sha256sum "$encrypted" | cut -d' ' -f1)
[[ "$remote_size" == "$local_size" && "$remote_sha" == "$local_sha" ]] || { echo 'offsite readback metadata mismatch' >&2; exit 1; }

echo "offsite_backup_ok=$stamp encrypted_bytes=$local_size"
