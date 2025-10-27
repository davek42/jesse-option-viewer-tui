// AIDEV-NOTE: Configuration module exports (Task #18)

// Export types
export type { TradingMode, TradingCredentials, AppConfig } from './types.js';
export { DEFAULT_CONFIG, validateApiKeyFormat, getApiBaseUrl } from './types.js';

// Export manager functions
export {
  getConfigDir,
  getConfigPath,
  loadConfig,
  saveConfig,
  validateCredentials,
  isLiveTradingAvailable,
  updateTradingMode,
} from './manager.js';
