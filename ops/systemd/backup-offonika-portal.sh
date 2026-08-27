#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/offonika-portal}
RETENTION_DAYS=${RETENTION_DAYS:-14}
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
TARGET="$BACKUP_ROOT/$STAMP"
TMP="$TARGET.tmp"

install -d -m 0700 "$TMP"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT
docker exec portal-postgres sh -lc 'exec pg_dump -Fc -U "$POSTGRES_USER" "$POSTGRES_DB"' > "$TMP/postgres.dump"
docker exec portal-app tar -C /app -czf - uploads > "$TMP/uploads.tar.gz"
test -s "$TMP/postgres.dump"
test -s "$TMP/uploads.tar.gz"
(cd "$TMP" && sha256sum postgres.dump uploads.tar.gz > SHA256SUMS && sha256sum -c SHA256SUMS)
mv "$TMP" "$TARGET"
trap - EXIT
find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d -mtime "+$RETENTION_DAYS" -exec rm -rf -- {} +
echo "backup_ok=$TARGET"
