# Tastytrade API Integration Plan
## Jesse Option Viewer TUI Enhancement

**Project**: Add Tastytrade API integration for IV Rank and IV Percentile metrics  
**Target Application**: jesse-option-viewer-tui (Terminal UI for Alpaca Options)  
**Duration**: 4 weeks  
**Last Updated**: October 28, 2025

---

## Table of Contents
1. [Overview](#overview)
2. [Architecture Strategy](#architecture-strategy)
3. [Phase 1: API Client Setup](#phase-1-api-client-setup-week-1)
4. [Phase 2: Type Definitions](#phase-2-type-definitions-week-1)
5. [Phase 3: Hybrid Data Strategy](#phase-3-hybrid-data-strategy-week-2)
6. [Phase 4: UI Enhancements](#phase-4-ui-enhancements-week-2-3)
7. [Phase 5: State Management](#phase-5-state-management-updates-week-3)
8. [Phase 6: Strategy Enhancements](#phase-6-strategy-enhancements-week-4)
9. [Phase 7: Testing Strategy](#phase-7-testing-strategy-week-4)
10. [Phase 8: Future Enhancements](#phase-8-new-features-future-enhancements)
11. [Implementation Priorities](#implementation-priorities)
12. [Getting Started](#getting-started)

---

## Overview

### Problem Statement
The current application uses Alpaca Markets API which provides implied volatility (IV) for individual option contracts, but lacks **IV Rank** and **IV Percentile** - critical metrics for the tastytrade methodology of high-probability premium selling strategies.

### Solution
Integrate Tastytrade API as a complementary data source to enrich the application with:
- **IV Rank**: Where current IV sits in the 52-week range (0-100%)
- **IV Percentile**: Percentage of days IV was below current level
- **Enhanced Greeks**: Alternative source for real-time Greeks via DXLink
- **Strategy Recommendations**: IV-aware strategy suggestions

### Key Benefits
1. **Best of Both APIs**: Alpaca for pricing/speed, Tastytrade for IV metrics
2. **Minimal Disruption**: Keeps existing Alpaca infrastructure intact
3. **Tastytrade Methodology**: Aligns with tastytrade's 50+ IV Rank strategy criteria
4. **Flexibility**: Toggle between data sources via configuration
5. **Educational Value**: Visual IV Rank indicators guide strategy selection

---

## Architecture Strategy

### Current Architecture
```
┌─────────────────────────────────────────┐
│         jesse-option-viewer-tui         │
├─────────────────────────────────────────┤
│  UI Layer (React/Ink Components)        │
│    - OptionChain.tsx                    │
│    - Header.tsx                         │
│    - StrategyBuilder.tsx                │
├─────────────────────────────────────────┤
│  State Management (Context/Reducer)     │
│    - AppContext.tsx                     │
├─────────────────────────────────────────┤
│  API Layer                              │
│    - lib/alpaca.ts  ← Alpaca API        │
├─────────────────────────────────────────┤
│  Utilities                              │
│    - utils/strategies.ts                │
│    - utils/formatters.ts                │
└─────────────────────────────────────────┘
```

### Target Architecture (Hybrid Approach)
```
┌─────────────────────────────────────────────────────────┐
│              jesse-option-viewer-tui                    │
├─────────────────────────────────────────────────────────┤
│  UI Layer (React/Ink Components)                        │
│    - OptionChain.tsx (+ IV Rank column)                 │
│    - Header.tsx (+ IV Rank display)                     │
│    - StrategyBuilder.tsx (+ IV-aware suggestions)       │
├─────────────────────────────────────────────────────────┤
│  State Management                                       │
│    - AppContext.tsx (+ IV metrics state)                │
├─────────────────────────────────────────────────────────┤
│  Data Aggregation Layer ← NEW                           │
│    - lib/dataAggregator.ts                              │
│    - lib/config.ts (source selection)                   │
├─────────────────────────────────────────────────────────┤
│  API Layer                                              │
│    - lib/alpaca.ts      ← Pricing, Quotes, Base Chain   │
│    - lib/tastytrade.ts  ← IV Rank, IV Percentile  (NEW) │
├─────────────────────────────────────────────────────────┤
│  Enhanced Utilities                                     │
│    - utils/strategies.ts (+ IV-aware logic)             │
│    - utils/ivCalculator.ts (fallback calculation)  (NEW)│
└─────────────────────────────────────────────────────────┘
```

### Data Source Strategy
| Data Type | Primary Source | Secondary/Fallback | Reason |
|-----------|---------------|-------------------|---------|
| Stock Quotes | Alpaca | - | Fast, reliable, existing |
| Option Pricing | Alpaca | - | Real-time, existing integration |
| Basic Greeks | Alpaca | Tastytrade | Alpaca sufficient for now |
| IV Rank | Tastytrade | Calculate | Core tastytrade metric |
| IV Percentile | Tastytrade | Calculate | Core tastytrade metric |
| Streaming Data | Alpaca | Tastytrade DXLink | Future enhancement |

---

## Phase 1: API Client Setup (Week 1)

### 1.1 Create Tastytrade Client

**File**: `src/lib/tastytrade.ts`

```typescript
/**
 * Tastytrade API Client
 * Provides IV Rank, IV Percentile, and enhanced options data
 * Docs: https://developer.tastytrade.com/
 */

import TastytradeClient from "@tastytrade/api";
import type { IVMetrics, OptionContract } from '../types';

export class TastytradeAPI {
  private client: TastytradeClient;
  private isAuthenticated = false;

  constructor() {
    const clientSecret = process.env.TASTYTRADE_CLIENT_SECRET;
    const refreshToken = process.env.TASTYTRADE_REFRESH_TOKEN;

    if (!clientSecret || !refreshToken) {
      throw new Error('Tastytrade credentials missing in .env file');
    }

    this.client = new TastytradeClient({
      ...TastytradeClient.ProdConfig,
      clientSecret,
      refreshToken,
      oauthScopes: ['read', 'trade']
    });

    // OAuth tokens are auto-refreshed by the client
    this.isAuthenticated = true;
  }

  /**
   * Get IV Rank and IV Percentile for a given symbol
   * IV Rank = (Current IV - 52w Low) / (52w High - 52w Low) * 100
   * 
   * @param symbol - Stock symbol (e.g., 'AAPL')
   * @returns IV metrics including rank and percentile
   */
  async getIVMetrics(symbol: string): Promise<IVMetrics> {
    try {
      // Fetch equity metrics from Tastytrade
      const equity = await this.client.instrumentsService.getEquity(symbol);
      
      // Note: Actual implementation depends on Tastytrade API structure
      // This is a template - adjust based on actual API response
      return {
        symbol,
        impliedVolatility: equity.impliedVolatility || 0,
        ivRank: equity.ivRank || 0,
        ivPercentile: equity.ivPercentile || 0,
        ivHigh52Week: equity.ivHigh52w || 0,
        ivLow52Week: equity.ivLow52w || 0,
        timestamp: new Date()
      };
    } catch (error) {
      throw new Error(`Failed to fetch IV metrics for ${symbol}: ${error}`);
    }
  }

  /**
   * Get option chain from Tastytrade
   * Returns similar structure to Alpaca but with Tastytrade-specific fields
   * 
   * @param symbol - Underlying stock symbol
   * @returns Array of option contracts
   */
  async getOptionChain(symbol: string): Promise<OptionContract[]> {
    try {
      const chain = await this.client.instrumentsService.getOptionChain(symbol);
      
      // Transform Tastytrade chain format to match app's OptionContract interface
      return this.transformChainToAppFormat(chain);
    } catch (error) {
      throw new Error(`Failed to fetch option chain for ${symbol}: ${error}`);
    }
  }

  /**
   * Subscribe to real-time Greeks updates via DXLink streamer
   * Future enhancement for live data
   * 
   * @param symbols - Array of option symbols
   * @param callback - Function to handle incoming Greeks data
   */
  async subscribeToGreeks(
    symbols: string[],
    callback: (greeks: any) => void
  ): Promise<void> {
    const streamer = this.client.quoteStreamer;

    streamer.addEventListener((events) => {
      callback(events);
    });

    await streamer.connect();
    streamer.subscribe(symbols);
  }

  /**
   * Get the 45 DTE expiration date (tastytrade standard)
   * 
   * @returns Date object for ~45 DTE expiration
   */
  async getTastyMonthly(): Promise<Date> {
    // Tastytrade utility for finding 45 DTE expiration
    // Implementation depends on available SDK methods
    const now = new Date();
    const futureDate = new Date(now.setDate(now.getDate() + 45));
    return futureDate;
  }

  /**
   * Clean disconnect
   */
  async disconnect(): Promise<void> {
    if (this.client.quoteStreamer) {
      await this.client.quoteStreamer.disconnect();
    }
  }

  private transformChainToAppFormat(tastyChain: any): OptionContract[] {
    // Transform Tastytrade chain structure to app's OptionContract type
    // This maintains compatibility with existing UI components
    return []; // Implement transformation logic
  }
}

// Singleton instance for app-wide use
let tastytradeInstance: TastytradeAPI | null = null;

export const getTastytradeAPI = (): TastytradeAPI => {
  if (!tastytradeInstance) {
    tastytradeInstance = new TastytradeAPI();
  }
  return tastytradeInstance;
};
```

### 1.2 Update Environment Configuration

**File**: `.env.example`

```bash
# Alpaca Markets API
ALPACA_API_KEY=your_paper_api_key_here
ALPACA_API_SECRET=your_paper_api_secret_here
ALPACA_PAPER=true

# Tastytrade API (for IV Rank/Percentile)
TASTYTRADE_CLIENT_SECRET=your_client_secret_here
TASTYTRADE_REFRESH_TOKEN=your_refresh_token_here
TASTYTRADE_ENABLED=true

# Data Source Configuration
# Options: 'alpaca' | 'tastytrade' | 'hybrid'
DATA_SOURCE=hybrid
# Which API to use for specific data types
PRICING_SOURCE=alpaca
IV_METRICS_SOURCE=tastytrade
GREEKS_SOURCE=alpaca
```

**Update your personal `.env`** with actual credentials from my.tastytrade.com

### 1.3 Install Dependencies

```bash
npm install @tastytrade/api
```

**Update `package.json`** to include the new dependency:
```json
{
  "dependencies": {
    "@tastytrade/api": "^latest",
    // ... existing dependencies
  }
}
```

---

## Phase 2: Type Definitions (Week 1)

### 2.1 Extend Type Definitions

**File**: `src/types/index.ts`

Add these new types to your existing type definitions:

```typescript
/**
 * IV (Implied Volatility) Metrics
 * Primary source: Tastytrade API
 * Used for tastytrade methodology (50+ IV Rank for premium selling)
 */
export interface IVMetrics {
  symbol: string;
  
  /** Current implied volatility as decimal (e.g., 0.25 = 25%) */
  impliedVolatility: number;
  
  /** IV Rank: Where current IV sits in 52-week range (0-100) */
  ivRank: number;
  
  /** IV Percentile: % of days IV was below current level (0-100) */
  ivPercentile: number;
  
  /** Highest IV in past 52 weeks */
  ivHigh52Week: number;
  
  /** Lowest IV in past 52 weeks */
  ivLow52Week: number;
  
  /** When this data was fetched */
  timestamp: Date;
}

/**
 * Enhanced Option Contract
 * Extends base OptionContract with Tastytrade-specific data
 */
export interface EnhancedOptionContract extends OptionContract {
  /** IV metrics for the underlying (shared across all options) */
  ivMetrics?: IVMetrics;
  
  /** Alternative Greeks from Tastytrade (if using their feed) */
  tastytradeGreeks?: {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
  };
  
  /** Tastytrade-specific streamer symbol for WebSocket subscriptions */
  streamerSymbol?: string;
}

/**
 * Data Source Configuration
 * Determines which API to use for different data types
 */
export interface DataSource {
  /** Type of configuration: single API or hybrid approach */
  type: 'alpaca' | 'tastytrade' | 'hybrid';
  
  /** Primary API for fallback scenarios */
  primary: 'alpaca' | 'tastytrade';
  
  /** Specific source preferences */
  preferences: {
    pricing: 'alpaca' | 'tastytrade';
    ivMetrics: 'alpaca' | 'tastytrade' | 'calculate';
    greeks: 'alpaca' | 'tastytrade';
    streaming: 'alpaca' | 'tastytrade' | 'none';
  };
}

/**
 * App Configuration
 * Feature flags and API source selection
 */
export interface AppConfig {
  dataSource: DataSource;
  
  features: {
    /** Show IV Rank in header and option chain */
    enableIVRank: boolean;
    
    /** Show IV Percentile alongside IV Rank */
    enableIVPercentile: boolean;
    
    /** Enable real-time streaming via Tastytrade DXLink */
    enableTastytradeStreaming: boolean;
    
    /** Show strategy recommendations based on IV Rank */
    enableIVAwareStrategies: boolean;
    
    /** Cache IV metrics (they change slowly) */
    cacheIVMetrics: boolean;
    cacheDurationMinutes: number;
  };
  
  display: {
    /** Color thresholds for IV Rank display */
    ivRankThresholds: {
      high: number;      // > 70: green (great for premium selling)
      good: number;      // > 50: cyan (good for premium selling)
      neutral: number;   // > 30: yellow
      low: number;       // <= 30: red (better for buying)
    };
  };
}

/**
 * Strategy Recommendation
 * Based on IV Rank and market conditions
 */
export interface StrategyRecommendation {
  strategyName: string;
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  ivRankIdeal: number;
  currentIVRank: number;
  warning?: string;
}
```

---

## Phase 3: Hybrid Data Strategy (Week 2)

### 3.1 Create Data Aggregator

**File**: `src/lib/dataAggregator.ts`

```typescript
/**
 * Option Data Aggregator
 * Combines data from multiple sources (Alpaca + Tastytrade)
 * to provide enriched option chain information
 */

import { AlpacaAPI } from './alpaca';
import { TastytradeAPI } from './tastytrade';
import type { EnhancedOptionContract, IVMetrics, AppConfig } from '../types';
import { getConfig } from './config';

export class OptionDataAggregator {
  private config: AppConfig;

  constructor(
    private alpaca: AlpacaAPI,
    private tastytrade: TastytradeAPI
  ) {
    this.config = getConfig();
  }

  /**
   * Get enriched option chain combining both data sources
   * 
   * Strategy:
   * 1. Fetch base option chain from Alpaca (pricing, quotes, base Greeks)
   * 2. Fetch IV metrics from Tastytrade (IV Rank, IV Percentile)
   * 3. Combine and enrich the data
   * 4. Cache IV metrics (they change slowly - refresh every 15 min)
   * 
   * @param symbol - Underlying stock symbol
   * @returns Enhanced option contracts with IV metrics
   */
  async getEnrichedOptionChain(symbol: string): Promise<EnhancedOptionContract[]> {
    try {
      // Step 1: Get base chain from Alpaca (fast, reliable pricing)
      const alpacaChain = await this.alpaca.getOptionChain(symbol);

      // Step 2: Get IV metrics from Tastytrade (if enabled)
      let ivMetrics: IVMetrics | undefined;
      
      if (this.config.features.enableIVRank) {
        try {
          ivMetrics = await this.getIVMetrics(symbol);
        } catch (error) {
          console.warn(`⚠️  Failed to fetch IV metrics for ${symbol}:`, error);
          // Continue without IV metrics - app still functional
        }
      }

      // Step 3: Enrich Alpaca contracts with Tastytrade data
      const enrichedChain: EnhancedOptionContract[] = alpacaChain.map(contract => ({
        ...contract,
        ivMetrics, // Add IV metrics to each contract (shared for underlying)
      }));

      return enrichedChain;
    } catch (error) {
      throw new Error(`Failed to aggregate option data for ${symbol}: ${error}`);
    }
  }

  /**
   * Get IV metrics with caching support
   * IV Rank/Percentile change slowly - safe to cache for 15 minutes
   */
  private async getIVMetrics(symbol: string): Promise<IVMetrics> {
    const cacheKey = `iv_metrics_${symbol}`;
    
    if (this.config.features.cacheIVMetrics) {
      const cached = this.getFromCache(cacheKey);
      if (cached) {
        return cached;
      }
    }

    const metrics = await this.tastytrade.getIVMetrics(symbol);
    
    if (this.config.features.cacheIVMetrics) {
      this.saveToCache(cacheKey, metrics, this.config.features.cacheDurationMinutes);
    }

    return metrics;
  }

  /**
   * Get stock quote with IV metrics
   * Useful for header display
   */
  async getStockWithIVMetrics(symbol: string): Promise<{
    quote: any;
    ivMetrics?: IVMetrics;
  }> {
    const [quote, ivMetrics] = await Promise.all([
      this.alpaca.getStockQuote(symbol),
      this.config.features.enableIVRank
        ? this.getIVMetrics(symbol).catch(() => undefined)
        : Promise.resolve(undefined)
    ]);

    return { quote, ivMetrics };
  }

  /**
   * Simple in-memory cache
   * TODO: Consider using a proper cache library for production
   */
  private cache = new Map<string, { data: any; expiresAt: number }>();

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private saveToCache(key: string, data: any, durationMinutes: number): void {
    const expiresAt = Date.now() + (durationMinutes * 60 * 1000);
    this.cache.set(key, { data, expiresAt });
  }

  /**
   * Clear all cached data
   * Useful for manual refresh or when switching data sources
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Singleton instance
let aggregatorInstance: OptionDataAggregator | null = null;

export const getDataAggregator = (
  alpaca: AlpacaAPI,
  tastytrade: TastytradeAPI
): OptionDataAggregator => {
  if (!aggregatorInstance) {
    aggregatorInstance = new OptionDataAggregator(alpaca, tastytrade);
  }
  return aggregatorInstance;
};
```

### 3.2 Configuration Service

**File**: `src/lib/config.ts`

```typescript
/**
 * Application Configuration
 * Manages feature flags and data source preferences
 */

import type { AppConfig } from '../types';

/**
 * Get application configuration from environment variables
 * with sensible defaults
 */
export const getConfig = (): AppConfig => {
  const tastytradeEnabled = process.env.TASTYTRADE_ENABLED === 'true';
  
  return {
    dataSource: {
      type: (process.env.DATA_SOURCE as any) || 'hybrid',
      primary: 'alpaca', // Keep Alpaca as primary for stability
      preferences: {
        pricing: 'alpaca',           // Alpaca for pricing (fast, reliable)
        ivMetrics: tastytradeEnabled ? 'tastytrade' : 'calculate',
        greeks: 'alpaca',            // Alpaca Greeks are sufficient
        streaming: 'none'            // Disable streaming initially
      }
    },
    
    features: {
      enableIVRank: tastytradeEnabled,
      enableIVPercentile: tastytradeEnabled,
      enableTastytradeStreaming: false,  // Future enhancement
      enableIVAwareStrategies: tastytradeEnabled,
      cacheIVMetrics: true,
      cacheDurationMinutes: 15  // IV Rank changes slowly
    },
    
    display: {
      ivRankThresholds: {
        high: 70,    // Great for premium selling (green)
        good: 50,    // Good for premium selling (cyan)
        neutral: 30, // Neutral zone (yellow)
        low: 0       // Better for debit strategies (red)
      }
    }
  };
};

/**
 * Validate configuration
 * Ensures required environment variables are set
 */
export const validateConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check Alpaca credentials (always required)
  if (!process.env.ALPACA_API_KEY) {
    errors.push('ALPACA_API_KEY is required');
  }
  if (!process.env.ALPACA_API_SECRET) {
    errors.push('ALPACA_API_SECRET is required');
  }

  // Check Tastytrade credentials (if enabled)
  if (process.env.TASTYTRADE_ENABLED === 'true') {
    if (!process.env.TASTYTRADE_CLIENT_SECRET) {
      errors.push('TASTYTRADE_CLIENT_SECRET is required when Tastytrade is enabled');
    }
    if (!process.env.TASTYTRADE_REFRESH_TOKEN) {
      errors.push('TASTYTRADE_REFRESH_TOKEN is required when Tastytrade is enabled');
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
};
```

---

## Phase 4: UI Enhancements (Week 2-3)

### 4.1 Update Header Component

**File**: `src/components/Header.tsx`

Add IV Rank display to the header:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { IVMetrics } from '../types';
import { getConfig } from '../lib/config';

interface HeaderProps {
  symbol: string;
  price: number;
  change: number;
  ivMetrics?: IVMetrics;  // NEW: IV metrics
}

export const Header: React.FC<HeaderProps> = ({ 
  symbol, 
  price, 
  change,
  ivMetrics 
}) => {
  const config = getConfig();
  
  const getIVRankColor = (ivRank: number): string => {
    const thresholds = config.display.ivRankThresholds;
    if (ivRank >= thresholds.high) return 'green';
    if (ivRank >= thresholds.good) return 'cyan';
    if (ivRank >= thresholds.neutral) return 'yellow';
    return 'red';
  };

  const getIVRankLabel = (ivRank: number): string => {
    const thresholds = config.display.ivRankThresholds;
    if (ivRank >= thresholds.high) return '📈 Very High - Great for selling premium';
    if (ivRank >= thresholds.good) return '📊 High - Good for selling premium';
    if (ivRank >= thresholds.neutral) return '📉 Moderate';
    return '📉 Low - Better for buying options';
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box>
        <Text bold color="cyan">{symbol}</Text>
        <Text> | </Text>
        <Text>${price.toFixed(2)}</Text>
        <Text color={change >= 0 ? 'green' : 'red'}>
          {' '}({change >= 0 ? '+' : ''}{change.toFixed(2)}%)
        </Text>
      </Box>

      {/* NEW: IV Rank Display */}
      {config.features.enableIVRank && ivMetrics && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color="gray">IV Rank: </Text>
            <Text bold color={getIVRankColor(ivMetrics.ivRank)}>
              {ivMetrics.ivRank.toFixed(1)}%
            </Text>
            {config.features.enableIVPercentile && (
              <>
                <Text color="gray"> | IV Percentile: </Text>
                <Text bold color={getIVRankColor(ivMetrics.ivPercentile)}>
                  {ivMetrics.ivPercentile.toFixed(1)}%
                </Text>
              </>
            )}
          </Box>
          <Box>
            <Text color="gray" dimColor>
              {getIVRankLabel(ivMetrics.ivRank)}
            </Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>
              52w Range: {(ivMetrics.ivLow52Week * 100).toFixed(1)}% - {(ivMetrics.ivHigh52Week * 100).toFixed(1)}% 
              | Current: {(ivMetrics.impliedVolatility * 100).toFixed(1)}%
            </Text>
          </Box>
        </Box>
      )}

      {/* Show when Tastytrade is disabled */}
      {!config.features.enableIVRank && (
        <Box marginTop={1}>
          <Text color="gray" dimColor>
            💡 Enable Tastytrade for IV Rank metrics
          </Text>
        </Box>
      )}
    </Box>
  );
};
```

### 4.2 Enhance Option Chain Display

**File**: `src/components/OptionChain.tsx`

Add IV Rank column to the option chain table:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import type { EnhancedOptionContract } from '../types';
import { getConfig } from '../lib/config';

interface OptionChainProps {
  contracts: EnhancedOptionContract[];
  showGreeks: boolean;
}

export const OptionChain: React.FC<OptionChainProps> = ({ 
  contracts, 
  showGreeks 
}) => {
  const config = getConfig();
  const showIVRank = config.features.enableIVRank && contracts[0]?.ivMetrics;

  const getIVRankColor = (ivRank?: number): string => {
    if (!ivRank) return 'gray';
    const thresholds = config.display.ivRankThresholds;
    if (ivRank >= thresholds.high) return 'green';
    if (ivRank >= thresholds.good) return 'cyan';
    if (ivRank >= thresholds.neutral) return 'yellow';
    return 'red';
  };

  return (
    <Box flexDirection="column">
      {/* Header Row */}
      <Box>
        <Box width={12}><Text bold color="cyan">Strike</Text></Box>
        <Box width={8}><Text bold color="cyan">Type</Text></Box>
        <Box width={10}><Text bold color="cyan">Bid</Text></Box>
        <Box width={10}><Text bold color="cyan">Ask</Text></Box>
        <Box width={10}><Text bold color="cyan">Last</Text></Box>
        
        {/* NEW: IV Rank Column */}
        {showIVRank && (
          <Box width={12}><Text bold color="cyan">IV Rank</Text></Box>
        )}
        
        {showGreeks && (
          <>
            <Box width={10}><Text bold color="cyan">Delta</Text></Box>
            <Box width={10}><Text bold color="cyan">Theta</Text></Box>
            <Box width={10}><Text bold color="cyan">Vega</Text></Box>
          </>
        )}
      </Box>

      {/* Contract Rows */}
      {contracts.map((contract, index) => (
        <Box key={index}>
          <Box width={12}><Text>{contract.strike}</Text></Box>
          <Box width={8}>
            <Text color={contract.type === 'call' ? 'green' : 'red'}>
              {contract.type.toUpperCase()}
            </Text>
          </Box>
          <Box width={10}><Text>${contract.bid.toFixed(2)}</Text></Box>
          <Box width={10}><Text>${contract.ask.toFixed(2)}</Text></Box>
          <Box width={10}><Text>${contract.last.toFixed(2)}</Text></Box>
          
          {/* NEW: IV Rank Display */}
          {showIVRank && contract.ivMetrics && (
            <Box width={12}>
              <Text color={getIVRankColor(contract.ivMetrics.ivRank)}>
                {contract.ivMetrics.ivRank.toFixed(1)}%
              </Text>
            </Box>
          )}
          
          {showGreeks && contract.greeks && (
            <>
              <Box width={10}><Text>{contract.greeks.delta.toFixed(3)}</Text></Box>
              <Box width={10}><Text>{contract.greeks.theta.toFixed(3)}</Text></Box>
              <Box width={10}><Text>{contract.greeks.vega.toFixed(3)}</Text></Box>
            </>
          )}
        </Box>
      ))}
    </Box>
  );
};
```

### 4.3 Add Status Bar Indicator

**File**: `src/components/StatusBar.tsx`

Show which data sources are active:

```typescript
import React from 'react';
import { Box, Text } from 'ink';
import { getConfig } from '../lib/config';

export const StatusBar: React.FC = () => {
  const config = getConfig();

  return (
    <Box borderStyle="single" borderColor="gray" padding={1}>
      <Text color="gray">Data Sources: </Text>
      <Text color="cyan" bold>Alpaca</Text>
      <Text color="gray"> (pricing) </Text>
      
      {config.features.enableIVRank && (
        <>
          <Text color="gray">+ </Text>
          <Text color="green" bold>Tastytrade</Text>
          <Text color="gray"> (IV Rank)</Text>
        </>
      )}
      
      <Text color="gray"> | Press </Text>
      <Text color="yellow">i</Text>
      <Text color="gray"> to toggle IV display</Text>
    </Box>
  );
};
```

---

## Phase 5: State Management Updates (Week 3)

### 5.1 Update AppContext

**File**: `src/context/AppContext.tsx`

Add IV metrics to global state:

```typescript
import React, { createContext, useReducer, useContext, ReactNode } from 'react';
import type { IVMetrics, AppConfig, DataSource } from '../types';
import { getConfig } from '../lib/config';

interface AppState {
  // ... existing state
  symbol: string;
  contracts: EnhancedOptionContract[];
  currentScreen: 'home' | 'chain' | 'builder';
  
  // NEW: IV Metrics state
  ivMetrics?: IVMetrics;
  
  // NEW: Configuration
  config: AppConfig;
  dataSource: DataSource;
  
  // NEW: Feature toggles
  showIVRank: boolean;
  showIVPercentile: boolean;
}

type Action =
  | { type: 'SET_SYMBOL'; payload: string }
  | { type: 'SET_CONTRACTS'; payload: EnhancedOptionContract[] }
  | { type: 'SET_SCREEN'; payload: 'home' | 'chain' | 'builder' }
  
  // NEW: IV-related actions
  | { type: 'SET_IV_METRICS'; payload: IVMetrics }
  | { type: 'CLEAR_IV_METRICS' }
  | { type: 'TOGGLE_IV_RANK_DISPLAY' }
  | { type: 'TOGGLE_IV_PERCENTILE_DISPLAY' }
  | { type: 'TOGGLE_DATA_SOURCE' }
  | { type: 'REFRESH_IV_METRICS' };

const initialState: AppState = {
  symbol: '',
  contracts: [],
  currentScreen: 'home',
  config: getConfig(),
  dataSource: getConfig().dataSource,
  showIVRank: getConfig().features.enableIVRank,
  showIVPercentile: getConfig().features.enableIVPercentile,
};

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_SYMBOL':
      return { ...state, symbol: action.payload };
      
    case 'SET_CONTRACTS':
      return { ...state, contracts: action.payload };
      
    case 'SET_SCREEN':
      return { ...state, currentScreen: action.payload };

    // NEW: IV Metrics actions
    case 'SET_IV_METRICS':
      return { 
        ...state, 
        ivMetrics: action.payload 
      };

    case 'CLEAR_IV_METRICS':
      return { 
        ...state, 
        ivMetrics: undefined 
      };

    case 'TOGGLE_IV_RANK_DISPLAY':
      return { 
        ...state, 
        showIVRank: !state.showIVRank 
      };

    case 'TOGGLE_IV_PERCENTILE_DISPLAY':
      return { 
        ...state, 
        showIVPercentile: !state.showIVPercentile 
      };

    case 'TOGGLE_DATA_SOURCE':
      // Toggle between Alpaca-only and Hybrid mode
      const newPrimary = state.dataSource.primary === 'alpaca' 
        ? 'tastytrade' 
        : 'alpaca';
      return {
        ...state,
        dataSource: {
          ...state.dataSource,
          primary: newPrimary
        }
      };

    case 'REFRESH_IV_METRICS':
      // Clear cache and force refresh
      // Actual refresh happens in the component that dispatches this
      return { ...state, ivMetrics: undefined };

    default:
      return state;
  }
};

const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
} | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
};

export const useAppContext = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
};
```

---

## Phase 6: Strategy Enhancements (Week 4)

### 6.1 IV-Aware Strategy Selection

**File**: `src/utils/strategies.ts`

Add IV-aware strategy recommendations:

```typescript
/**
 * Strategy Utilities
 * Enhanced with IV Rank awareness for tastytrade methodology
 */

import type { IVMetrics, StrategyRecommendation } from '../types';

/**
 * Get recommended strategies based on IV Rank
 * Follows tastytrade methodology:
 * - High IV (>50): Sell premium (Iron Condors, Credit Spreads, Straddles)
 * - Low IV (<50): Buy premium (Debit Spreads, Long Options, Diagonals)
 * 
 * @param ivRank - Current IV Rank (0-100)
 * @returns Array of recommended strategy names, sorted by suitability
 */
export const getRecommendedStrategies = (ivRank: number): string[] => {
  if (ivRank >= 70) {
    // Very High IV - Best for aggressive premium selling
    return [
      'Iron Condor',
      'Short Straddle',
      'Short Strangle',
      'Bear Call Spread',
      'Bull Put Spread',
      'Covered Call'
    ];
  } else if (ivRank >= 50) {
    // High IV - Good for premium selling
    return [
      'Iron Condor',
      'Credit Spreads',
      'Covered Call',
      'Cash-Secured Put',
      'Diagonal Spread'
    ];
  } else if (ivRank >= 30) {
    // Moderate IV - Neutral zone
    return [
      'Diagonal Spread',
      'Calendar Spread',
      'Butterfly Spread',
      'Debit Spreads'
    ];
  } else {
    // Low IV - Better for buying options
    return [
      'Bull Call Spread',
      'Bear Put Spread',
      'Long Calls',
      'Long Puts',
      'Debit Spreads'
    ];
  }
};

/**
 * Get detailed strategy recommendations with reasoning
 * 
 * @param ivMetrics - Current IV metrics
 * @returns Array of detailed recommendations
 */
export const getDetailedRecommendations = (
  ivMetrics: IVMetrics
): StrategyRecommendation[] => {
  const recommendations: StrategyRecommendation[] = [];
  const ivRank = ivMetrics.ivRank;

  if (ivRank >= 70) {
    recommendations.push({
      strategyName: 'Iron Condor',
      confidence: 'high',
      reasoning: `IV Rank at ${ivRank.toFixed(1)}% is very high. Excellent conditions for selling premium with defined risk.`,
      ivRankIdeal: 70,
      currentIVRank: ivRank
    });
  }

  if (ivRank >= 50) {
    recommendations.push({
      strategyName: 'Credit Spreads',
      confidence: 'high',
      reasoning: `IV Rank at ${ivRank.toFixed(1)}% favors credit strategies. Target 50% profit.`,
      ivRankIdeal: 50,
      currentIVRank: ivRank
    });
  }

  if (ivRank < 30) {
    recommendations.push({
      strategyName: 'Debit Spreads',
      confidence: 'medium',
      reasoning: `IV Rank at ${ivRank.toFixed(1)}% is low. Consider directional debit strategies instead of selling premium.`,
      ivRankIdeal: 30,
      currentIVRank: ivRank
    });
  }

  return recommendations;
};

/**
 * Validate if a strategy is appropriate for current IV conditions
 * Warns users when selecting strategies in suboptimal IV environments
 * 
 * @param strategy - Strategy name
 * @param ivRank - Current IV Rank
 * @returns Validation result with optional warning
 */
export const validateStrategyForIV = (
  strategy: string,
  ivRank: number
): { valid: boolean; warning?: string; suggestion?: string } => {
  
  // Credit strategies in low IV
  if (['Iron Condor', 'Short Straddle', 'Short Strangle'].includes(strategy) && ivRank < 30) {
    return {
      valid: true,
      warning: '⚠️  IV Rank is below 30. Premium selling is less profitable in low IV environments.',
      suggestion: 'Consider debit spreads or directional strategies instead.'
    };
  }

  // Debit strategies in high IV
  if (['Bull Call Spread', 'Bear Put Spread'].includes(strategy) && ivRank > 70) {
    return {
      valid: true,
      warning: '⚠️  IV Rank is above 70. Options are expensive - consider selling premium instead.',
      suggestion: 'Consider iron condors or credit spreads for better risk/reward.'
    };
  }

  // Iron Condor sweet spot check
  if (strategy === 'Iron Condor' && ivRank >= 50) {
    return {
      valid: true,
      warning: undefined,
      suggestion: `✅ Great IV conditions for Iron Condors! Target 16-20 delta, 45 DTE.`
    };
  }

  return { valid: true };
};

/**
 * Calculate optimal strike selection based on IV Rank
 * Higher IV allows wider strikes with better premiums
 * 
 * @param ivRank - Current IV Rank
 * @param stockPrice - Current stock price
 * @returns Recommended delta and strike width
 */
export const getOptimalStrikeSelection = (
  ivRank: number,
  stockPrice: number
): { 
  recommendedDelta: number; 
  strikeWidthPercent: number;
  reasoning: string;
} => {
  if (ivRank >= 70) {
    return {
      recommendedDelta: 16, // Safer, further OTM
      strikeWidthPercent: 10,
      reasoning: 'High IV allows wider strikes with good premium'
    };
  } else if (ivRank >= 50) {
    return {
      recommendedDelta: 20, // Standard tastytrade approach
      strikeWidthPercent: 5,
      reasoning: 'Standard 20-delta for balanced risk/reward'
    };
  } else {
    return {
      recommendedDelta: 30, // Closer to ATM for low IV
      strikeWidthPercent: 3,
      reasoning: 'Low IV requires closer strikes for decent premium'
    };
  }
};
```

### 6.2 Update Strategy Builder

**File**: `src/components/StrategyBuilder.tsx`

Show IV-aware warnings and suggestions:

```typescript
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext';
import { validateStrategyForIV, getDetailedRecommendations } from '../utils/strategies';

export const StrategyBuilder: React.FC = () => {
  const { state } = useAppContext();
  const [selectedStrategy, setSelectedStrategy] = useState<string>('');
  const [validation, setValidation] = useState<any>(null);
  const [recommendations, setRecommendations] = useState<any[]>([]);

  useEffect(() => {
    if (selectedStrategy && state.ivMetrics) {
      // Validate strategy against current IV conditions
      const result = validateStrategyForIV(selectedStrategy, state.ivMetrics.ivRank);
      setValidation(result);

      // Get recommendations
      const recs = getDetailedRecommendations(state.ivMetrics);
      setRecommendations(recs);
    }
  }, [selectedStrategy, state.ivMetrics]);

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">Strategy Builder</Text>

      {/* Show IV-based recommendations */}
      {state.ivMetrics && recommendations.length > 0 && (
        <Box flexDirection="column" marginTop={1} borderStyle="round" borderColor="green" padding={1}>
          <Text bold color="green">💡 Recommended Strategies (IV Rank: {state.ivMetrics.ivRank.toFixed(1)}%)</Text>
          {recommendations.map((rec, i) => (
            <Box key={i} marginTop={1}>
              <Text color="cyan">• {rec.strategyName}</Text>
              <Text color="gray" dimColor> - {rec.reasoning}</Text>
            </Box>
          ))}
        </Box>
      )}

      {/* Show validation warnings */}
      {validation?.warning && (
        <Box marginTop={1} borderStyle="round" borderColor="yellow" padding={1}>
          <Text color="yellow">{validation.warning}</Text>
          {validation.suggestion && (
            <Text color="gray" dimColor>{validation.suggestion}</Text>
          )}
        </Box>
      )}

      {/* Rest of strategy builder UI */}
      {/* ... existing code ... */}
    </Box>
  );
};
```

---

## Phase 7: Testing Strategy (Week 4)

### 7.1 Unit Tests for Tastytrade Client

**File**: `tests/tastytrade.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { TastytradeAPI } from '../src/lib/tastytrade';
import type { IVMetrics } from '../src/types';

describe('TastytradeAPI', () => {
  let api: TastytradeAPI;

  beforeAll(() => {
    // Use test credentials or mock
    process.env.TASTYTRADE_CLIENT_SECRET = 'test_secret';
    process.env.TASTYTRADE_REFRESH_TOKEN = 'test_token';
  });

  it('should initialize with credentials', () => {
    expect(() => {
      api = new TastytradeAPI();
    }).not.toThrow();
  });

  it('should fetch IV metrics for a symbol', async () => {
    api = new TastytradeAPI();
    const metrics: IVMetrics = await api.getIVMetrics('AAPL');
    
    expect(metrics.symbol).toBe('AAPL');
    expect(metrics.ivRank).toBeGreaterThanOrEqual(0);
    expect(metrics.ivRank).toBeLessThanOrEqual(100);
    expect(metrics.ivPercentile).toBeGreaterThanOrEqual(0);
    expect(metrics.ivPercentile).toBeLessThanOrEqual(100);
  });

  it('should handle API errors gracefully', async () => {
    api = new TastytradeAPI();
    
    await expect(api.getIVMetrics('INVALID_SYMBOL')).rejects.toThrow();
  });
});
```

### 7.2 Integration Tests

**File**: `tests/dataAggregator.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { OptionDataAggregator } from '../src/lib/dataAggregator';
import { AlpacaAPI } from '../src/lib/alpaca';
import { TastytradeAPI } from '../src/lib/tastytrade';

describe('OptionDataAggregator', () => {
  it('should combine data from both sources', async () => {
    const alpaca = new AlpacaAPI();
    const tastytrade = new TastytradeAPI();
    const aggregator = new OptionDataAggregator(alpaca, tastytrade);

    const enrichedChain = await aggregator.getEnrichedOptionChain('AAPL');

    expect(enrichedChain.length).toBeGreaterThan(0);
    expect(enrichedChain[0]).toHaveProperty('strike');
    expect(enrichedChain[0]).toHaveProperty('ivMetrics');
    expect(enrichedChain[0].ivMetrics).toHaveProperty('ivRank');
  });

  it('should cache IV metrics', async () => {
    const alpaca = new AlpacaAPI();
    const tastytrade = new TastytradeAPI();
    const aggregator = new OptionDataAggregator(alpaca, tastytrade);

    // First call - should fetch from API
    const start = Date.now();
    await aggregator.getEnrichedOptionChain('AAPL');
    const firstCallTime = Date.now() - start;

    // Second call - should use cache
    const start2 = Date.now();
    await aggregator.getEnrichedOptionChain('AAPL');
    const secondCallTime = Date.now() - start2;

    expect(secondCallTime).toBeLessThan(firstCallTime);
  });
});
```

### 7.3 Mock Data for Development

**File**: `tests/test-utils/tastytrade-mocks.ts`

```typescript
import type { IVMetrics } from '../../src/types';

export const mockIVMetrics: IVMetrics = {
  symbol: 'AAPL',
  impliedVolatility: 0.25,
  ivRank: 65.5,
  ivPercentile: 68.2,
  ivHigh52Week: 0.45,
  ivLow52Week: 0.15,
  timestamp: new Date()
};

export const mockIVMetricsLow: IVMetrics = {
  symbol: 'SPY',
  impliedVolatility: 0.12,
  ivRank: 22.3,
  ivPercentile: 25.1,
  ivHigh52Week: 0.35,
  ivLow52Week: 0.08,
  timestamp: new Date()
};

export const mockIVMetricsHigh: IVMetrics = {
  symbol: 'TSLA',
  impliedVolatility: 0.55,
  ivRank: 88.7,
  ivPercentile: 92.4,
  ivHigh52Week: 0.62,
  ivLow52Week: 0.18,
  timestamp: new Date()
};
```

### 7.4 Strategy Validation Tests

**File**: `tests/strategies.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { 
  getRecommendedStrategies, 
  validateStrategyForIV,
  getOptimalStrikeSelection 
} from '../src/utils/strategies';

describe('IV-Aware Strategy Utils', () => {
  describe('getRecommendedStrategies', () => {
    it('should recommend premium selling for high IV', () => {
      const strategies = getRecommendedStrategies(75);
      expect(strategies).toContain('Iron Condor');
      expect(strategies).toContain('Short Straddle');
    });

    it('should recommend debit strategies for low IV', () => {
      const strategies = getRecommendedStrategies(25);
      expect(strategies).toContain('Bull Call Spread');
      expect(strategies).toContain('Debit Spreads');
    });
  });

  describe('validateStrategyForIV', () => {
    it('should warn about credit spreads in low IV', () => {
      const result = validateStrategyForIV('Iron Condor', 25);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('low IV');
    });

    it('should approve credit spreads in high IV', () => {
      const result = validateStrategyForIV('Iron Condor', 75);
      expect(result.warning).toBeUndefined();
    });
  });

  describe('getOptimalStrikeSelection', () => {
    it('should recommend wider strikes for high IV', () => {
      const result = getOptimalStrikeSelection(75, 100);
      expect(result.recommendedDelta).toBeLessThan(20);
      expect(result.strikeWidthPercent).toBeGreaterThan(5);
    });

    it('should recommend tighter strikes for low IV', () => {
      const result = getOptimalStrikeSelection(25, 100);
      expect(result.recommendedDelta).toBeGreaterThan(20);
      expect(result.strikeWidthPercent).toBeLessThan(5);
    });
  });
});
```

---

## Phase 8: New Features (Future Enhancements)

### 8.1 Enhanced Keyboard Shortcuts

**File**: `src/App.tsx`

Add new shortcuts for IV-related features:

```typescript
// In your global input handler
const handleInput = (input: string, key: any) => {
  // ... existing shortcuts ...

  // NEW: IV-related shortcuts
  if (input === 'i') {
    dispatch({ type: 'TOGGLE_IV_RANK_DISPLAY' });
  }

  if (input === 'v') {
    dispatch({ type: 'TOGGLE_DATA_SOURCE' });
  }

  if (input === 'r') {
    dispatch({ type: 'REFRESH_IV_METRICS' });
    // Trigger refetch
    refreshIVMetrics();
  }

  if (input === 'p') {
    dispatch({ type: 'TOGGLE_IV_PERCENTILE_DISPLAY' });
  }
};
```

### 8.2 Real-time Streaming (Advanced)

**File**: `src/lib/streaming.ts`

```typescript
/**
 * Real-time Data Streaming
 * Uses Tastytrade DXLink for live Greeks and IV updates
 */

import { TastytradeAPI } from './tastytrade';

export class StreamingManager {
  private tastytrade: TastytradeAPI;
  private activeSubscriptions: Set<string> = new Set();

  constructor(tastytrade: TastytradeAPI) {
    this.tastytrade = tastytrade;
  }

  /**
   * Start streaming Greeks for option contracts
   * Updates are pushed via callback
   */
  async startGreeksStream(
    symbols: string[],
    onUpdate: (greeks: any) => void
  ): Promise<void> {
    await this.tastytrade.subscribeToGreeks(symbols, onUpdate);
    symbols.forEach(s => this.activeSubscriptions.add(s));
  }

  /**
   * Stop all active streams
   */
  async stopAllStreams(): Promise<void> {
    await this.tastytrade.disconnect();
    this.activeSubscriptions.clear();
  }

  /**
   * Get list of active subscriptions
   */
  getActiveSubscriptions(): string[] {
    return Array.from(this.activeSubscriptions);
  }
}
```

### 8.3 IV Rank History Visualization (Future)

**File**: `src/components/IVRankChart.tsx`

```typescript
/**
 * IV Rank History Chart
 * Shows 52-week IV history as a sparkline
 * Future enhancement: requires historical IV data
 */

import React from 'react';
import { Box, Text } from 'ink';
import type { IVMetrics } from '../types';

interface IVRankChartProps {
  ivMetrics: IVMetrics;
  historicalData?: number[]; // Array of historical IV values
}

export const IVRankChart: React.FC<IVRankChartProps> = ({ 
  ivMetrics, 
  historicalData 
}) => {
  // Simple ASCII chart showing current position in 52w range
  const renderSparkline = (): string => {
    const width = 50;
    const position = Math.floor((ivMetrics.ivRank / 100) * width);
    const line = '─'.repeat(width);
    return line.substring(0, position) + '●' + line.substring(position + 1);
  };

  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Text bold color="cyan">IV Rank History (52 weeks)</Text>
      <Box marginTop={1}>
        <Text color="gray">Low: {(ivMetrics.ivLow52Week * 100).toFixed(1)}%</Text>
      </Box>
      <Box>
        <Text color="cyan">{renderSparkline()}</Text>
      </Box>
      <Box>
        <Text color="gray">High: {(ivMetrics.ivHigh52Week * 100).toFixed(1)}%</Text>
      </Box>
      <Box marginTop={1}>
        <Text>
          Current: <Text bold color="green">{(ivMetrics.impliedVolatility * 100).toFixed(1)}%</Text>
          {' '}(Rank: <Text bold>{ivMetrics.ivRank.toFixed(1)}%</Text>)
        </Text>
      </Box>
    </Box>
  );
};
```

### 8.4 IV Rank Alerts

**File**: `src/utils/alerts.ts`

```typescript
/**
 * IV Rank Alert System
 * Notify when IV crosses important thresholds
 */

export interface IVAlert {
  symbol: string;
  previousIVRank: number;
  currentIVRank: number;
  threshold: number;
  direction: 'above' | 'below';
  message: string;
}

export class IVAlertManager {
  private watchlist: Map<string, number> = new Map();
  private thresholds = {
    high: 70,
    sellable: 50,
    neutral: 30
  };

  /**
   * Check if IV Rank crossed a threshold
   */
  checkForAlerts(symbol: string, currentIVRank: number): IVAlert | null {
    const previousIVRank = this.watchlist.get(symbol);
    
    if (previousIVRank === undefined) {
      this.watchlist.set(symbol, currentIVRank);
      return null;
    }

    // Check for threshold crossings
    if (previousIVRank < this.thresholds.sellable && 
        currentIVRank >= this.thresholds.sellable) {
      return {
        symbol,
        previousIVRank,
        currentIVRank,
        threshold: this.thresholds.sellable,
        direction: 'above',
        message: `${symbol} IV Rank crossed above 50% - Good for premium selling!`
      };
    }

    this.watchlist.set(symbol, currentIVRank);
    return null;
  }
}
```

---

## Implementation Priorities

### ✅ Must Have (Weeks 1-2)
**Goal**: Basic Tastytrade integration working

- [ ] Set up Tastytrade API client (`tastytrade.ts`)
- [ ] Add environment configuration (`.env` + `config.ts`)
- [ ] Create type definitions (`types/index.ts`)
- [ ] Install `@tastytrade/api` dependency
- [ ] Display IV Rank in header component
- [ ] Basic data aggregation (Alpaca + Tastytrade)
- [ ] Update test suite with mock data

### 🎯 Should Have (Weeks 3-4)
**Goal**: Full UI integration and strategy enhancements

- [ ] Add IV Rank column to option chain display
- [ ] Implement IV-aware strategy recommendations
- [ ] Add validation warnings for strategies
- [ ] Create status bar showing active data sources
- [ ] Add keyboard shortcuts (`i`, `v`, `r`)
- [ ] Implement caching for IV metrics
- [ ] Comprehensive integration tests
- [ ] Update documentation

### 💡 Nice to Have (Future)
**Goal**: Advanced features for power users

- [ ] Real-time streaming via DXLink
- [ ] IV Rank history visualization (sparkline chart)
- [ ] IV Rank alerts for watchlist
- [ ] Strategy backtesting with IV filters
- [ ] Historical IV data export
- [ ] Bulk IV Rank scanning (screen multiple symbols)
- [ ] Mobile companion app
- [ ] Custom IV Rank calculations (30-day, 90-day, etc.)

---

## Getting Started

### Prerequisites

1. **Tastytrade Account**: Create account at tastytrade.com
2. **OAuth Credentials**: Set up OAuth app at my.tastytrade.com
3. **Node.js**: Version 18+ (already required by your app)

### Step-by-Step Setup

#### 1. Get Tastytrade API Credentials

```bash
# Navigate to: https://my.tastytrade.com
# Go to: Settings > API Settings
# Create new OAuth application
# Save the credentials:
#   - Client Secret
#   - Refresh Token
```

#### 2. Install Dependencies

```bash
cd jesse-option-viewer-tui
npm install @tastytrade/api
```

#### 3. Configure Environment

```bash
# Copy the updated .env.example
cp .env.example .env

# Edit .env and add your credentials
nano .env

# Add these lines:
TASTYTRADE_CLIENT_SECRET=your_client_secret_from_tastytrade
TASTYTRADE_REFRESH_TOKEN=your_refresh_token_from_tastytrade
TASTYTRADE_ENABLED=true
DATA_SOURCE=hybrid
```

#### 4. Create API Client (Week 1)

```bash
# Create the new file
touch src/lib/tastytrade.ts

# Copy the implementation from Phase 1.1
# Test it works:
npm run dev
```

#### 5. Add Type Definitions (Week 1)

```bash
# Edit existing types file
nano src/types/index.ts

# Add the new interfaces from Phase 2.1
# Run type check:
npm run type-check
```

#### 6. Test Basic Integration

```bash
# Run the app in dev mode
npm run dev

# Enter a symbol (e.g., 'AAPL')
# IV Rank should appear in the header if Tastytrade is working

# Check logs for any errors:
tail -f logs/app.log
```

#### 7. Continue with UI Updates (Week 2-3)

Follow the phases sequentially, testing each component before moving to the next.

---

## Architecture Benefits

### Why This Hybrid Approach?

1. **Minimal Risk**: Keeps Alpaca as primary source - if Tastytrade fails, app still works
2. **Best Data**: Alpaca for pricing (fast, reliable), Tastytrade for IV metrics (specialized)
3. **Cost Effective**: Uses free Alpaca tier + Tastytrade account you already need
4. **Flexibility**: Easy to toggle between sources via config
5. **Scalability**: Can add more data sources later (Polygon, IBKR, etc.)
6. **Testability**: Mock each API independently for testing

### Performance Considerations

- **IV Metrics Caching**: 15-minute cache (IV Rank changes slowly)
- **Parallel Fetching**: Fetch Alpaca and Tastytrade data simultaneously
- **Graceful Degradation**: If Tastytrade is down, show Alpaca data only
- **Rate Limiting**: Respect both APIs' rate limits

### Cost Analysis

| Service | Cost | Usage | Notes |
|---------|------|-------|-------|
| Alpaca Markets | Free (Paper) | Unlimited | Pricing, quotes, Greeks |
| Tastytrade API | Free | With account | IV Rank, IV Percentile |
| **Total** | **$0** | - | Both free for paper trading |

---

## Troubleshooting

### Common Issues

#### 1. Tastytrade Authentication Fails

```bash
# Error: "Invalid credentials"
# Solution: Regenerate OAuth tokens at my.tastytrade.com
# Make sure you're using the REFRESH TOKEN, not access token
```

#### 2. IV Metrics Not Showing

```bash
# Check environment variable:
echo $TASTYTRADE_ENABLED
# Should output: true

# Check logs:
tail -f logs/app.log | grep "IV"

# Test API directly:
node -e "const tt = require('./src/lib/tastytrade'); console.log(tt.getIVMetrics('AAPL'))"
```

#### 3. Type Errors After Adding New Types

```bash
# Clear TypeScript cache:
rm -rf node_modules/.cache

# Reinstall:
npm install

# Run type check:
npm run type-check
```

#### 4. Rate Limiting Issues

```bash
# Increase cache duration in config.ts:
cacheDurationMinutes: 30  // Instead of 15

# Add delay between API calls:
await new Promise(resolve => setTimeout(resolve, 1000));
```

---

## Testing Strategy

### Test Coverage Goals

- **Unit Tests**: 80%+ coverage for utility functions
- **Integration Tests**: All API clients tested with real/mock data
- **E2E Tests**: Complete user flows (symbol entry → IV display → strategy selection)

### Running Tests

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/tastytrade.test.ts

# Watch mode during development
npm run test:watch
```

---

## Documentation Updates

### Files to Update

1. **README.md**: Add Tastytrade setup instructions
2. **CLAUDE.md**: Add development guidelines for IV features
3. **API_DOCS.md**: Document new API methods
4. **CHANGELOG.md**: Track version changes

---

## Success Metrics

### Week 1 Goals
- [ ] Tastytrade client working
- [ ] IV Rank displaying in header
- [ ] Type definitions complete
- [ ] Basic tests passing

### Week 2 Goals
- [ ] Data aggregator functional
- [ ] IV Rank in option chain
- [ ] Caching implemented
- [ ] Integration tests passing

### Week 3 Goals
- [ ] Strategy recommendations working
- [ ] Validation warnings showing
- [ ] Keyboard shortcuts functional
- [ ] Documentation updated

### Week 4 Goals
- [ ] All tests passing (100+ tests)
- [ ] Performance optimized
- [ ] Ready for production
- [ ] User feedback collected

---

## Next Steps After Integration

1. **User Testing**: Get feedback from 5-10 users
2. **Performance Tuning**: Optimize API calls and caching
3. **Feature Expansion**: Add IV Rank history chart
4. **Mobile Version**: Consider React Native port
5. **Cloud Deployment**: Deploy to cloud for 24/7 access

---

## Resources

### Documentation
- **Tastytrade API**: https://developer.tastytrade.com/
- **Alpaca Markets**: https://alpaca.markets/docs/
- **React/Ink**: https://github.com/vadimdemedes/ink

### Community
- **Tastytrade Discord**: Join for API support
- **r/tastytrade**: Reddit community
- **GitHub Issues**: Your repo for bug tracking

### Learning
- **Tastytrade Videos**: Free education on IV Rank methodology
- **Options Playbook**: Strategy reference
- **Project Jesse**: Original options education resource

---

## Contact & Support

- **Project Repo**: https://github.com/davek42/jesse-option-viewer-tui
- **Issues**: Use GitHub Issues for bugs
- **Tastytrade Support**: api@tastytrade.com
- **Alpaca Support**: support@alpaca.markets

---

## License

MIT License - Same as existing project

---

## Changelog

### Version 2.0.0 (Planned)
- ✨ Added Tastytrade API integration
- ✨ IV Rank and IV Percentile display
- ✨ IV-aware strategy recommendations
- ✨ Hybrid data source support
- ✨ Enhanced type definitions
- ⚡ Improved caching system
- 📝 Updated documentation
- 🧪 Expanded test suite (150+ tests)

---

**End of Integration Plan**

*Ready to start? Begin with Phase 1: API Client Setup!*
