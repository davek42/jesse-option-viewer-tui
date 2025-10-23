// AIDEV-NOTE: Rate-limited fetch wrapper for Alpaca API compliance (200 req/min limit)

import { logger } from './logger.js';

/**
 * Rate limit configuration for API requests
 */
interface RateLimitConfig {
  maxRequests: number;    // Maximum requests allowed
  windowMs: number;        // Time window in milliseconds
  backoffFactor: number;   // Multiplier for exponential backoff
  timestamps: number[];    // Request timestamps within current window
}

/**
 * API rate limit tracking
 * Alpaca limits: 200 requests per minute
 */
const API_RATE_LIMIT: RateLimitConfig = {
  maxRequests: 200,
  windowMs: 60000, // 60 seconds
  backoffFactor: 2,
  timestamps: [],
};

/**
 * Rate-limited fetch wrapper with retry logic and backoff
 *
 * Implements:
 * - Client-side rate limiting (200 req/min)
 * - Exponential backoff for 429 errors
 * - Respects server Retry-After header
 * - Automatic retries with configurable max attempts
 *
 * @param url - Request URL
 * @param options - Fetch options
 * @param retryDelay - Initial retry delay in milliseconds (default: 1000)
 * @param maxRetries - Maximum retry attempts (default: 3)
 * @returns Response promise
 */
export async function rateLimitedFetch(
  url: string,
  options: RequestInit = {},
  retryDelay = 1000,
  maxRetries = 3
): Promise<Response> {
  const now = Date.now();

  // Remove timestamps older than the window
  API_RATE_LIMIT.timestamps = API_RATE_LIMIT.timestamps.filter(
    (time) => now - time < API_RATE_LIMIT.windowMs
  );

  // Check if we're at the rate limit
  if (API_RATE_LIMIT.timestamps.length >= API_RATE_LIMIT.maxRequests) {
    const oldestTimestamp = Math.min(...API_RATE_LIMIT.timestamps);
    const timeToWait = API_RATE_LIMIT.windowMs - (now - oldestTimestamp) + 100;

    logger.warning(
      `⏱️  Rate limit reached (${API_RATE_LIMIT.maxRequests} req/min), waiting ${Math.round(timeToWait / 1000)}s`
    );

    await new Promise((resolve) => setTimeout(resolve, timeToWait));
    return rateLimitedFetch(url, options, retryDelay, maxRetries);
  }

  // Record this request timestamp
  API_RATE_LIMIT.timestamps.push(now);

  try {
    const response = await fetch(url, options);

    // Handle rate limit errors (429)
    if (response.status === 429 && maxRetries > 0) {
      logger.warning(`🚦 Received 429 (Too Many Requests), retrying...`);

      // Check for Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      const waitTime = retryAfter
        ? parseInt(retryAfter, 10) * 1000
        : retryDelay * API_RATE_LIMIT.backoffFactor;

      logger.debug(`Waiting ${Math.round(waitTime / 1000)}s before retry (${maxRetries} attempts left)`);

      await new Promise((resolve) => setTimeout(resolve, waitTime));
      return rateLimitedFetch(url, options, waitTime, maxRetries - 1);
    }

    // Handle server errors with retry
    if (response.status >= 500 && maxRetries > 0) {
      logger.warning(`🔄 Server error ${response.status}, retrying in ${Math.round(retryDelay / 1000)}s...`);

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return rateLimitedFetch(
        url,
        options,
        retryDelay * API_RATE_LIMIT.backoffFactor,
        maxRetries - 1
      );
    }

    return response;
  } catch (error) {
    // Handle network errors with retry
    if (maxRetries > 0) {
      logger.warning(
        `🌐 Network error, retrying in ${Math.round(retryDelay / 1000)}s... (${maxRetries} attempts left)`
      );

      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      return rateLimitedFetch(
        url,
        options,
        retryDelay * API_RATE_LIMIT.backoffFactor,
        maxRetries - 1
      );
    }

    throw error;
  }
}

/**
 * Parse OSI (Options Symbology Initiative) format option symbols
 * Format: AAPL241206C00225000
 * - AAPL: Underlying symbol
 * - 241206: Expiration date (YYMMDD)
 * - C: Option type (C=call, P=put)
 * - 00225000: Strike price in pennies (225.00 * 1000)
 *
 * @param osiSymbol - OSI format option symbol
 * @returns Parsed option details or null if invalid
 */
export function parseOptionSymbol(osiSymbol: string): {
  underlying: string;
  expirationDate: string;
  optionType: 'call' | 'put';
  strikePrice: number;
} | null {
  // OSI format: [Symbol][YYMMDD][C|P][00000000]
  const match = osiSymbol.match(/^([A-Z]+)(\d{6})([CP])(\d{8})$/);

  if (!match) {
    logger.warning(`❌ Invalid OSI format: ${osiSymbol}`);
    return null;
  }

  const [, underlying, dateStr, typeChar, strikePriceStr] = match;

  // Convert option type
  const optionType = typeChar === 'C' ? 'call' : 'put';

  // Convert strike price from pennies to dollars (00225000 -> 225.00)
  const strikePrice = parseInt(strikePriceStr!) / 1000;

  // Convert YYMMDD to YYYY-MM-DD
  const year = `20${dateStr!.slice(0, 2)}`;
  const month = dateStr!.slice(2, 4);
  const day = dateStr!.slice(4, 6);
  const expirationDate = `${year}-${month}-${day}`;

  return {
    underlying: underlying!,
    expirationDate,
    optionType,
    strikePrice,
  };
}
