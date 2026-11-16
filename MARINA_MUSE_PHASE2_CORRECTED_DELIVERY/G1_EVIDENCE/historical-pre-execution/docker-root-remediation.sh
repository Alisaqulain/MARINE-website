#!/usr/bin/env bash
# Remediation for the local test database's stored root credential (marina-dev-mongo ONLY).
# PREPARED, NOT RUN: the agent's permission check refused it on 10 Nov 2026 (shared resource).
# Run it yourself, or authorize the agent to run it. It touches only the Marina test container.
#
# What it does (no value is printed, written to disk or placed on a command line):
#   1. inside the container, authenticates as devroot using the value Docker stored at creation
#      (read from the container's own environment by mongosh JavaScript);
#   2. changes devroot's password to 48 random bytes generated in-container and immediately discarded;
#   3. re-checks that the stored value no longer authenticates, and that the app user still works.
# Effect: the password visible in `docker inspect` becomes a dead credential. The app user
# (marina_dev_app, readWrite on marina_muse_dev only) is unchanged, so the app, seed and verify keep working.
# Root is only used by `npm run dev:db -- setup`; if root is ever needed again, rebuild the test DB with
# `npm run dev:db -- reset --yes` then `setup` + `seed` (test data only).
set -euo pipefail
C=marina-dev-mongo
docker inspect "$C" --format '{{.Config.Image}}' | grep -q '^mongo:' || { echo "refusing: $C is not the Marina mongo test container"; exit 2; }
docker exec "$C" mongosh --quiet "mongodb://127.0.0.1:27017/admin" --eval '
  const admin = db.getSiblingDB("admin");
  admin.auth(process.env.MONGO_INITDB_ROOT_USERNAME, process.env.MONGO_INITDB_ROOT_PASSWORD);
  const fresh = require("crypto").randomBytes(48).toString("base64url");
  admin.changeUserPassword(process.env.MONGO_INITDB_ROOT_USERNAME, fresh);
  print("devroot password replaced (fresh value generated in-container and discarded)");'
bash "$(dirname "$0")/docker-root-verify.sh"
