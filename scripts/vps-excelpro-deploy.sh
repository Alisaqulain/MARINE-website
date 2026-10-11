#!/usr/bin/env bash
# Safe deploy for excelpro ONLY — run on the VPS as a user with rights to /var/www/excelpro and pm2 excelpro.
# Does NOT stop marina-muse or marina-upload. Does NOT modify MongoDB data.
set -euo pipefail

APP_NAME="excelpro"
APP_DIR="/var/www/excelpro"
BACKUP_DIR="/var/backups/excelpro"
STAMP="$(date +%Y%m%d-%H%M%S)"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"

echo "==> Pre-flight: PM2 excelpro (read-only)"
pm2 describe "$APP_NAME" || { echo "PM2 app $APP_NAME not found"; exit 1; }
pm2 describe "$APP_NAME" | grep -E "exec mode|instances|PORT|script path" || true

echo "==> Port 3000 listeners (inspect only — do not kill from this script)"
ss -tlnp 2>/dev/null | grep ':3000 ' || true

echo "==> Backup code + env (no secrets printed)"
mkdir -p "$BACKUP_DIR"
tar -czf "$BACKUP_DIR/${APP_NAME}-${STAMP}.tgz" \
  -C "$APP_DIR" \
  --exclude=node_modules \
  --exclude=.next/cache \
  package.json package-lock.json next.config.ts tsconfig.json lib app components auth.ts middleware.ts \
  .env.production.local 2>/dev/null || \
tar -czf "$BACKUP_DIR/${APP_NAME}-${STAMP}.tgz" \
  -C "$APP_DIR" \
  --exclude=node_modules \
  --exclude=.next/cache \
  package.json package-lock.json next.config.ts tsconfig.json lib app components auth.ts middleware.ts

echo "==> Install + build"
cd "$APP_DIR"
npm ci
npm run build

echo "==> Mongo connectivity (must OK before restart)"
npm run check:mongo

echo "==> Graceful PM2 reload excelpro only"
pm2 reload "$APP_NAME" --update-env

echo "==> Wait for HTTP health"
for i in $(seq 1 30); do
  if curl -sf "$HEALTH_URL" >/tmp/excelpro-health.json 2>/dev/null; then
    echo "Health response:"
    cat /tmp/excelpro-health.json
    rm -f /tmp/excelpro-health.json
    echo "Deploy finished. Verify Atlas connection count in the Atlas UI."
    exit 0
  fi
  sleep 2
done

echo "Health check failed: $HEALTH_URL"
pm2 logs "$APP_NAME" --lines 40 --nostream
exit 1
