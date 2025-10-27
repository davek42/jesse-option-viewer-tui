// AIDEV-NOTE: Configuration manager for Live Trading support (Task #18)

import fs from 'fs';
import path from 'path';
import os from 'os';
import { logger } from '../utils/logger.js';
import type { AppConfig, TradingMode } from './types.js';
import { DEFAULT_CONFIG, validateApiKeyFormat } from './types.js';

/**
 * Get platform-specific configuration directory path
 *
 * - macOS/Linux: ~/.config/jesse-option-viewer/
 * - Windows: %APPDATA%/jesse-option-viewer/
 *
 * @returns Absolute path to config directory
 */
export function getConfigDir(): string {
  const platform = os.platform();
  const homeDir = os.homedir();

  if (platform === 'win32') {
    // Windows: use APPDATA
    const appData = process.env.APPDATA || path.join(homeDir, 'AppData', 'Roaming');
    return path.join(appData, 'jesse-option-viewer');
  } else {
    // macOS/Linux: use XDG_CONFIG_HOME or ~/.config
    const configHome = process.env.XDG_CONFIG_HOME || path.join(homeDir, '.config');
    return path.join(configHome, 'jesse-option-viewer');
  }
}

/**
 * Get full path to configuration file
 *
 * @returns Absolute path to config.json
 */
export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

/**
 * Ensure configuration directory exists
 * Creates the directory if it doesn't exist
 */
function ensureConfigDir(): void {
  const configDir = getConfigDir();

  if (!fs.existsSync(configDir)) {
    logger.info(`📁 Creating config directory: ${configDir}`);
    fs.mkdirSync(configDir, { recursive: true });
  }
}

/**
 * Load credentials from environment variables
 * Supports both legacy format and new format
 *
 * Supported environment variables (in priority order):
 *
 * Paper credentials:
 * 1. ALPACA_PAPER_API_KEY (new format)
 * 2. ALPACA_API_KEY (legacy format)
 *
 * Paper secret:
 * 1. ALPACA_PAPER_SECRET_KEY (new format)
 * 2. ALPACA_SECRET_KEY (alternative)
 * 3. ALPACA_API_SECRET (original legacy format)
 *
 * Live credentials:
 * - ALPACA_LIVE_API_KEY (new format only)
 * - ALPACA_LIVE_SECRET_KEY (new format only)
 *
 * @returns Credentials loaded from environment
 */
function loadCredentialsFromEnv(): AppConfig['credentials'] {
  const credentials: AppConfig['credentials'] = {
    paper: {
      apiKey: '',
      secretKey: '',
    },
  };

  // Load paper credentials (try new format first, then legacy)
  credentials.paper.apiKey =
    process.env.ALPACA_PAPER_API_KEY || process.env.ALPACA_API_KEY || '';
  credentials.paper.secretKey =
    process.env.ALPACA_PAPER_SECRET_KEY || process.env.ALPACA_SECRET_KEY || process.env.ALPACA_API_SECRET || '';

  // Load live credentials (optional)
  const liveApiKey = process.env.ALPACA_LIVE_API_KEY || '';
  const liveSecretKey = process.env.ALPACA_LIVE_SECRET_KEY || '';

  logger.debug(`🔍 Environment check: ALPACA_LIVE_API_KEY=${liveApiKey ? `present (${liveApiKey.substring(0, 4)}...)` : 'missing'}`);
  logger.debug(`🔍 Environment check: ALPACA_LIVE_SECRET_KEY=${liveSecretKey ? 'present' : 'missing'}`);

  if (liveApiKey && liveSecretKey) {
    credentials.live = {
      apiKey: liveApiKey,
      secretKey: liveSecretKey,
    };
    logger.debug('🔍 Live credentials loaded from environment variables');
  } else {
    logger.debug('🔍 Live credentials NOT loaded (one or both env vars missing)');
  }

  return credentials;
}

/**
 * Load configuration from file
 * Returns null if file doesn't exist or is invalid
 *
 * @returns Loaded configuration or null
 */
function loadConfigFromFile(): Partial<AppConfig> | null {
  const configPath = getConfigPath();

  if (!fs.existsSync(configPath)) {
    logger.debug('📄 No config file found, will use defaults and env vars');
    return null;
  }

  try {
    const fileContent = fs.readFileSync(configPath, 'utf-8');
    const config = JSON.parse(fileContent) as Partial<AppConfig>;
    logger.info(`📄 Loaded config from: ${configPath}`);
    return config;
  } catch (error) {
    logger.error(`❌ Failed to load config file: ${error}`);
    return null;
  }
}

/**
 * Load application configuration
 *
 * Priority order:
 * 1. Environment variables (highest priority)
 * 2. Config file
 * 3. Defaults (lowest priority)
 *
 * @returns Complete application configuration
 */
export function loadConfig(): AppConfig {
  // Start with defaults
  const config: AppConfig = {
    ...DEFAULT_CONFIG,
    credentials: {
      paper: {
        apiKey: '',
        secretKey: '',
      },
    },
  };

  // Load from config file (if exists)
  const fileConfig = loadConfigFromFile();
  if (fileConfig) {
    // Merge file config with defaults
    config.tradingMode = fileConfig.tradingMode || config.tradingMode;
    config.lastUsedMode = fileConfig.lastUsedMode || config.lastUsedMode;

    if (fileConfig.credentials) {
      if (fileConfig.credentials.paper) {
        config.credentials.paper = fileConfig.credentials.paper;
      }
      if (fileConfig.credentials.live) {
        config.credentials.live = fileConfig.credentials.live;
      }
    }

    if (fileConfig.preferences) {
      config.preferences = {
        ...config.preferences,
        ...fileConfig.preferences,
      };
    }
  }

  // Load credentials from environment variables (highest priority)
  const envCredentials = loadCredentialsFromEnv();

  // Override with env vars if present
  if (envCredentials.paper.apiKey) {
    config.credentials.paper = envCredentials.paper;
    logger.info('🔑 Using paper credentials from environment variables');
  }

  if (envCredentials.live) {
    config.credentials.live = envCredentials.live;
    logger.info('🔑 Using live credentials from environment variables');
  }

  // Check for ALPACA_TRADING_MODE env var
  const envMode = process.env.ALPACA_TRADING_MODE?.toLowerCase() as TradingMode | undefined;
  if (envMode && (envMode === 'paper' || envMode === 'live')) {
    config.lastUsedMode = envMode;
    logger.info(`📊 Last used mode from env: ${envMode}`);
  }

  // SAFETY: Always start in paper mode on startup
  if (config.preferences.alwaysDefaultToPaper) {
    config.tradingMode = 'paper';
    logger.info('🛡️ Safety: Starting in PAPER mode (alwaysDefaultToPaper=true)');
  }

  // Validate credentials
  const paperValid = validateCredentials('paper', config);
  const liveValid = config.credentials.live ? validateCredentials('live', config) : false;

  logger.info(`✅ Paper credentials: ${paperValid ? 'valid' : 'invalid'}`);
  logger.info(`✅ Live credentials: ${liveValid ? 'valid and configured' : 'not configured or invalid'}`);

  return config;
}

/**
 * Save configuration to file
 *
 * Note: This does NOT save credentials from environment variables to file.
 * Only saves mode preferences and file-based credentials.
 *
 * @param config - Configuration to save
 */
export function saveConfig(config: AppConfig): void {
  try {
    ensureConfigDir();

    const configPath = getConfigPath();

    // Create a copy without env-var credentials
    const configToSave: AppConfig = {
      ...config,
      credentials: {
        paper: config.credentials.paper,
      },
    };

    // Only save live credentials if they're not from env vars
    // (Check if they differ from what's in env vars)
    const envCredentials = loadCredentialsFromEnv();
    const liveFromEnv = envCredentials.live;

    if (
      config.credentials.live &&
      (!liveFromEnv ||
        config.credentials.live.apiKey !== liveFromEnv.apiKey ||
        config.credentials.live.secretKey !== liveFromEnv.secretKey)
    ) {
      configToSave.credentials.live = config.credentials.live;
    }

    const fileContent = JSON.stringify(configToSave, null, 2);
    fs.writeFileSync(configPath, fileContent, 'utf-8');

    logger.info(`💾 Saved config to: ${configPath}`);
  } catch (error) {
    logger.error(`❌ Failed to save config: ${error}`);
  }
}

/**
 * Validate credentials for a specific trading mode
 *
 * Checks:
 * 1. Credentials exist
 * 2. API key format matches mode (PK* for paper, AK* for live)
 * 3. Secret key is not empty
 *
 * @param mode - Trading mode to validate
 * @param config - Application configuration
 * @returns true if credentials are valid
 */
export function validateCredentials(mode: TradingMode, config: AppConfig): boolean {
  const credentials = config.credentials[mode];

  if (!credentials) {
    logger.debug(`❌ No ${mode} credentials configured`);
    return false;
  }

  if (!credentials.apiKey || !credentials.secretKey) {
    logger.debug(`❌ ${mode} credentials are empty`);
    return false;
  }

  // Validate API key format
  if (!validateApiKeyFormat(credentials.apiKey, mode)) {
    logger.warning(
      `⚠️  ${mode} API key format mismatch: expected ${mode === 'paper' ? 'PK*' : 'AK*'} prefix`
    );
    return false;
  }

  return true;
}

/**
 * Check if live trading is available (credentials configured)
 *
 * @param config - Application configuration
 * @returns true if live credentials are configured and valid
 */
export function isLiveTradingAvailable(config: AppConfig): boolean {
  return config.credentials.live !== undefined && validateCredentials('live', config);
}

/**
 * Update trading mode and save to config
 *
 * @param mode - New trading mode
 * @param config - Current configuration
 * @returns Updated configuration
 */
export function updateTradingMode(mode: TradingMode, config: AppConfig): AppConfig {
  const newConfig: AppConfig = {
    ...config,
    tradingMode: mode,
    lastUsedMode: mode,
  };

  // Save to file
  saveConfig(newConfig);

  return newConfig;
}
