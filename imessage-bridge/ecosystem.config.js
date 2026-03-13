module.exports = {
  apps: [{
    name: 'imessage-bridge',
    script: 'index.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '128M',
    env: {
      NODE_ENV: 'production',
      BRIDGE_PORT: 3098,
      // BRIDGE_TOKEN set externally via .env or PM2 env
    },
  }],
};
