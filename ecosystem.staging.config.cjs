module.exports = {
  apps: [
    {
      name: 'ecare-staging-backend',
      script: 'dist/server.js',
      cwd: '/var/www/testing/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 5600
      },
      time: true,
      autorestart: true,
      watch: false,
      max_memory_restart: '1G'
    }
  ]
};
