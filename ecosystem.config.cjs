module.exports = {
  apps: [
    {
      name: 'pizhou-mahjong-server',
      script: 'apps/server/src/index.ts',
      interpreter: 'node',
      interpreter_args: '--import tsx',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '500M',
      env: {
        NODE_ENV: 'production',
        PORT: 27985,
      },
    },
  ],
};
