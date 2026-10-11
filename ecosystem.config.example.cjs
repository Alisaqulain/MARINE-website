/** PM2 example — copy to ecosystem.config.cjs on the server. Do NOT put MONGODB_URI here; use .env.production.local */
module.exports = {
  apps: [
    {
      name: "excelpro",
      cwd: "/var/www/excelpro",
      script: "node_modules/next/dist/bin/next",
      args: "start -H 0.0.0.0 -p 3000",
      env: {
        NODE_ENV: "production",
      },
    },
  ],
};
