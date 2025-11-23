/**
 * @file: ecosystem.config.cjs
 * @description: PM2 ecosystem config — единая точка запуска prod без доп. команд
 * @project: SaaS Bonus System
 * @dependencies: PM2, Node.js 20+, dotenv
 * @created: 2025-09-08
 * @author: AI Assistant + User
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

module.exports = {
  apps: [
    {
      name: 'bonus-app',
      script: 'yarn',
      args: 'start -H 0.0.0.0 -p 3000',
      cwd: '/opt/next-shadcn-dashboard-starter',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        PORT: '3000'
      },
      env_file: '/opt/next-shadcn-dashboard-starter/.env',
      time: true,
      wait_ready: false,
      autorestart: true,
      max_restarts: 10,
      watch: false
    }
  ]
};


