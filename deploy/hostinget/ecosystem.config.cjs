module.exports = {
  apps: [{
    name: 'dmente-synapse-api',
    script: 'npm',
    args: 'run server:start',
    cwd: process.env.SYNAPSE_APP_DIR || process.cwd(),
    env: {
      NODE_ENV: 'production',
      SYNAPSE_HOST: '127.0.0.1',
      PORT: 3010,
      SYNAPSE_DATA_DIR: process.env.SYNAPSE_DATA_DIR || './data',
    },
  }],
}
