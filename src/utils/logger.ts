// AIDEV-NOTE: Logging utility with emoji support for better debugging
// Writes to file to avoid interfering with Ink TUI display

import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Log levels with associated emojis
 */
export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  SUCCESS = 'success',
  WARNING = 'warning',
  ERROR = 'error',
}

const LOG_EMOJIS = {
  [LogLevel.DEBUG]: '🔍',
  [LogLevel.INFO]: 'ℹ️',
  [LogLevel.SUCCESS]: '✅',
  [LogLevel.WARNING]: '⚠️',
  [LogLevel.ERROR]: '❌',
} as const;

const LOG_COLORS = {
  [LogLevel.DEBUG]: chalk.gray,
  [LogLevel.INFO]: chalk.blue,
  [LogLevel.SUCCESS]: chalk.green,
  [LogLevel.WARNING]: chalk.yellow,
  [LogLevel.ERROR]: chalk.red,
} as const;

/**
 * Logger class for formatted file output
 * Logs to file to avoid interfering with TUI display
 */
class Logger {
  private isDevelopment: boolean;
  private logFilePath: string;
  private logStream: fs.WriteStream | null = null;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';

    // Create logs directory in project root
    const projectRoot = path.resolve(__dirname, '../..');
    const logsDir = path.join(projectRoot, 'logs');

    // Ensure logs directory exists
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }

    // Create log file with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    this.logFilePath = path.join(logsDir, `option-viewer-${timestamp}.log`);

    // Open write stream
    this.logStream = fs.createWriteStream(this.logFilePath, { flags: 'a' });
  }

  /**
   * Write to log file
   */
  private writeToFile(message: string): void {
    if (this.logStream) {
      // Strip ANSI color codes for file output
      const plainMessage = message.replace(/\u001b\[[0-9;]*m/g, '');
      this.logStream.write(plainMessage + '\n');
    }
  }

  private formatMessage(level: LogLevel, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const emoji = LOG_EMOJIS[level];
    const color = LOG_COLORS[level];

    let output = `${emoji} ${color(`[${level.toUpperCase()}]`)} ${message}`;

    if (data !== undefined) {
      output += '\n' + chalk.gray(JSON.stringify(data, null, 2));
    }

    if (this.isDevelopment) {
      output = chalk.dim(`[${timestamp}] `) + output;
    }

    return output;
  }

  debug(message: string, data?: unknown): void {
    if (this.isDevelopment) {
      this.writeToFile(this.formatMessage(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: unknown): void {
    this.writeToFile(this.formatMessage(LogLevel.INFO, message, data));
  }

  success(message: string, data?: unknown): void {
    this.writeToFile(this.formatMessage(LogLevel.SUCCESS, message, data));
  }

  warning(message: string, data?: unknown): void {
    this.writeToFile(this.formatMessage(LogLevel.WARNING, message, data));
  }

  error(message: string, error?: unknown): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    this.writeToFile(this.formatMessage(LogLevel.ERROR, message, errorData));
  }

  // Specialized logging for API calls
  api(method: string, endpoint: string, status?: number): void {
    const emoji = status && status >= 200 && status < 300 ? '🌐' : '🔴';
    const message = `${emoji} API ${method.toUpperCase()} ${endpoint}`;
    const statusColor = status && status >= 200 && status < 300 ? chalk.green : chalk.red;

    this.writeToFile(
      chalk.dim(`[${new Date().toISOString()}] `) +
      message +
      (status ? ` ${statusColor(`[${status}]`)}` : '')
    );
  }

  // Specialized logging for data operations
  data(operation: string, details?: string): void {
    this.writeToFile(
      chalk.dim(`[${new Date().toISOString()}] `) +
      `💾 ${chalk.cyan(`[DATA]`)} ${operation}` +
      (details ? chalk.gray(` - ${details}`) : '')
    );
  }

  /**
   * Get log file path for debugging
   */
  getLogFilePath(): string {
    return this.logFilePath;
  }

  /**
   * Close log stream (call on app exit)
   */
  close(): void {
    if (this.logStream) {
      this.logStream.end();
      this.logStream = null;
    }
  }
}

// Export singleton instance
export const logger = new Logger();
