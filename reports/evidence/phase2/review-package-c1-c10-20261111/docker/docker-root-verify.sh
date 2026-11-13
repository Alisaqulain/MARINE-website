#!/usr/bin/env bash
# Read-only verification: does the root password stored in marina-dev-mongo's Docker configuration
# still authenticate? Prints only USABLE / NOT USABLE. No value is printed or leaves the container.
# Also confirms the app user still connects (via the project's own `dev:db verify`, run separately).
set -uo pipefail
C=marina-dev-mongo
echo "Stored root credential check, $(date -u +%FT%TZ), container $C"
docker exec "$C" mongosh --quiet "mongodb://127.0.0.1:27017/admin" --eval '
  try {
    const r = db.getSiblingDB("admin").auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD);
    print("stored root credential: " + (r && r.ok === 1 ? "USABLE  <-- remediation NOT effective" : "NOT USABLE"));
  } catch (e) { print("stored root credential: NOT USABLE (" + e.codeName + ")"); }'
echo "unauthenticated listDatabases:"
docker exec "$C" mongosh --quiet "mongodb://127.0.0.1:27017/admin" --eval 'try { db.adminCommand({listDatabases:1}); print("  ALLOWED (problem)") } catch (e) { print("  refused (" + e.codeName + ")") }'
