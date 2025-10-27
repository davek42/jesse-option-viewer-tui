// AIDEV-NOTE: Mode switching validation and safety checks (Task #18 Phase 5)

import { validateCredentials, type AppConfig } from '../config/index.js';
import { getAlpacaClient, resetAlpacaClient } from '../lib/alpaca.js';
import { logger } from './logger.js';
import {
  auditCredentialsValidated,
  auditConnectionTest,
  auditModeSwitchFailed,
} from './auditLogger.js';
import type { TradingMode } from '../config/index.js';

/**
 * Validation result
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Enhanced credential validation
 * Performs multiple checks on credentials
 */
export async function validateCredentialsEnhanced(
  mode: TradingMode,
  config: AppConfig
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Basic validation
  const basicValid = validateCredentials(mode, config);
  auditCredentialsValidated(mode, basicValid);

  if (!basicValid) {
    result.valid = false;
    result.errors.push(`${mode} credentials are invalid or missing`);
    return result;
  }

  const credentials = config.credentials[mode]!;

  // Check API key length
  if (credentials.apiKey.length < 20) {
    result.valid = false;
    result.errors.push('API key appears too short');
  }

  // Check secret key length
  if (credentials.secretKey.length < 40) {
    result.valid = false;
    result.errors.push('Secret key appears too short');
  }

  // Check for placeholder values
  if (
    credentials.apiKey.includes('YOUR_') ||
    credentials.apiKey.includes('PLACEHOLDER') ||
    credentials.apiKey.includes('XXXX')
  ) {
    result.valid = false;
    result.errors.push('API key appears to be a placeholder value');
  }

  if (
    credentials.secretKey.includes('YOUR_') ||
    credentials.secretKey.includes('PLACEHOLDER') ||
    credentials.secretKey.includes('XXXX')
  ) {
    result.valid = false;
    result.errors.push('Secret key appears to be a placeholder value');
  }

  // Warn if switching to live
  if (mode === 'live') {
    result.warnings.push('⚠️  You are switching to LIVE mode - real money will be at risk');
    result.warnings.push('⚠️  Ensure you have proper risk management in place');
  }

  logger.debug(`Enhanced validation for ${mode}: ${result.valid ? 'PASSED' : 'FAILED'}`);
  if (result.errors.length > 0) {
    logger.warning(`Validation errors: ${result.errors.join(', ')}`);
  }

  return result;
}

/**
 * Test connection to Alpaca API
 * Creates a test client and verifies connectivity
 */
export async function testConnection(mode: TradingMode): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  try {
    logger.info(`🔌 Testing ${mode.toUpperCase()} connection...`);

    // Reset any existing client
    resetAlpacaClient(mode);

    // Create new client for testing
    const client = getAlpacaClient(mode, true);

    // Test connection
    const connected = await client.testConnection();

    if (!connected) {
      result.valid = false;
      result.errors.push(`Failed to connect to Alpaca ${mode.toUpperCase()} API`);
      auditConnectionTest(mode, false, 'Connection test returned false');
    } else {
      logger.success(`✅ ${mode.toUpperCase()} connection successful`);
      auditConnectionTest(mode, true);
    }
  } catch (error) {
    result.valid = false;
    const errorMsg = error instanceof Error ? error.message : String(error);
    result.errors.push(`Connection error: ${errorMsg}`);
    logger.error(`❌ ${mode.toUpperCase()} connection failed: ${errorMsg}`);
    auditConnectionTest(mode, false, errorMsg);
  }

  return result;
}

/**
 * Validate mode switch
 * Performs all necessary validation before switching modes
 */
export async function validateModeSwitch(
  fromMode: TradingMode,
  toMode: TradingMode,
  config: AppConfig
): Promise<ValidationResult> {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  logger.info(`🔍 Validating mode switch: ${fromMode.toUpperCase()} → ${toMode.toUpperCase()}`);

  // Step 1: Validate credentials
  const credValidation = await validateCredentialsEnhanced(toMode, config);
  result.errors.push(...credValidation.errors);
  result.warnings.push(...credValidation.warnings);

  if (!credValidation.valid) {
    result.valid = false;
    auditModeSwitchFailed(fromMode, toMode, 'Credential validation failed');
    return result;
  }

  // Step 2: Test connection
  const connValidation = await testConnection(toMode);
  result.errors.push(...connValidation.errors);
  result.warnings.push(...connValidation.warnings);

  if (!connValidation.valid) {
    result.valid = false;
    auditModeSwitchFailed(fromMode, toMode, 'Connection test failed');
    return result;
  }

  // Step 3: Additional safety checks for live mode
  if (toMode === 'live') {
    result.warnings.push('🚨 FINAL WARNING: Switching to LIVE trading mode');
    result.warnings.push('💰 Real money will be used for all trades');
    result.warnings.push('⚠️  You can lose money - trade responsibly');
  }

  logger.success(`✅ Mode switch validation passed: ${fromMode.toUpperCase()} → ${toMode.toUpperCase()}`);

  return result;
}

/**
 * Check if mode switch is safe
 * Quick check without full validation
 */
export function isModeSwitchSafe(
  _fromMode: TradingMode,
  toMode: TradingMode,
  config: AppConfig
): boolean {
  // Basic credential check
  const basicValid = validateCredentials(toMode, config);

  if (!basicValid) {
    logger.warning(`❌ Cannot switch to ${toMode.toUpperCase()}: Invalid credentials`);
    return false;
  }

  return true;
}
