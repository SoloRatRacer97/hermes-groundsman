module.exports = {
  apps: [{
    name: 'hermes-groundsman',
    script: './hermes-interactive.js',
    cwd: '/app',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'groundsman-watcher',
    script: './gaius-request-watcher.js',
    cwd: '/app',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
