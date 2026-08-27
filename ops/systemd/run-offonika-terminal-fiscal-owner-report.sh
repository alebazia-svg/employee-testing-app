#!/usr/bin/env bash
set -euo pipefail

APP_CONTAINER="${APP_CONTAINER:-portal-app}"
REPORT=$(/usr/bin/docker exec "$APP_CONTAINER" node --conditions=react-server --import tsx scripts/terminal-fiscal-owner-report.ts)
printf '%s' "$REPORT" | /usr/bin/python3 /docker/employee-testing-app/ops/systemd/send-offonika-terminal-fiscal-report.py
