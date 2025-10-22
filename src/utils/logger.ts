// AIDEV-NOTE: Logging utility with emoji support for better debugging

import chalk from 'chalk';

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
 * Logger class for formatted console output
 */
class Logger {
  private isDevelopment: boolean;

  constructor() {
    this.isDevelopment = process.env.NODE_ENV !== 'production';
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
      console.log(this.formatMessage(LogLevel.DEBUG, message, data));
    }
  }

  info(message: string, data?: unknown): void {
    console.log(this.formatMessage(LogLevel.INFO, message, data));
  }

  success(message: string, data?: unknown): void {
    console.log(this.formatMessage(LogLevel.SUCCESS, message, data));
  }

  warning(message: string, data?: unknown): void {
    console.warn(this.formatMessage(LogLevel.WARNING, message, data));
  }

  error(message: string, error?: unknown): void {
    const errorData = error instanceof Error
      ? { message: error.message, stack: error.stack }
      : error;
    console.error(this.formatMessage(LogLevel.ERROR, message, errorData));
  }

  // Specialized logging for API calls
  api(method: string, endpoint: string, status?: number): void {
    const emoji = status && status >= 200 && status < 300 ? '🌐' : '🔴';
    const message = `${emoji} API ${method.toUpperCase()} ${endpoint}`;
    const statusColor = status && status >= 200 && status < 300 ? chalk.green : chalk.red;

    console.log(
      chalk.dim(`[${new Date().toISOString()}] `) +
      message +
      (status ? ` ${statusColor(`[${status}]`)}` : '')
    );
  }

  // Specialized logging for data operations
  data(operation: string, details?: string): void {
    console.log(
      chalk.dim(`[${new Date().toISOString()}] `) +
      `💾 ${chalk.cyan(`[DATA]`)} ${operation}` +
      (details ? chalk.gray(` - ${details}`) : '')
    );
  }
}

// Export singleton instance
export const logger = new Logger();
