// AIDEV-NOTE: Audit logger for security-sensitive operations (Task #18 Phase 5)

import fs from 'fs';
import path from 'path';
import { getConfigDir } from '../config/index.js';
import { logger } from './logger.js';
import type { TradingMode } from '../config/index.js';

/**
 * Audit event types
 */
export type AuditEventType =
  | 'MODE_SWITCH_REQUESTED'
  | 'MODE_SWITCH_CONFIRMED'
  | 'MODE_SWITCH_CANCELLED'
  | 'MODE_SWITCH_FAILED'
  | 'CREDENTIALS_VALIDATED'
  | 'CREDENTIALS_VALIDATION_FAILED'
  | 'CONNECTION_TEST_SUCCESS'
  | 'CONNECTION_TEST_FAILED'
  | 'APP_STARTED';

/**
 * Audit event structure
 */
export interface AuditEvent {
  timestamp: string;
  event: AuditEventType;
  details: Record<string, any>;
  severity: 'info' | 'warning' | 'error' | 'critical';
}

/**
 * Get audit log file path
 */
function getAuditLogPath(): string {
  const configDir = getConfigDir();
  return path.join(configDir, 'audit.log');
}

/**
 * Ensure audit log file exists
 */
function ensureAuditLog(): void {
  const auditLogPath = getAuditLogPath();
  const configDir = getConfigDir();

  // Ensure config directory exists
  if (!fs.existsSync(configDir)) {
    fs.mkdirSync(configDir, { recursive: true });
  }

  // Create audit log if it doesn't exist
  if (!fs.existsSync(auditLogPath)) {
    fs.writeFileSync(auditLogPath, '', 'utf-8');
    logger.info(`📝 Created audit log: ${auditLogPath}`);
  }
}

/**
 * Write audit event to log file
 */
function writeAuditEvent(event: AuditEvent): void {
  try {
    ensureAuditLog();
    const auditLogPath = getAuditLogPath();

    // Format event as JSON line
    const eventLine = JSON.stringify(event) + '\n';

    // Append to audit log
    fs.appendFileSync(auditLogPath, eventLine, 'utf-8');

    // Also log to main logger based on severity
    const emoji = {
      info: 'ℹ️',
      warning: '⚠️',
      error: '❌',
      critical: '🚨',
    }[event.severity];

    logger.info(`${emoji} AUDIT: ${event.event} - ${JSON.stringify(event.details)}`);
  } catch (error) {
    logger.error(`Failed to write audit event: ${error}`);
  }
}

/**
 * Log mode switch request
 */
export function auditModeSwitchRequest(fromMode: TradingMode, toMode: TradingMode): void {
  writeAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'MODE_SWITCH_REQUESTED',
    details: {
      fromMode,
      toMode,
      direction: toMode === 'live' ? 'PAPER→LIVE' : 'LIVE→PAPER',
    },
    severity: toMode === 'live' ? 'warning' : 'info',
  });
}

/**
 * Log mode switch confirmation
 */
export function auditModeSwitchConfirmed(fromMode: TradingMode, toMode: TradingMode): void {
  writeAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'MODE_SWITCH_CONFIRMED',
    details: {
      fromMode,
      toMode,
      direction: toMode === 'live' ? 'PAPER→LIVE' : 'LIVE→PAPER',
      userConfirmed: true,
    },
    severity: toMode === 'live' ? 'critical' : 'info',
  });
}

/**
 * Log mode switch cancellation
 */
export function auditModeSwitchCancelled(fromMode: TradingMode, toMode: TradingMode): void {
  writeAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'MODE_SWITCH_CANCELLED',
    details: {
      fromMode,
      toMode,
      direction: toMode === 'live' ? 'PAPER→LIVE' : 'LIVE→PAPER',
      userCancelled: true,
    },
    severity: 'info',
  });
}

/**
 * Log mode switch failure
 */
export function auditModeSwitchFailed(
  fromMode: TradingMode,
  toMode: TradingMode,
  reason: string
): void {
  writeAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'MODE_SWITCH_FAILED',
    details: {
      fromMode,
      toMode,
      reason,
    },
    severity: 'error',
  });
}

/**
 * Log credentials validation
 */
export function auditCredentialsValidated(mode: TradingMode, success: boolean): void {
  writeAuditEvent({
    timestamp: new Date().toISOString(),
    event: success ? 'CREDENTIALS_VALIDATED' : 'CREDENTIALS_VALIDATION_FAILED',
    details: {
      mode,
      success,
    },
    severity: success ? 'info' : 'error',
  });
}

/**
 * Log connection test
 */
export function auditConnectionTest(mode: TradingMode, success: boolean, error?: string): void {
  writeAuditEvent({
    timestamp: new Date().toISOString(),
    event: success ? 'CONNECTION_TEST_SUCCESS' : 'CONNECTION_TEST_FAILED',
    details: {
      mode,
      success,
      ...(error && { error }),
    },
    severity: success ? 'info' : 'error',
  });
}

/**
 * Log application startup
 */
export function auditAppStartup(startMode: TradingMode, liveAvailable: boolean): void {
  writeAuditEvent({
    timestamp: new Date().toISOString(),
    event: 'APP_STARTED',
    details: {
      startMode,
      liveAvailable,
      safetyMode: startMode === 'paper',
    },
    severity: 'info',
  });
}

/**
 * Get recent audit events
 * @param limit - Maximum number of events to return
 * @returns Array of recent audit events
 */
export function getRecentAuditEvents(limit: number = 50): AuditEvent[] {
  try {
    const auditLogPath = getAuditLogPath();

    if (!fs.existsSync(auditLogPath)) {
      return [];
    }

    const content = fs.readFileSync(auditLogPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.length > 0);

    // Get last N lines
    const recentLines = lines.slice(-limit);

    // Parse JSON events
    return recentLines
      .map(line => {
        try {
          return JSON.parse(line) as AuditEvent;
        } catch {
          return null;
        }
      })
      .filter((event): event is AuditEvent => event !== null);
  } catch (error) {
    logger.error(`Failed to read audit events: ${error}`);
    return [];
  }
}

/**
 * Get audit log file path for display
 */
export function getAuditLogPathForDisplay(): string {
  return getAuditLogPath();
}
