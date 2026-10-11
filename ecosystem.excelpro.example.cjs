/**
 * PM2 — excelpro ONLY (/var/www/excelpro). Does not start or restart marina-muse / marina-upload.
 *
 * EADDRINUSE :3000 causes:
 * - excelpro registered twice in PM2
 * - instances > 1 or exec_mode cluster on the same PORT
 * - autorestart loop before kill_timeout releases the port
 * - a manual `next start` still running beside PM2 (inspect with ss -tlnp | grep 3000 — do not kill unknown PIDs)
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
        /** excelpro + marina-muse share Atlas; marina-upload typically does not. */
        MONGODB_NODE_PROCESSES: "2",
        MONGODB_EXTERNAL_CLIENTS: "40",
      },
    },
  ],
};
