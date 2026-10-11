#!/usr/bin/env bash
# Read-only PM2 / port audit — safe to run alongside marina-muse and marina-upload.
set -euo pipefail

echo "=== PM2 list ==="
pm2 list

echo ""
echo "=== excelpro ==="
pm2 describe excelpro 2>/dev/null || echo "(excelpro not registered)"

echo ""
echo "=== marina-muse (not modified) ==="
pm2 describe marina-muse 2>/dev/null || echo "(marina-muse not registered)"

echo ""
echo "=== marina-upload (not modified) ==="
pm2 describe marina-upload 2>/dev/null || echo "(marina-upload not registered)"

echo ""
echo "=== Listeners :3000 :3002 (typical Next ports) ==="
ss -tlnp 2>/dev/null | grep -E ':3000 |:3002 ' || echo "(none)"

echo ""
echo "If excelpro shows exec_mode cluster or instances > 1, fix ecosystem to fork + instances 1."
echo "If two PIDs bind :3000, EADDRINUSE will loop — resolve duplicate excelpro/manual next start before reload."
