// AIDEV-NOTE: Configuration types for Live Trading support (Task #18)

/**
 * Trading mode type - determines which Alpaca endpoint to use
 * - 'paper': Paper trading (simulated, no real money)
 * - 'live': Live trading (real money)
 */
export type TradingMode = 'paper' | 'live';

/**
 * Credentials for a specific trading mode
 */
export interface TradingCredentials {
  /** Alpaca API key (PK* for paper, AK* for live) */
  apiKey: string;

  /** Alpaca secret key */
  secretKey: string;
}

/**
 * Application configuration
 *
 * This configuration can be loaded from:
 * 1. Environment variables (highest priority)
 * 2. Config file (~/.config/jesse-option-viewer/config.json)
 * 3. Defaults (lowest priority)
 */
export interface AppConfig {
  /**
   * Current trading mode
   * Always defaults to 'paper' on startup for safety
   */
  tradingMode: TradingMode;

  /**
   * Last used trading mode (for UI display)
   * Remembers user preference, but always starts in paper
   */
  lastUsedMode: TradingMode;

  /**
   * Trading credentials for each mode
   */
  credentials: {
    /** Paper trading credentials (required) */
    paper: TradingCredentials;

    /** Live trading credentials (optional - not everyone has live account) */
    live?: TradingCredentials;
  };

  /**
   * User preferences
   */
  preferences: {
    /**
     * Always default to paper mode on startup
     * When true (recommended), app always starts in paper mode
     * regardless of lastUsedMode
     */
    alwaysDefaultToPaper: boolean;

    /**
     * Require confirmation before switching modes
     * Should always be true for safety
     */
    confirmModeSwitch: boolean;
  };
}

/**
 * Default configuration values
 * Used when no config file or env vars are found
 */
export const DEFAULT_CONFIG: Omit<AppConfig, 'credentials'> = {
  tradingMode: 'paper',
  lastUsedMode: 'paper',
  preferences: {
    alwaysDefaultToPaper: true,
    confirmModeSwitch: true,
  },
};

/**
 * Validate API key format
 * Paper keys start with 'PK', live keys start with 'AK'
 *
 * @param apiKey - API key to validate
 * @param expectedMode - Expected trading mode for this key
 * @returns true if key format matches expected mode
 */
export function validateApiKeyFormat(apiKey: string, expectedMode: TradingMode): boolean {
  if (!apiKey || apiKey.length === 0) {
    return false;
  }

  const prefix = apiKey.substring(0, 2).toUpperCase();

  if (expectedMode === 'paper') {
    return prefix === 'PK';
  } else {
    return prefix === 'AK';
  }
}

/**
 * Get the appropriate Alpaca API base URL for a trading mode
 *
 * @param mode - Trading mode
 * @returns Alpaca API base URL
 */
export function getApiBaseUrl(mode: TradingMode): string {
  return mode === 'live'
    ? 'https://api.alpaca.markets'
    : 'https://paper-api.alpaca.markets';
}
