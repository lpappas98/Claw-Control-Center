/**
 * PM2 Ecosystem Configuration for Operator Hub Workers
 * 
 * Usage:
 *   pm2 start ecosystem.config.cjs
 *   pm2 stop all
 *   pm2 restart all
 *   pm2 logs
 *   pm2 monit
 */

module.exports = {
  apps: [
    {
      name: 'worker-pm',
      script: 'bridge/workerService.mjs',
      args: 'pm',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      
      // Restart configuration
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      
      // Logging
      error_file: 'logs/worker-pm-error.log',
      out_file: 'logs/worker-pm-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      // Environment
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-architect',
      script: 'bridge/workerService.mjs',
      args: 'architect',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      
      error_file: 'logs/worker-architect-error.log',
      out_file: 'logs/worker-architect-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-dev-1',
      script: 'bridge/workerService.mjs',
      args: 'dev-1',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      
      error_file: 'logs/worker-dev-1-error.log',
      out_file: 'logs/worker-dev-1-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-dev-2',
      script: 'bridge/workerService.mjs',
      args: 'dev-2',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      
      error_file: 'logs/worker-dev-2-error.log',
      out_file: 'logs/worker-dev-2-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      env: {
        NODE_ENV: 'production',
      },
    },
    {
      name: 'worker-qa',
      script: 'bridge/workerService.mjs',
      args: 'qa',
      cwd: '/home/openclaw/.openclaw/workspace',
      interpreter: 'node',
      instances: 1,
      exec_mode: 'fork',
      
      autorestart: true,
      max_restarts: 10,
      min_uptime: '10s',
      restart_delay: 3000,
      
      error_file: 'logs/worker-qa-error.log',
      out_file: 'logs/worker-qa-out.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,
      
      env: {
        NODE_ENV: 'production',
      },
    },
  ],
};
