module.exports = {
  apps: [{
    name: 'hermes-groundsman',
    script: './hermes-interactive.js',
    cwd: '/Users/toddanderson/workspace-hermes-groundsman',
    env: {
      NODE_ENV: 'production'
    }
  }, {
    name: 'groundsman-watcher',
    script: './gaius-request-watcher.js',
    cwd: '/Users/toddanderson/workspace-hermes-groundsman',
    env: {
      NODE_ENV: 'production'
    }
  }]
};
