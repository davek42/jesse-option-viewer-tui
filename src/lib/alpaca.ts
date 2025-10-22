// AIDEV-NOTE: Alpaca API wrapper methods for secure option chain data fetching

import Alpaca from '@alpacahq/alpaca-trade-api';
import { logger } from '../utils/logger.js';
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
 * AlpacaClient - Wrapper for Alpaca Markets API
 * Handles authentication and data fetching for stocks and options
 */
export class AlpacaClient {
  private client: Alpaca;
  private config: AlpacaConfig;

  constructor(config?: Partial<AlpacaConfig>) {
    // AIDEV-NOTE: API keys loaded from environment variables for security
    this.config = {
      keyId: config?.keyId || process.env.ALPACA_API_KEY || '',
      secretKey: config?.secretKey || process.env.ALPACA_API_SECRET || '',
      paper: config?.paper ?? (process.env.ALPACA_PAPER === 'true'),
      feed: config?.feed || process.env.ALPACA_DATA_FEED || 'iex',
    };

    if (!this.config.keyId || !this.config.secretKey) {
      logger.error('❌ Alpaca API credentials not found in environment variables');
      throw new Error('Missing Alpaca API credentials. Please set ALPACA_API_KEY and ALPACA_API_SECRET');
    }

    this.client = new Alpaca({
      keyId: this.config.keyId,
      secretKey: this.config.secretKey,
      paper: this.config.paper,
      feed: this.config.feed,
    });

    logger.success(
      `🔑 Alpaca client initialized (${this.config.paper ? 'PAPER' : 'LIVE'} trading)`
    );
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
   */
  async getExpirationDates(symbol: string): Promise<ExpirationDates | null> {
    try {
      logger.api('GET', `/options/expirations/${symbol}`);

      // AIDEV-TODO: Implement actual Alpaca options API call when available
      // For now, returning mock data structure
      logger.warning('⚠️ Using mock expiration dates - Alpaca options API integration pending');

      // Generate next 4 monthly expirations as placeholder
      const dates: string[] = [];
      const today = new Date();

      for (let i = 0; i < 4; i++) {
        const expDate = new Date(today);
        expDate.setMonth(today.getMonth() + i);
        // Third Friday of the month (standard option expiration)
        expDate.setDate(1);
        const firstDay = expDate.getDay();
        const fridayDate = firstDay <= 5 ? 5 - firstDay + 1 : 12 - firstDay;
        expDate.setDate(fridayDate + 14); // Third Friday
        dates.push(expDate.toISOString().split('T')[0]!);
      }

      return {
        symbol: symbol.toUpperCase(),
        dates,
      };
    } catch (error) {
      logger.error(`Failed to fetch expiration dates for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Get option chain for a symbol and expiration date
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

      // AIDEV-TODO: Implement actual Alpaca options chain API call
      logger.warning('⚠️ Using mock option chain data - Alpaca options API integration pending');

      // Generate mock option chain for demonstration
      const strikes = this.generateStrikes(quote.price);
      const calls = strikes.map(strike => this.generateMockOption(symbol, strike, expirationDate, 'call', quote.price));
      const puts = strikes.map(strike => this.generateMockOption(symbol, strike, expirationDate, 'put', quote.price));

      const optionChain: OptionChain = {
        symbol: symbol.toUpperCase(),
        expirationDate,
        calls,
        puts,
        underlyingPrice: quote.price,
      };

      logger.success(`📊 Retrieved option chain for ${symbol} expiring ${expirationDate}`);
      return optionChain;
    } catch (error) {
      logger.error(`Failed to fetch option chain for ${symbol}`, error);
      return null;
    }
  }

  /**
   * Generate strike prices around the current stock price
   */
  private generateStrikes(currentPrice: number): number[] {
    const strikes: number[] = [];
    const increment = currentPrice > 200 ? 5 : currentPrice > 100 ? 2.5 : 1;
    const numStrikes = 20;

    // Center strikes around current price
    const baseStrike = Math.round(currentPrice / increment) * increment;

    for (let i = -numStrikes / 2; i <= numStrikes / 2; i++) {
      strikes.push(baseStrike + i * increment);
    }

    return strikes.filter(s => s > 0);
  }

  /**
   * Generate mock option data for testing
   * AIDEV-TODO: Replace with actual API data
   */
  private generateMockOption(
    symbol: string,
    strike: number,
    expiration: string,
    type: 'call' | 'put',
    underlyingPrice: number
  ): OptionContract {
    // Simple mock pricing based on moneyness
    const moneyness = type === 'call'
      ? (underlyingPrice - strike) / strike
      : (strike - underlyingPrice) / strike;

    const intrinsicValue = Math.max(0, moneyness * strike);
    const timeValue = 2 + Math.random() * 3;
    const theoreticalPrice = intrinsicValue + timeValue;

    const bid = Math.max(0.01, theoreticalPrice - 0.15);
    const ask = theoreticalPrice + 0.15;

    return {
      symbol: `${symbol}${expiration.replace(/-/g, '')}${type.charAt(0).toUpperCase()}${strike}`,
      strikePrice: strike,
      expirationDate: expiration,
      optionType: type,
      bid: Number(bid.toFixed(2)),
      ask: Number(ask.toFixed(2)),
      lastPrice: Number(theoreticalPrice.toFixed(2)),
      volume: Math.floor(Math.random() * 1000),
      openInterest: Math.floor(Math.random() * 5000),
      impliedVolatility: 0.2 + Math.random() * 0.3,
      delta: type === 'call'
        ? moneyness > 0 ? 0.5 + moneyness : 0.1 + moneyness * 0.4
        : moneyness > 0 ? -0.5 - moneyness : -0.1 - moneyness * 0.4,
      gamma: 0.05 + Math.random() * 0.05,
      theta: -(0.05 + Math.random() * 0.1),
      vega: 0.1 + Math.random() * 0.15,
      rho: type === 'call' ? 0.01 + Math.random() * 0.02 : -(0.01 + Math.random() * 0.02),
    };
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
