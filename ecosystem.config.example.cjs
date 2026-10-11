/**
 * PM2 example for /var/www/excelpro — copy to ecosystem.config.cjs on the VPS.
 * Do NOT put MONGODB_URI here; use .env.production.local in the app cwd.
 *
 * EADDRINUSE on :3000 usually means:
 * - PM2 cluster mode with instances > 1 (each tries to bind the same port)
 * - A second app (or stale next start) already listening on 3000
 * - PM2 restart loop before the old process releases the port
 *
 * Fix: one fork instance per Next app, unique PORT per app, kill_timeout, no duplicate PM2 entries.
 */
module.exports = {
  apps: [
    {
      name: "excelpro",
      cwd: "/var/www/excelpro",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      exp_backoff_restart_delay: 3000,
      kill_timeout: 8000,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
        PORT: "3000",
        /** excelpro + marina-muse use MongoDB; marina-upload usually does not — count 2, not 3. */
        MONGODB_NODE_PROCESSES: "2",
        MONGODB_EXTERNAL_CLIENTS: "40",
      },
    },
    {
      name: "marina-muse",
      cwd: "/var/www/marina-muse",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_restarts: 15,
      min_uptime: "10s",
      exp_backoff_restart_delay: 3000,
      kill_timeout: 8000,
      listen_timeout: 15000,
      env: {
        NODE_ENV: "production",
        PORT: "3002",
        MONGODB_NODE_PROCESSES: "2",
        MONGODB_EXTERNAL_CLIENTS: "40",
      },
    },
  ],
};
