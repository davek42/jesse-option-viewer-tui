// AIDEV-NOTE: Alpaca API wrapper methods for secure option chain data fetching

import Alpaca from '@alpacahq/alpaca-trade-api';
import { logger } from '../utils/logger.js';
import { rateLimitedFetch, parseOptionSymbol } from '../utils/fetch.js';
import type { StockQuote, OptionChain, OptionContract, ExpirationDates } from '../types/index.js';

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
 */
export class AlpacaClient {
  private client: Alpaca;
  private config: AlpacaConfig;
  private tradingBaseUrl: string;
  private dataBaseUrl: string;

  constructor(config?: Partial<AlpacaConfig>) {
    // AIDEV-NOTE: API keys loaded from environment variables for security
    this.config = {
      keyId: config?.keyId || process.env.ALPACA_API_KEY || '',
      secretKey: config?.secretKey || process.env.ALPACA_API_SECRET || '',
      paper: config?.paper ?? (process.env.ALPACA_PAPER === 'true'),
      feed: config?.feed || process.env.ALPACA_DATA_FEED || 'indicative',
    };

    if (!this.config.keyId || !this.config.secretKey) {
      logger.error('❌ Alpaca API credentials not found in environment variables');
      throw new Error('Missing Alpaca API credentials. Please set ALPACA_API_KEY and ALPACA_API_SECRET');
    }

    // Set base URLs based on paper/live mode
    this.tradingBaseUrl = this.config.paper ? ALPACA_URLS.PAPER_TRADING : ALPACA_URLS.LIVE_TRADING;
    this.dataBaseUrl = ALPACA_URLS.DATA;

    this.client = new Alpaca({
      keyId: this.config.keyId,
      secretKey: this.config.secretKey,
      paper: this.config.paper,
      feed: this.config.feed,
    });

    logger.success(
      `🔑 Alpaca client initialized (${this.config.paper ? 'PAPER' : 'LIVE'} trading, feed: ${this.config.feed})`
    );
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

      const futureExpirations = sortedExpirations.filter(date => date >= todayString);

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
   */
  async testConnection(): Promise<boolean> {
    try {
      logger.info('🔌 Testing Alpaca API connection...');
      const account = await this.client.getAccount();

      if (account) {
        logger.success('✅ Alpaca API connection successful');
        logger.debug('Account status', {
          id: account.id,
          status: account.status,
          cash: account.cash,
          portfolio_value: account.portfolio_value,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Failed to connect to Alpaca API', error);
      return false;
    }
  }
}

// Export singleton instance
let alpacaInstance: AlpacaClient | null = null;

export function getAlpacaClient(config?: Partial<AlpacaConfig>): AlpacaClient {
  if (!alpacaInstance) {
    alpacaInstance = new AlpacaClient(config);
  }
  return alpacaInstance;
}
