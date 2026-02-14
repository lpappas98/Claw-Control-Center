import winston from 'winston'
import path from 'node:path'
import os from 'node:os'
import fs from 'node:fs/promises'

const WORKSPACE = process.env.OPENCLAW_WORKSPACE ?? path.join(os.homedir(), '.openclaw', 'workspace')
const LOGS_DIR = path.join(WORKSPACE, 'logs')

// Ensure logs directory exists
await fs.mkdir(LOGS_DIR, { recursive: true })

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
)

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL ?? 'info',
  format: logFormat,
  defaultMeta: { service: 'operator-hub' },
  transports: [
    // Console output (for development)
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
          const metaStr = Object.keys(meta).length > 0 ? JSON.stringify(meta) : ''
          const stackStr = stack ? `\n${stack}` : ''
          return `${timestamp} [${level}] ${message} ${metaStr}${stackStr}`
        })
      ),
    }),
    // File output (JSON format for machine parsing)
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'operator-hub.log'),
      format: logFormat,
    }),
    // Error log file
    new winston.transports.File({
      filename: path.join(LOGS_DIR, 'operator-hub-error.log'),
      level: 'error',
      format: logFormat,
    }),
  ],
})

// Add rotation support (keep last 7 days of logs)
// In production, consider using 'winston-daily-rotate-file' for automatic rotation

export default logger
