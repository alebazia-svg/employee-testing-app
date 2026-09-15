#!/bin/bash
set -euo pipefail

APP_CONTAINER=portal-app

/usr/bin/docker exec "$APP_CONTAINER" node --conditions=react-server --import tsx \
  scripts/procurement-forecast-snapshot.ts --confirm-snapshot-write
