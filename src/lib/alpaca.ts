// AIDEV-NOTE: Alpaca API wrapper methods for secure option chain data fetching (Task #18 Phase 2)

import Alpaca from '@alpacahq/alpaca-trade-api';
import { logger } from '../utils/logger.js';
import { rateLimitedFetch, parseOptionSymbol } from '../utils/fetch.js';
import type { StockQuote, OptionChain, OptionContract, ExpirationDates } from '../types/index.js';
import { loadConfig, validateCredentials, getApiBaseUrl } from '../config/index.js';
import type { TradingMode } from '../config/index.js';

/**
 * Alpaca API client configuration
 */
interface AlpacaConfig {
  keyId: string;
  secretKey: string;
  paper: boolean;
  feed?: string;
}

/**
 * Alpaca API base URLs
 */
const ALPACA_URLS = {
  PAPER_TRADING: 'https://paper-api.alpaca.markets',
  LIVE_TRADING: 'https://api.alpaca.markets',
  DATA: 'https://data.alpaca.markets',
} as const;

/**
 * AlpacaClient - Wrapper for Alpaca Markets API
 * Handles authentication and data fetching for stocks and options
 *
 * Task #18: Now supports both paper and live trading modes
 */
export class AlpacaClient {
  private client: Alpaca;
  private config: AlpacaConfig;
  private tradingBaseUrl: string;
  private dataBaseUrl: string;
  private tradingMode: TradingMode;

  constructor(tradingMode?: TradingMode, config?: Partial<AlpacaConfig>) {
    // Load configuration from config system (Task #18)
    const appConfig = loadConfig();

    // Use provided mode or fall back to config mode
    this.tradingMode = tradingMode || appConfig.tradingMode;

    // Validate credentials for the selected mode
    if (!validateCredentials(this.tradingMode, appConfig)) {
      logger.error(`❌ Invalid or missing ${this.tradingMode} trading credentials`);
      throw new Error(
        `Missing or invalid ${this.tradingMode} trading credentials. ` +
        `Please configure ${this.tradingMode.toUpperCase()} API keys.`
      );
    }

    // Get credentials for the selected mode
    const credentials = appConfig.credentials[this.tradingMode];
    if (!credentials) {
      throw new Error(`No credentials configured for ${this.tradingMode} mode`);
    }

    // Build config with mode-specific credentials
    this.config = {
      keyId: config?.keyId || credentials.apiKey,
      secretKey: config?.secretKey || credentials.secretKey,
      paper: this.tradingMode === 'paper',
      feed: config?.feed || process.env.ALPACA_DATA_FEED || 'indicative',
    };

    // Set base URLs based on trading mode
    this.tradingBaseUrl = getApiBaseUrl(this.tradingMode);
    this.dataBaseUrl = ALPACA_URLS.DATA;

    this.client = new Alpaca({
      keyId: this.config.keyId,
      secretKey: this.config.secretKey,
      paper: this.config.paper,
      feed: this.config.feed,
    });

    // Log connection with clear mode indicator
    const modeLabel = this.tradingMode.toUpperCase();
    const modeEmoji = this.tradingMode === 'paper' ? '🟢' : '🔴';
    const warningText = this.tradingMode === 'live' ? ' ⚠️  REAL MONEY' : '';

    logger.info(`🔗 Connecting to Alpaca ${modeEmoji} ${modeLabel} trading${warningText}`);
    logger.success(
      `🔑 Alpaca client initialized (${modeLabel} mode, feed: ${this.config.feed})`
    );
  }

  /**
   * Get the current trading mode
   */
  getTradingMode(): TradingMode {
    return this.tradingMode;
  }

  /**
   * Get authentication headers for API requests
   */
  private getAuthHeaders(): Record<string, string> {
    return {
      'APCA-API-KEY-ID': this.config.keyId,
      'APCA-API-SECRET-KEY': this.config.secretKey,
    };
  }

  /**
   * Get current stock quote for a symbol
   */
  async getStockQuote(symbol: string): Promise<StockQuote | null> {
    try {
      logger.api('GET', `/quote/${symbol}`);

      // Get latest quote from Alpaca
      const quote = await this.client.getLatestTrade(symbol);
      const snapshot = await this.client.getSnapshot(symbol);

      if (!quote || !snapshot) {
        logger.warning(`No quote data found for symbol: ${symbol}`);
        return null;
      }

      const stockQuote: StockQuote = {
        symbol: symbol.toUpperCase(),
        price: snapshot.LatestTrade?.Price || quote.Price,
        change: snapshot.DailyBar ? snapshot.LatestTrade.Price - snapshot.DailyBar.OpenPrice : 0,
        changePercent: snapshot.DailyBar
          ? ((snapshot.LatestTrade.Price - snapshot.DailyBar.OpenPrice) / snapshot.DailyBar.OpenPrice) * 100
          : 0,
        volume: snapshot.DailyBar?.Volume || 0,
        timestamp: new Date(quote.Timestamp),
      };

      logger.success(`📈 Retrieved quote for ${symbol}: $${stockQuote.price.toFixed(2)}`);
      return stockQuote;
    } catch (error) {
      logger.error(`Failed to fetch quote for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get available expiration dates for options on a symbol
   * Uses v2/options/contracts endpoint with pagination to fetch all available expirations
   */
  async getExpirationDates(symbol: string): Promise<ExpirationDates | null> {
    try {
      logger.api('GET', `/options/expirations/${symbol}`);

      const expirationDates = new Set<string>();
      let pageToken: string | null = null;
      let pageCount = 0;
      const MAX_PAGES = 5; // Limit pagination to prevent excessive API calls
      const MAX_EXPIRATION_REQUESTS = 3; // Request additional date ranges

      logger.info(`🗓️  Fetching expiration dates for ${symbol.toUpperCase()}...`);

      // Fetch contracts with pagination
      let expirationRequests = 0;

      do {
        const paginationParam = pageToken ? `&page_token=${encodeURIComponent(pageToken)}` : '';
        let url = `${this.tradingBaseUrl}/v2/options/contracts?underlying_symbols=${symbol.toUpperCase()}${paginationParam}`;

        // After first page, request additional future expirations
        if (expirationRequests > 0 && expirationDates.size > 0) {
          const sortedExpirations = Array.from(expirationDates).sort();
          const latestExpirationDate = sortedExpirations[sortedExpirations.length - 1];

          if (latestExpirationDate) {
            const nextDate = new Date(latestExpirationDate);
            nextDate.setDate(nextDate.getDate() + 1);
            const nextDateString = nextDate.toISOString().split('T')[0];

            url = `${this.tradingBaseUrl}/v2/options/contracts?underlying_symbols=${symbol.toUpperCase()}&expiration_date_gte=${nextDateString}${paginationParam}`;
          }
        }

        const response = await rateLimitedFetch(url, {
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          logger.error(`API error: ${response.status} ${response.statusText}`);
          break;
        }

        const data = (await response.json()) as any;
        pageToken = data.next_page_token || null;

        // Extract expiration dates from contracts
        if (data.option_contracts && Array.isArray(data.option_contracts)) {
          data.option_contracts.forEach((contract: any) => {
            if (contract.expiration_date) {
              expirationDates.add(contract.expiration_date);
            }
          });

          logger.debug(
            `Fetched page ${pageCount + 1}: ${data.option_contracts.length} contracts, ${expirationDates.size} unique expirations`
          );
        }

        pageCount++;
        expirationRequests++;

        // Add delay between pagination requests to avoid rate limits
        if (pageToken && pageCount < MAX_PAGES) {
          await new Promise((resolve) => setTimeout(resolve, 300));
        }
      } while (pageToken && pageCount < MAX_PAGES && expirationRequests < MAX_EXPIRATION_REQUESTS);

      const sortedExpirations = Array.from(expirationDates).sort();

      // Filter out past expiration dates (only show today or future dates)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Reset to start of day for comparison
      const todayString = today.toISOString().split('T')[0]!; // Format: YYYY-MM-DD

      logger.debug(`📅 Today's date for filtering: ${todayString}`);
      logger.debug(`📅 All expirations before filtering: ${sortedExpirations.join(', ')}`);

      const futureExpirations = sortedExpirations.filter(date => date >= todayString);

      logger.debug(`📅 Expirations after filtering (>= ${todayString}): ${futureExpirations.join(', ')}`);

      if (futureExpirations.length === 0) {
        logger.warning(`No future expiration dates found for ${symbol.toUpperCase()}`);
        return null;
      }

      logger.success(
        `✅ Found ${futureExpirations.length} expiration dates for ${symbol.toUpperCase()} (${futureExpirations[0]} to ${futureExpirations[futureExpirations.length - 1]})`
      );

      return {
        symbol: symbol.toUpperCase(),
        dates: futureExpirations,
      };
    } catch (error) {
      logger.error(`Failed to fetch expiration dates for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get option chain for a symbol and expiration date
   * Uses v1beta1/options/snapshots endpoint (preferred) with fallback to v2/options/contracts
   */
  async getOptionChain(symbol: string, expirationDate: string): Promise<OptionChain | null> {
    try {
      logger.api('GET', `/options/chain/${symbol}/${expirationDate}`);

      // Get underlying price first
      const quote = await this.getStockQuote(symbol);
      if (!quote) {
        logger.error(`Cannot fetch option chain without underlying quote for ${symbol}`);
        return null;
      }

      logger.info(`📊 Fetching option chain for ${symbol.toUpperCase()} expiring ${expirationDate}...`);

      let optionData: any[] = [];

      // Try v1beta1 snapshots endpoint first (includes Greeks and latest quotes)
      try {
        const snapshotsUrl = `${this.dataBaseUrl}/v1beta1/options/snapshots/${symbol.toUpperCase()}?feed=${this.config.feed}&limit=500`;

        logger.debug(`Attempting v1beta1 snapshots endpoint: ${snapshotsUrl}`);

        const response = await rateLimitedFetch(snapshotsUrl, {
          headers: this.getAuthHeaders(),
        });

        if (response.ok) {
          const data = (await response.json()) as any;

          // Parse snapshots data
          if (data.snapshots) {
            optionData = Object.entries(data.snapshots)
              .map(([osiSymbol, snapshot]: [string, any]) => {
                const parsed = parseOptionSymbol(osiSymbol);
                if (!parsed || parsed.expirationDate !== expirationDate) {
                  return null;
                }

                return {
                  symbol: osiSymbol,
                  strikePrice: Number(parsed.strikePrice),
                  expirationDate: parsed.expirationDate,
                  optionType: parsed.optionType,
                  bid: Number(snapshot.latestQuote?.bp || 0),
                  ask: Number(snapshot.latestQuote?.ap || 0),
                  lastPrice: Number(snapshot.latestTrade?.p || 0),
                  volume: Number(snapshot.dailyBar?.v || 0),
                  openInterest: Number(snapshot.openInterest || 0),
                  impliedVolatility: snapshot.impliedVolatility ? Number(snapshot.impliedVolatility) : undefined,
                  delta: snapshot.greeks?.delta ? Number(snapshot.greeks.delta) : undefined,
                  gamma: snapshot.greeks?.gamma ? Number(snapshot.greeks.gamma) : undefined,
                  theta: snapshot.greeks?.theta ? Number(snapshot.greeks.theta) : undefined,
                  vega: snapshot.greeks?.vega ? Number(snapshot.greeks.vega) : undefined,
                  rho: snapshot.greeks?.rho ? Number(snapshot.greeks.rho) : undefined,
                };
              })
              .filter(Boolean) as any[];

            logger.success(`✅ Fetched ${optionData.length} options from v1beta1 snapshots`);
          }
        } else {
          logger.warning(`v1beta1 endpoint returned ${response.status}, falling back to v2`);
        }
      } catch (snapshotError) {
        logger.warning(`v1beta1 snapshots failed, falling back to v2 contracts`, snapshotError);
      }

      // Fallback to v2 contracts endpoint if v1beta1 failed or returned no data
      if (optionData.length === 0) {
        logger.debug(`Attempting v2 contracts endpoint...`);

        const contractsUrl = `${this.tradingBaseUrl}/v2/options/contracts?underlying_symbols=${symbol.toUpperCase()}&expiration_date=${expirationDate}`;

        const response = await rateLimitedFetch(contractsUrl, {
          headers: this.getAuthHeaders(),
        });

        if (!response.ok) {
          logger.error(`v2 contracts endpoint failed: ${response.status} ${response.statusText}`);
          return null;
        }

        const data = (await response.json()) as any;

        if (data.option_contracts && Array.isArray(data.option_contracts)) {
          optionData = data.option_contracts.map((contract: any) => {
            const parsed = parseOptionSymbol(contract.symbol);

            return {
              symbol: contract.symbol,
              strikePrice: Number(contract.strike_price || parsed?.strikePrice || 0),
              expirationDate: contract.expiration_date,
              optionType: contract.type || parsed?.optionType || 'call',
              bid: Number(contract.close_price ? contract.close_price * 0.98 : 0), // Estimate bid from close
              ask: Number(contract.close_price ? contract.close_price * 1.02 : 0), // Estimate ask from close
              lastPrice: Number(contract.close_price || 0),
              volume: Number(contract.volume || 0),
              openInterest: Number(contract.open_interest || 0),
              // Greeks not available in v2 endpoint
              impliedVolatility: undefined,
              delta: undefined,
              gamma: undefined,
              theta: undefined,
              vega: undefined,
              rho: undefined,
            };
          });

          logger.warning(
            `⚠️  Using v2 contracts (${optionData.length} options) - Greeks not available. Consider using v1beta1 with valid feed.`
          );
        }
      }

      // Separate calls and puts
      const calls: OptionContract[] = optionData
        .filter((opt) => opt.optionType === 'call')
        .sort((a, b) => a.strikePrice - b.strikePrice);

      const puts: OptionContract[] = optionData
        .filter((opt) => opt.optionType === 'put')
        .sort((a, b) => a.strikePrice - b.strikePrice);

      const optionChain: OptionChain = {
        symbol: symbol.toUpperCase(),
        expirationDate,
        calls,
        puts,
        underlyingPrice: quote.price,
      };

      logger.success(
        `📊 Retrieved option chain for ${symbol.toUpperCase()} expiring ${expirationDate}: ${calls.length} calls, ${puts.length} puts`
      );

      return optionChain;
    } catch (error) {
      logger.error(`Failed to fetch option chain for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Test connection to Alpaca API
   * Task #18: Now includes mode-specific validation and clear logging
   */
  async testConnection(): Promise<boolean> {
    try {
      const modeLabel = this.tradingMode.toUpperCase();
      const modeEmoji = this.tradingMode === 'paper' ? '🟢' : '🔴';

      logger.info(`🔌 Testing Alpaca ${modeEmoji} ${modeLabel} API connection...`);
      const account = await this.client.getAccount();

      if (account) {
        logger.success(`✅ Alpaca ${modeLabel} API connection successful`);
        logger.debug('Account status', {
          id: account.id,
          status: account.status,
          cash: account.cash,
          portfolio_value: account.portfolio_value,
          trading_mode: this.tradingMode,
        });

        // Extra warning for live mode
        if (this.tradingMode === 'live') {
          logger.warning('⚠️  Connected to LIVE trading account - REAL MONEY at risk');
        }

        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to connect to Alpaca ${this.tradingMode.toUpperCase()} API`, error);
      return false;
    }
  }
}

// Task #18: Mode-aware singleton pattern
// Store separate instances for paper and live modes
const alpacaInstances: Record<TradingMode, AlpacaClient | null> = {
  paper: null,
  live: null,
};

/**
 * Get Alpaca client instance for a specific trading mode
 * Task #18: Now mode-aware - maintains separate instances for paper and live
 *
 * @param mode - Trading mode (optional, defaults to config mode)
 * @param forceNew - Force creation of new instance (for mode switches)
 * @returns AlpacaClient instance for the specified mode
 */
export function getAlpacaClient(mode?: TradingMode, forceNew: boolean = false): AlpacaClient {
  // Load config to get current mode if not specified
  const appConfig = loadConfig();
  const tradingMode = mode || appConfig.tradingMode;

  // Create new instance if forced or doesn't exist
  if (forceNew || !alpacaInstances[tradingMode]) {
    logger.info(`🔧 Creating new AlpacaClient instance for ${tradingMode.toUpperCase()} mode`);
    alpacaInstances[tradingMode] = new AlpacaClient(tradingMode);
  }

  return alpacaInstances[tradingMode]!;
}

/**
 * Reset Alpaca client instance for a specific mode
 * Useful when credentials change or when switching modes
 *
 * @param mode - Trading mode to reset (optional, resets all if not specified)
 */
export function resetAlpacaClient(mode?: TradingMode): void {
  if (mode) {
    logger.info(`🔄 Resetting AlpacaClient instance for ${mode.toUpperCase()} mode`);
    alpacaInstances[mode] = null;
  } else {
    logger.info('🔄 Resetting all AlpacaClient instances');
    alpacaInstances.paper = null;
    alpacaInstances.live = null;
  }
}
