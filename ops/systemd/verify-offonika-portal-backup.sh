#!/usr/bin/env bash
set -euo pipefail

BACKUP_ROOT=${BACKUP_ROOT:-/var/backups/offonika-portal}
backup_dir=${1:-}
if [[ -z "$backup_dir" ]]; then
  backup_dir=$(find "$BACKUP_ROOT" -mindepth 1 -maxdepth 1 -type d ! -name '*.tmp' -printf '%T@ %p\n' | sort -nr | head -1 | cut -d' ' -f2-)
fi
[[ -n "$backup_dir" && "$backup_dir" == "$BACKUP_ROOT"/* && -d "$backup_dir" ]] || { echo 'safe backup directory not found' >&2; exit 1; }
for file in postgres.dump uploads.tar.gz SHA256SUMS; do
  [[ -s "$backup_dir/$file" ]] || { echo "missing backup file: $file" >&2; exit 1; }
done

(cd "$backup_dir" && sha256sum -c SHA256SUMS)
if tar -tzf "$backup_dir/uploads.tar.gz" | grep -Eq '(^/|(^|/)\.\.(/|$))'; then
  echo 'unsafe path in uploads archive' >&2
  exit 1
fi

restore_dir=$(mktemp -d)
cleanup() { rm -rf "$restore_dir"; }
trap cleanup EXIT
tar -xzf "$backup_dir/uploads.tar.gz" -C "$restore_dir"
upload_files=$(find "$restore_dir/uploads" -type f 2>/dev/null | wc -l)

database_tables=$(docker run --rm --user postgres \
  -v "$backup_dir/postgres.dump:/backup/postgres.dump:ro" \
  postgres:16-alpine sh -euc '
    initdb -D /tmp/pgdata >/dev/null
    pg_ctl -D /tmp/pgdata -o "-h 127.0.0.1" -w start >/dev/null
    createdb -h 127.0.0.1 restore_check
    pg_restore -h 127.0.0.1 -d restore_check --no-owner --no-privileges /backup/postgres.dump
    psql -h 127.0.0.1 -d restore_check -Atc "select count(*) from pg_tables where schemaname = '\''public'\'';"
  ')
[[ "$database_tables" =~ ^[0-9]+$ && "$database_tables" -gt 0 ]] || { echo 'restored database has no public tables' >&2; exit 1; }

echo "restore_verify_ok backup=$(basename "$backup_dir") database_tables=$database_tables upload_files=$upload_files"
