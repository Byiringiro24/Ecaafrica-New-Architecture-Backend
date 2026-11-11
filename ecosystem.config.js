/**
 * PM2 Ecosystem Config
 *
 * Two processes:
 *
 * ecare-backend — HTTP cluster (max CPUs), serves all API requests and Socket.IO.
 *   NODE_APP_INSTANCE is set by PM2 to 0,1,2,...
 *   Only instance 0 (the "leader") runs singleton jobs (SSE, pull-logs, etc.).
 *   All instances handle HTTP and Socket.IO.
 *
 * ecare-frontend — static file server, single fork process.
 */
module.exports = {
  apps: [
    {
      name:          'ecare-backend',
      script:        'dist/server.js',
      instances:     'max',         // one per CPU core — handles HTTP at scale
      exec_mode:     'cluster',
      env: {
        NODE_ENV: 'production',
        PORT:     5500,
      },
      env_production: {
        NODE_ENV: 'production',
        PORT:     5500,
      },
      error_file:         '/var/log/pm2/ecare-backend-error.log',
      out_file:           '/var/log/pm2/ecare-backend-out.log',
      log_file:           '/var/log/pm2/ecare-backend-combined.log',
      time:               true,
      max_memory_restart: '1G',
      node_args:          '--max-old-space-size=1024',
      watch:              false,
      ignore_watch:       ['node_modules', 'logs', 'dist'],
      merge_logs:         true,
      log_date_format:    'YYYY-MM-DD HH:mm:ss Z',
      restart_delay:      5000,
      max_restarts:       10,
      min_uptime:         '10s',
      // PM2 sets NODE_APP_INSTANCE; instance 0 is the leader and runs background jobs.
      // All instances handle HTTP.
    },
    {
      name:      'ecare-frontend',
      // Use npx serve so the 'serve' package does not need to be listed in
      // package.json — npx downloads it on first run and caches it globally.
      // This avoids the "[PM2][ERROR] Script not found: node_modules/.bin/serve"
      // error that occurs when 'serve' is not installed as a local dependency.
      script:    'npx',
      args:      'serve -s dist -l 4173',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      cwd:       '/var/www/ecare/frontend',
      env: {
        NODE_ENV: 'production',
      },
      error_file:      '/var/log/pm2/ecare-frontend-error.log',
      out_file:        '/var/log/pm2/ecare-frontend-out.log',
      restart_delay:   3000,
      max_restarts:    10,
      min_uptime:      '5s',
      watch:           false,
    },
  ],
};
