# IV Rank Calculation Strategy for Alpaca API
## Self-Contained IV Rank Calculation Using Alpaca Data

**Project**: jesse-option-viewer-tui  
**Data Source**: Alpaca Markets API (No Tastytrade Required)  
**Strategy**: Calculate IV Rank from historical option chain snapshots  
**Timeline**: 2-3 weeks  
**Last Updated**: October 29, 2025

---

## Table of Contents
1. [Overview](#overview)
2. [Why This Approach Works](#why-this-approach-works)
3. [Alpaca Data Available](#alpaca-data-available)
4. [Architecture Strategy](#architecture-strategy)
5. [Implementation Plan](#implementation-plan)
6. [Phase 1: Historical IV Collection](#phase-1-historical-iv-collection)
7. [Phase 2: IV Rank Calculator](#phase-2-iv-rank-calculator)
8. [Phase 3: Smart Caching Layer](#phase-3-smart-caching-layer)
9. [Phase 4: Pre-Market Batch Job](#phase-4-pre-market-batch-job)
10. [Phase 5: UI Integration](#phase-5-ui-integration)
11. [Comparison: Alpaca vs IBKR vs Tastytrade](#comparison-alpaca-vs-ibkr-vs-tastytrade)
12. [Getting Started](#getting-started)

---

## Overview

### The Challenge

Alpaca Markets API provides excellent real-time options data, but **does NOT provide IV Rank or IV Percentile** metrics. However, unlike IBKR, Alpaca's option chain endpoint provides:

- ✅ **Implied Volatility per contract** (in snapshot data)
- ✅ **Greeks** (including implied volatility)
- ✅ **Historical bars** for underlying stocks
- ✅ **Fast API responses** (<500ms for option chains)

### The Solution

**Calculate IV Rank locally using Alpaca's historical option data:**

1. **Collect historical IV data** by fetching ATM option IV daily
2. **Build 52-week dataset** of underlying IV values
3. **Calculate IV Rank** using the standard formula
4. **Cache results** for instant lookups
5. **Update incrementally** each day

### Key Advantages Over IBKR Approach

| Feature | Alpaca Approach | IBKR Approach |
|---------|----------------|---------------|
| **Initial setup** | ✅ Simpler (no separate IV history API) | ⚠️ Complex historical IV queries |
| **Data freshness** | ✅ Real-time option IV available | ⚠️ 15-30s for historical query |
| **API complexity** | ✅ Single endpoint (option chain) | ⚠️ Multiple endpoints needed |
| **Free tier** | ✅ Generous free tier | ⚠️ May require market data subscription |
| **Batch processing** | ✅ Fast (<1s per symbol) | ⚠️ Slow (10-30s per symbol) |

---

## Why This Approach Works

### The Key Insight: ATM Options Reflect Underlying IV

When you fetch an option chain from Alpaca, **each contract has its own implied volatility**. However:

- **ATM (At-The-Money) options** have IV closest to the underlying's "true" IV
- We can **extract ATM IV daily** and build a historical dataset
- This gives us the **52-week IV range** needed for IV Rank

### Example - AAPL Option Chain Response

```json
{
  "snapshots": {
    "AAPL250919C00175000": {
      "impliedVolatility": 0.2315,  // This contract's IV
      "greeks": {
        "delta": 0.52,
        "vega": 0.23
      }
    },
    "AAPL250919C00180000": {
      "impliedVolatility": 0.2289,  // ATM ← Use this
      "greeks": { "delta": 0.48 }
    },
    "AAPL250919C00185000": {
      "impliedVolatility": 0.2405,  // OTM
      "greeks": { "delta": 0.42 }
    }
  }
}
```

**We extract the ATM IV (0.2289 in this case) and save it as today's underlying IV for AAPL.**

### The Process

```
Day 1:  Fetch AAPL chain → ATM IV = 0.23 → Save to database
Day 2:  Fetch AAPL chain → ATM IV = 0.25 → Save to database
Day 3:  Fetch AAPL chain → ATM IV = 0.24 → Save to database
...
Day 365: Have 365 IV data points
         Calculate: IV Rank = (current - min) / (max - min) × 100
```

---

## Alpaca Data Available

### Option Chain Endpoint

**Endpoint**: `GET /v1beta1/options/snapshots/{underlying_symbol}`

**Returns**:
```typescript
{
  "next_page_token": "...",
  "snapshots": {
    "CONTRACT_SYMBOL": {
      "impliedVolatility": 0.2315,    // ← What we need!
      "greeks": {
        "delta": 0.5121,
        "gamma": 0.0841,
        "theta": -0.2038,
        "vega": 0.1073,
        "rho": 0.0159
      },
      "latestQuote": { /* bid/ask data */ },
      "latestTrade": { /* trade data */ }
    }
  }
}
```

### What We'll Use

1. **Option Chain Snapshot** - Get all contracts for a symbol
2. **Implied Volatility** - Extract from ATM options
3. **Contract Details** - Identify which options are ATM

### What We Don't Need

- ❌ Tastytrade API (too complex)
- ❌ Separate historical IV endpoint (doesn't exist)
- ❌ Third-party data providers (costly)

---

## Architecture Strategy

### System Design

```
┌─────────────────────────────────────────────────────────────────┐
│                jesse-option-viewer-tui                          │
├─────────────────────────────────────────────────────────────────┤
│  UI Layer                                                       │
│    - Header with IV Rank display (instant lookup)              │
│    - Option chain with IV metrics                              │
│    - Manual refresh button                                     │
├─────────────────────────────────────────────────────────────────┤
│  IV Rank Provider (Smart Cache) ← NEW                          │
│    - getIVRank(symbol) → instant from cache                    │
│    - Fallback to real-time calculation if needed               │
│    - Incremental updates (append today's IV)                   │
├─────────────────────────────────────────────────────────────────┤
│  IV Rank Calculator ← NEW                                       │
│    - extractATM_IV(optionChain) → today's IV                   │
│    - calculateIVRank(historicalIVs) → IV Rank %               │
│    - Validates data quality                                    │
├─────────────────────────────────────────────────────────────────┤
│  IV Database (SQLite) ← NEW                                     │
│    - Stores daily IV values (365 days per symbol)             │
│    - Caches calculated IV Rank (24h TTL)                      │
│    - Watchlist management                                      │
├─────────────────────────────────────────────────────────────────┤
│  Alpaca Client (Existing)                                       │
│    - Fetches option chain snapshots                            │
│    - Fast API calls (<500ms)                                   │
├─────────────────────────────────────────────────────────────────┤
│  Pre-Market Batch Job ← NEW                                     │
│    - Runs daily at 8:00 AM ET                                  │
│    - Updates IV for watchlist symbols                          │
│    - Takes 1-2 minutes for 20 symbols                          │
└─────────────────────────────────────────────────────────────────┘
```

### Data Flow

#### Daily Batch Update (8:00 AM ET)
```
1. Cron job triggers
   ↓
2. For each watchlist symbol:
   ↓
3. Fetch option chain from Alpaca
   ↓
4. Extract ATM option IV (delta ~0.50)
   ↓
5. Save to database: (AAPL, 2025-10-29, 0.2315)
   ↓
6. Calculate IV Rank from 365 days of data
   ↓
7. Cache IV Rank result (valid 24 hours)
   ↓
8. Next symbol
```

#### User Lookup (During Trading Hours)
```
1. User views AAPL
   ↓
2. Check cache: getIVRank('AAPL')
   ↓
3. Cache hit! (4 hours old, still fresh)
   ↓
4. Return IV Rank: 65.2%
   ↓
5. Display instantly in UI (0ms)
```

---

## Implementation Plan

### Timeline Overview

| Week | Phase | Deliverable |
|------|-------|-------------|
| 1 | Database + Calculator | Can extract and store IV |
| 2 | Smart Provider + Batch | Automated daily updates |
| 3 | UI Integration + Polish | Production ready |

---

## Phase 1: Historical IV Collection

### 1.1 ATM IV Extractor

**File**: `src/lib/atmIVExtractor.ts`

```typescript
import type { OptionSnapshot } from '../types';

/**
 * Extracts the ATM (At-The-Money) implied volatility from an option chain
 * ATM options have delta closest to ±0.50 (calls) or ∓0.50 (puts)
 */
export class ATMIVExtractor {
  
  /**
   * Get the "underlying IV" from an option chain
   * Strategy: Find the ATM call and put, average their IVs
   * 
   * @param optionChain - Alpaca option chain snapshots
   * @param currentPrice - Current stock price
   * @returns Underlying IV as decimal (e.g., 0.25 = 25%)
   */
  extractUnderlyingIV(
    optionChain: Record<string, OptionSnapshot>,
    currentPrice: number
  ): number | null {
    
    // Parse all contracts
    const calls: Array<{ strike: number; iv: number; delta: number }> = [];
    const puts: Array<{ strike: number; iv: number; delta: number }> = [];
    
    for (const [symbol, snapshot] of Object.entries(optionChain)) {
      if (!snapshot.impliedVolatility || !snapshot.greeks?.delta) {
        continue; // Skip if missing data
      }
      
      const strike = this.parseStrike(symbol);
      const iv = snapshot.impliedVolatility;
      const delta = Math.abs(snapshot.greeks.delta);
      
      if (symbol.includes('C')) {
        calls.push({ strike, iv, delta });
      } else if (symbol.includes('P')) {
        puts.push({ strike, iv, delta });
      }
    }
    
    if (calls.length === 0 && puts.length === 0) {
      return null; // No valid options found
    }
    
    // Find ATM call (delta closest to 0.50)
    const atmCall = this.findATM(calls, 0.50);
    
    // Find ATM put (delta closest to 0.50, already abs value)
    const atmPut = this.findATM(puts, 0.50);
    
    // Average the two (if both available)
    if (atmCall && atmPut) {
      return (atmCall.iv + atmPut.iv) / 2;
    } else if (atmCall) {
      return atmCall.iv;
    } else if (atmPut) {
      return atmPut.iv;
    }
    
    return null;
  }
  
  /**
   * Find the option with delta closest to target
   */
  private findATM(
    options: Array<{ strike: number; iv: number; delta: number }>,
    targetDelta: number
  ): { strike: number; iv: number; delta: number } | null {
    
    if (options.length === 0) return null;
    
    // Sort by how close delta is to target
    const sorted = options.sort((a, b) => {
      const diffA = Math.abs(a.delta - targetDelta);
      const diffB = Math.abs(b.delta - targetDelta);
      return diffA - diffB;
    });
    
    return sorted[0];
  }
  
  /**
   * Parse strike price from Alpaca option symbol
   * Format: AAPL251219C00180000 → 180.00
   */
  private parseStrike(symbol: string): number {
    // Last 8 digits are strike * 1000
    // Example: 00180000 → 180.00
    const strikeStr = symbol.slice(-8);
    return parseInt(strikeStr) / 1000;
  }
  
  /**
   * Validate IV value is reasonable
   */
  private isValidIV(iv: number): boolean {
    // IV should be between 5% and 300%
    return iv >= 0.05 && iv <= 3.0;
  }
}
```

### 1.2 Database Schema

**File**: `src/lib/schema.sql`

```sql
-- Historical IV data (raw daily IVs)
CREATE TABLE IF NOT EXISTS historical_iv (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,        -- ISO date: '2025-10-29'
  iv REAL NOT NULL,           -- Decimal: 0.25 = 25%
  source TEXT DEFAULT 'alpaca',
  extraction_method TEXT DEFAULT 'atm_average',
  UNIQUE(symbol, date)
);

-- Calculated IV Rank metrics (cached results)
CREATE TABLE IF NOT EXISTS iv_metrics (
  symbol TEXT PRIMARY KEY,
  iv_rank REAL NOT NULL,
  implied_volatility REAL NOT NULL,
  iv_high_52w REAL NOT NULL,
  iv_low_52w REAL NOT NULL,
  calculated_at TEXT NOT NULL,
  data_source TEXT DEFAULT 'alpaca'
);

-- Watchlist symbols
CREATE TABLE IF NOT EXISTS watchlist (
  symbol TEXT PRIMARY KEY,
  priority INTEGER DEFAULT 0,
  last_updated TEXT,
  enabled BOOLEAN DEFAULT 1
);

-- Indices for performance
CREATE INDEX IF NOT EXISTS idx_symbol_date 
  ON historical_iv(symbol, date DESC);

CREATE INDEX IF NOT EXISTS idx_calculated_at 
  ON iv_metrics(calculated_at DESC);
```

### 1.3 IV Collection Service

**File**: `src/lib/ivCollectionService.ts`

```typescript
import { AlpacaClient } from './alpaca';
import { ATMIVExtractor } from './atmIVExtractor';
import { IVRankDatabase } from './ivRankDatabase';

/**
 * Service for collecting and storing historical IV data
 */
export class IVCollectionService {
  private alpaca: AlpacaClient;
  private extractor: ATMIVExtractor;
  private db: IVRankDatabase;
  
  constructor(alpaca: AlpacaClient, db: IVRankDatabase) {
    this.alpaca = alpaca;
    this.extractor = new ATMIVExtractor();
    this.db = db;
  }
  
  /**
   * Collect today's IV for a symbol
   * 
   * @param symbol - Stock symbol (e.g., 'AAPL')
   * @returns Today's IV value
   */
  async collectTodaysIV(symbol: string): Promise<number> {
    console.log(`Collecting IV for ${symbol}...`);
    
    // 1. Get current stock price
    const quote = await this.alpaca.getStockQuote(symbol);
    const currentPrice = quote.ap; // Ask price
    
    // 2. Get option chain (use indicative feed for free tier)
    const optionChain = await this.alpaca.getOptionChain(symbol, {
      feed: 'indicative',  // Free tier
      limit: 100           // Get enough contracts to find ATM
    });
    
    if (Object.keys(optionChain.snapshots).length === 0) {
      throw new Error(`No option data available for ${symbol}`);
    }
    
    // 3. Extract ATM IV
    const underlyingIV = this.extractor.extractUnderlyingIV(
      optionChain.snapshots,
      currentPrice
    );
    
    if (!underlyingIV) {
      throw new Error(`Could not extract ATM IV for ${symbol}`);
    }
    
    // 4. Save to database
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    this.db.upsertHistoricalIV(symbol, [{
      date: new Date(today),
      iv: underlyingIV
    }]);
    
    console.log(`✓ ${symbol}: IV = ${(underlyingIV * 100).toFixed(2)}%`);
    
    return underlyingIV;
  }
  
  /**
   * Backfill historical IV data
   * Note: This is slow - only run once per symbol
   * 
   * Strategy: Fetch option chains for past dates (if available)
   * Limitation: Alpaca doesn't provide historical option snapshots easily
   * Workaround: Start collecting today, wait for data to accumulate
   */
  async backfillHistoricalIV(symbol: string, days: number = 30): Promise<void> {
    console.log(`⚠️  Note: Alpaca doesn't provide easy historical option data access`);
    console.log(`Starting fresh data collection for ${symbol}`);
    
    // For now, just collect today's IV
    // Historical data will accumulate naturally over time
    await this.collectTodaysIV(symbol);
    
    console.log(`Historical data will grow as daily batch job runs`);
  }
  
  /**
   * Get the number of historical IV data points for a symbol
   */
  getHistoricalDataCount(symbol: string): number {
    const data = this.db.getHistoricalIV(symbol, 365);
    return data.length;
  }
}
```

---

## Phase 2: IV Rank Calculator

### 2.1 IV Rank Calculator

**File**: `src/lib/ivRankCalculator.ts`

```typescript
import type { IVMetrics, HistoricalIVData } from '../types';

/**
 * Calculate IV Rank from historical IV data
 * Formula: IV Rank = (Current IV - 52w Low) / (52w High - 52w Low) × 100
 */
export class IVRankCalculator {
  
  /**
   * Calculate IV Rank metrics
   * 
   * @param symbol - Stock symbol
   * @param currentIV - Current implied volatility (decimal)
   * @param historicalData - Array of historical IV data points
   * @returns IV Rank metrics
   */
  static calculateIVMetrics(
    symbol: string,
    currentIV: number,
    historicalData: HistoricalIVData[]
  ): IVMetrics {
    
    if (historicalData.length === 0) {
      throw new Error(`No historical data for ${symbol}`);
    }
    
    // Extract IV values
    const ivValues = historicalData.map(d => d.iv);
    
    // Calculate 52-week high and low
    const ivHigh52Week = Math.max(...ivValues);
    const ivLow52Week = Math.min(...ivValues);
    
    // Calculate IV Rank
    let ivRank = 0;
    if (ivHigh52Week > ivLow52Week) {
      ivRank = ((currentIV - ivLow52Week) / (ivHigh52Week - ivLow52Week)) * 100;
      
      // Clamp to 0-100 range
      ivRank = Math.max(0, Math.min(100, ivRank));
    }
    
    return {
      symbol,
      ivRank: Number(ivRank.toFixed(2)),
      ivPercentile: 0, // Not calculated in this approach
      impliedVolatility: currentIV,
      ivHigh52Week,
      ivLow52Week,
      timestamp: new Date()
    };
  }
  
  /**
   * Calculate IV Rank with validation
   * Ensures we have enough data points for accurate calculation
   */
  static calculateWithValidation(
    symbol: string,
    currentIV: number,
    historicalData: HistoricalIVData[],
    minDataPoints: number = 30
  ): IVMetrics {
    
    const dataPoints = historicalData.length;
    
    if (dataPoints < minDataPoints) {
      console.warn(
        `⚠️  ${symbol}: Only ${dataPoints} data points (recommend ${minDataPoints}+)`
      );
      console.warn(`   IV Rank calculation may be less accurate`);
    }
    
    return this.calculateIVMetrics(symbol, currentIV, historicalData);
  }
  
  /**
   * Get data quality metrics
   */
  static getDataQuality(historicalData: HistoricalIVData[]): {
    dataPoints: number;
    coverage: string;
    oldest: Date;
    newest: Date;
    gaps: number;
  } {
    
    if (historicalData.length === 0) {
      return {
        dataPoints: 0,
        coverage: '0%',
        oldest: new Date(),
        newest: new Date(),
        gaps: 0
      };
    }
    
    const sorted = [...historicalData].sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );
    
    const oldest = sorted[0].date;
    const newest = sorted[sorted.length - 1].date;
    
    // Calculate gaps (missing days)
    const totalDays = Math.floor(
      (newest.getTime() - oldest.getTime()) / (1000 * 60 * 60 * 24)
    );
    const gaps = totalDays - historicalData.length;
    
    // Coverage percentage (252 trading days/year)
    const coveragePercent = (historicalData.length / 252) * 100;
    
    return {
      dataPoints: historicalData.length,
      coverage: `${Math.min(100, coveragePercent).toFixed(1)}%`,
      oldest,
      newest,
      gaps: Math.max(0, gaps)
    };
  }
}
```

---

## Phase 3: Smart Caching Layer

### 3.1 Smart IV Rank Provider

**File**: `src/lib/smartIVRankProvider.ts`

```typescript
import { AlpacaClient } from './alpaca';
import { IVRankDatabase } from './ivRankDatabase';
import { IVCollectionService } from './ivCollectionService';
import { IVRankCalculator } from './ivRankCalculator';
import type { IVMetrics } from '../types';

export interface IVRankOptions {
  forceRealTime?: boolean;
  maxCacheAgeHours?: number;
}

/**
 * Smart IV Rank Provider with caching
 * Primary interface for getting IV Rank data
 */
export class SmartIVRankProvider {
  private alpaca: AlpacaClient;
  private db: IVRankDatabase;
  private collector: IVCollectionService;
  
  constructor(alpaca: AlpacaClient, dbPath?: string) {
    this.alpaca = alpaca;
    this.db = new IVRankDatabase(dbPath);
    this.collector = new IVCollectionService(alpaca, this.db);
  }
  
  /**
   * Get IV Rank with intelligent caching
   * 
   * Fast path: Return cached IV Rank (0ms)
   * Slow path: Calculate from historical data (1-2s)
   */
  async getIVRank(
    symbol: string,
    options: IVRankOptions = {}
  ): Promise<IVMetrics> {
    
    const maxAge = options.maxCacheAgeHours || 24;
    
    // Fast path: Use cache
    if (!options.forceRealTime) {
      const cached = this.db.getIVMetrics(symbol);
      
      if (cached && !this.db.isStale(symbol, maxAge)) {
        const ageHours = (Date.now() - cached.timestamp.getTime()) / (1000 * 60 * 60);
        console.log(`✓ Using cached IV Rank for ${symbol} (${ageHours.toFixed(1)}h old)`);
        return cached;
      }
    }
    
    // Slow path: Calculate
    console.log(`Calculating IV Rank for ${symbol}...`);
    
    // Check if we need to collect today's IV
    const today = new Date().toISOString().split('T')[0];
    const latestDate = this.db.getLatestIVDate(symbol);
    
    if (!latestDate || latestDate.toISOString().split('T')[0] !== today) {
      // Collect today's IV
      await this.collector.collectTodaysIV(symbol);
    }
    
    // Get historical data
    const historicalData = this.db.getHistoricalIV(symbol, 365);
    
    if (historicalData.length === 0) {
      throw new Error(`No historical IV data for ${symbol}. Run daily batch job to collect data.`);
    }
    
    // Get current IV (most recent)
    const currentIV = historicalData[historicalData.length - 1].iv;
    
    // Calculate IV Rank
    const ivMetrics = IVRankCalculator.calculateWithValidation(
      symbol,
      currentIV,
      historicalData,
      30  // Minimum 30 data points recommended
    );
    
    // Cache the result
    this.db.upsertIVMetrics(ivMetrics);
    
    console.log(`✓ ${symbol} IV Rank: ${ivMetrics.ivRank.toFixed(1)}%`);
    return ivMetrics;
  }
  
  /**
   * Batch update multiple symbols (for pre-market job)
   */
  async batchUpdate(symbols: string[]): Promise<Map<string, IVMetrics>> {
    const results = new Map<string, IVMetrics>();
    
    for (const symbol of symbols) {
      try {
        const metrics = await this.getIVRank(symbol, { forceRealTime: true });
        results.set(symbol, metrics);
        
        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 500));
        
      } catch (error) {
        console.error(`Failed to update ${symbol}:`, error);
      }
    }
    
    return results;
  }
  
  /**
   * Get data quality report for a symbol
   */
  getDataQuality(symbol: string) {
    const historicalData = this.db.getHistoricalIV(symbol, 365);
    return IVRankCalculator.getDataQuality(historicalData);
  }
  
  /**
   * Initialize a new symbol (start collecting data)
   */
  async initializeSymbol(symbol: string): Promise<void> {
    console.log(`Initializing ${symbol}...`);
    
    // Collect today's IV
    await this.collector.collectTodaysIV(symbol);
    
    // Add to watchlist
    this.db.addToWatchlist(symbol);
    
    console.log(`✓ ${symbol} added to watchlist. Data collection starts today.`);
    console.log(`  IV Rank will be available after 30+ days of data collection.`);
  }
  
  /**
   * Get statistics
   */
  getStats() {
    return this.db.getStats();
  }
  
  /**
   * Cleanup old data
   */
  cleanup() {
    this.db.cleanupOldData(400);
  }
  
  /**
   * Close database
   */
  close() {
    this.db.close();
  }
}
```

---

## Phase 4: Pre-Market Batch Job

### 4.1 Daily IV Collection Script

**File**: `scripts/daily-iv-collection.ts`

```typescript
#!/usr/bin/env node
/**
 * Daily IV Collection Batch Job
 * 
 * Runs every trading day at 8:00 AM ET
 * Collects ATM IV for all watchlist symbols
 * 
 * Usage:
 *   npm run collect-iv
 *   node scripts/daily-iv-collection.js --symbols AAPL,SPY,QQQ
 */

import { AlpacaClient } from '../src/lib/alpaca';
import { SmartIVRankProvider } from '../src/lib/smartIVRankProvider';
import { IVRankDatabase } from '../src/lib/ivRankDatabase';

async function main() {
  console.log('=== Daily IV Collection ===');
  console.log(`Started: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET\n`);
  
  // Parse command line arguments
  const args = process.argv.slice(2);
  const symbolsArg = args.find(arg => arg.startsWith('--symbols='));
  
  let symbols: string[];
  
  if (symbolsArg) {
    symbols = symbolsArg.split('=')[1].split(',').map(s => s.trim());
  } else {
    const db = new IVRankDatabase();
    symbols = db.getWatchlist();
    db.close();
    
    if (symbols.length === 0) {
      console.warn('⚠️  Watchlist is empty. Use: npm run add-to-watchlist AAPL');
      process.exit(0);
    }
  }
  
  console.log(`Processing ${symbols.length} symbols: ${symbols.join(', ')}\n`);
  
  // Initialize Alpaca client
  const alpaca = new AlpacaClient({
    keyId: process.env.ALPACA_API_KEY!,
    secretKey: process.env.ALPACA_API_SECRET!,
    paper: true
  });
  
  const provider = new SmartIVRankProvider(alpaca);
  
  // Collect IV for each symbol
  const results: Array<{ 
    symbol: string; 
    iv: number; 
    ivRank: number; 
    dataPoints: number;
    status: string;
  }> = [];
  
  let successCount = 0;
  let failCount = 0;
  
  for (let i = 0; i < symbols.length; i++) {
    const symbol = symbols[i];
    const progress = `[${i + 1}/${symbols.length}]`;
    
    try {
      console.log(`${progress} Processing ${symbol}...`);
      const startTime = Date.now();
      
      // Force recalculation to get today's IV
      const metrics = await provider.getIVRank(symbol, { forceRealTime: true });
      const quality = provider.getDataQuality(symbol);
      
      const elapsed = Date.now() - startTime;
      console.log(
        `${progress} ✓ ${symbol}: ` +
        `IV = ${(metrics.impliedVolatility * 100).toFixed(2)}%, ` +
        `Rank = ${metrics.ivRank.toFixed(1)}% ` +
        `(${quality.dataPoints} days, ${elapsed}ms)`
      );
      
      results.push({
        symbol,
        iv: metrics.impliedVolatility,
        ivRank: metrics.ivRank,
        dataPoints: quality.dataPoints,
        status: 'success'
      });
      successCount++;
      
    } catch (error) {
      console.error(`${progress} ❌ ${symbol}: ${error}`);
      results.push({
        symbol,
        iv: 0,
        ivRank: 0,
        dataPoints: 0,
        status: 'failed'
      });
      failCount++;
    }
    
    // Rate limiting delay
    if (i < symbols.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  // Summary
  console.log('\n=== Summary ===');
  console.log(`Completed: ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York' })} ET`);
  console.log(`Success: ${successCount} | Failed: ${failCount}\n`);
  
  if (successCount > 0) {
    console.log('IV Rank Results (sorted by IV Rank):');
    results
      .filter(r => r.status === 'success')
      .sort((a, b) => b.ivRank - a.ivRank)
      .forEach(r => {
        const emoji = r.ivRank >= 70 ? '🟢' : r.ivRank >= 50 ? '🟡' : '🔴';
        console.log(
          `  ${emoji} ${r.symbol.padEnd(6)} ` +
          `Rank: ${r.ivRank.toFixed(1).padStart(5)}% ` +
          `IV: ${(r.iv * 100).toFixed(2).padStart(6)}% ` +
          `(${r.dataPoints} days)`
        );
      });
  }
  
  // Warnings for symbols with insufficient data
  const insufficientData = results.filter(r => r.dataPoints < 30);
  if (insufficientData.length > 0) {
    console.log('\n⚠️  Symbols with insufficient data (<30 days):');
    insufficientData.forEach(r => {
      console.log(`  ${r.symbol}: ${r.dataPoints} days (need 30+ for accurate IV Rank)`);
    });
  }
  
  // Database stats
  const stats = provider.getStats();
  console.log('\nDatabase Stats:');
  console.log(`  Cached symbols: ${stats.totalSymbols}`);
  console.log(`  Historical data points: ${stats.historicalDataPoints}`);
  console.log(`  Last update: ${stats.lastUpdate?.toLocaleString('en-US', { timeZone: 'America/New_York' })}`);
  
  // Cleanup
  provider.cleanup();
  provider.close();
  
  console.log('\n✓ Daily IV collection complete!');
  process.exit(0);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
```

### 4.2 Cron Configuration

**File**: Add to system crontab or use cron-like scheduler

```bash
# Daily IV collection at 8:00 AM ET (before market open)
# Runs Monday-Friday

# For development (macOS/Linux)
0 8 * * 1-5 cd /path/to/jesse-option-viewer-tui && npm run collect-iv >> logs/iv-collection.log 2>&1

# For production
TZ=America/New_York
0 8 * * 1-5 cd /app && npm run collect-iv >> /app/logs/iv-collection.log 2>&1

# Optional: Weekly cleanup (Sunday 2 AM)
0 2 * * 0 cd /app && npm run cleanup-iv >> /app/logs/cleanup.log 2>&1
```

### 4.3 Package.json Scripts

**File**: `package.json`

```json
{
  "scripts": {
    "collect-iv": "ts-node scripts/daily-iv-collection.ts",
    "add-to-watchlist": "ts-node scripts/manage-watchlist.ts add",
    "show-watchlist": "ts-node scripts/manage-watchlist.ts list",
    "show-iv-stats": "ts-node scripts/show-iv-stats.ts",
    "cleanup-iv": "ts-node scripts/cleanup-old-data.ts",
    "init-symbol": "ts-node scripts/init-symbol.ts"
  }
}
```

---

## Phase 5: UI Integration

### 5.1 Update Header Component

**File**: `src/components/Header.tsx`

```typescript
import React, { useEffect, useState } from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext';

export const Header: React.FC = () => {
  const { state } = useAppContext();
  const [ivMetrics, setIvMetrics] = useState<IVMetrics | null>(null);
  
  useEffect(() => {
    if (state.symbol && state.provider) {
      state.provider.getIVRank(state.symbol)
        .then(setIvMetrics)
        .catch(error => {
          console.error('Failed to get IV Rank:', error);
          setIvMetrics(null);
        });
    }
  }, [state.symbol]);
  
  const getIVRankColor = (ivRank: number): string => {
    if (ivRank >= 70) return 'green';
    if (ivRank >= 50) return 'cyan';
    if (ivRank >= 30) return 'yellow';
    return 'red';
  };
  
  const getIVRankLabel = (ivRank: number): string => {
    if (ivRank >= 70) return '📈 Very High - Excellent for premium selling';
    if (ivRank >= 50) return '📊 High - Good for premium selling';
    if (ivRank >= 30) return '📉 Moderate';
    return '📉 Low - Better for buying options';
  };
  
  return (
    <Box flexDirection="column" borderStyle="round" borderColor="cyan" padding={1}>
      <Box>
        <Text bold color="cyan">{state.symbol}</Text>
        <Text> | </Text>
        <Text>${state.currentPrice?.toFixed(2)}</Text>
      </Box>
      
      {ivMetrics && (
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text color="gray">IV Rank: </Text>
            <Text bold color={getIVRankColor(ivMetrics.ivRank)}>
              {ivMetrics.ivRank.toFixed(1)}%
            </Text>
            <Text color="gray"> | Current IV: </Text>
            <Text bold>{(ivMetrics.impliedVolatility * 100).toFixed(2)}%</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>{getIVRankLabel(ivMetrics.ivRank)}</Text>
          </Box>
          <Box>
            <Text color="gray" dimColor>
              52w Range: {(ivMetrics.ivLow52Week * 100).toFixed(1)}% - {(ivMetrics.ivHigh52Week * 100).toFixed(1)}%
            </Text>
          </Box>
        </Box>
      )}
      
      {!ivMetrics && state.symbol && (
        <Box marginTop={1}>
          <Text color="yellow" dimColor>
            ⏳ Collecting IV data for {state.symbol}... (takes 30+ days)
          </Text>
        </Box>
      )}
    </Box>
  );
};
```

---

## Comparison: Alpaca vs IBKR vs Tastytrade

### Data Source Comparison

| Feature | Alpaca (This Plan) | IBKR | Tastytrade |
|---------|-------------------|------|------------|
| **Setup complexity** | ⭐⭐ Medium | ⭐⭐⭐ Complex | ⭐ Simple |
| **Free tier** | ✅ Generous | ⚠️ Limited | ✅ Yes (with account) |
| **IV Rank provided** | ❌ Must calculate | ❌ Must calculate | ✅ Direct API |
| **Historical IV access** | ⚠️ Via option chains | ✅ Direct endpoint | ✅ Direct API |
| **Batch processing speed** | ⚡ Fast (1s/symbol) | 🐌 Slow (30s/symbol) | ⚡ Fast (<1s/symbol) |
| **Real-time accuracy** | ✅ Excellent | ✅ Excellent | ✅ Excellent |
| **API documentation** | ✅ Great | ⚠️ Complex | ✅ Excellent |
| **Additional dependencies** | ❌ None | ❌ None | ✅ Requires Tastytrade account |

### Implementation Complexity

| Task | Alpaca | IBKR | Tastytrade |
|------|--------|------|------------|
| Get current IV | Extract from ATM options | Query option chain | Direct API call |
| Get historical IV | Daily batch collection | Historical IV request | Direct API call |
| Calculate IV Rank | Custom logic | Custom logic | Provided by API |
| Storage needed | SQLite (5-10 MB) | SQLite (5-10 MB) | Optional caching |
| Dev time | 2-3 weeks | 3-4 weeks | 1 week |

### Recommendation

**Use Alpaca (this plan) if:**
- ✅ You're already using Alpaca for options data
- ✅ You want a self-contained solution
- ✅ You don't want to manage multiple API integrations
- ✅ Free tier is important

**Use Tastytrade if:**
- ✅ You have a Tastytrade account
- ✅ You want instant IV Rank without calculation
- ✅ Simplicity > control

**Use IBKR if:**
- ✅ You're already using IBKR for trading
- ✅ You need institutional-grade data
- ✅ You don't mind the complexity

---

## Getting Started

### Prerequisites

1. **Alpaca Account**: Sign up at alpaca.markets (free paper trading)
2. **API Keys**: Get API key and secret from dashboard
3. **Node.js**: Version 18+ required

### Quick Start Guide

#### Step 1: Install Dependencies

```bash
cd jesse-option-viewer-tui

# Install SQLite
npm install better-sqlite3 @types/better-sqlite3

# Verify Alpaca SDK is installed
npm list @alpacahq/alpaca-trade-api
```

#### Step 2: Configure Environment

```bash
# .env file
ALPACA_API_KEY=your_paper_api_key
ALPACA_API_SECRET=your_paper_api_secret
ALPACA_PAPER=true

# Enable IV Rank features
ENABLE_IV_RANK=true
IV_RANK_METHOD=alpaca_atm_extraction
```

#### Step 3: Initialize Database

```bash
# Create database structure
npm run init-database

# Add symbols to watchlist
npm run add-to-watchlist AAPL SPY QQQ TSLA NVDA
```

#### Step 4: First Data Collection

```bash
# Manually trigger data collection
npm run collect-iv

# Expected output:
# [1/5] Processing AAPL...
# ✓ AAPL: IV = 25.31%, Rank = N/A (1 days)
# ...
# ⚠️  Symbols need 30+ days for accurate IV Rank
```

#### Step 5: Set Up Cron Job

```bash
# For macOS (using launchd - recommended)
cp scripts/launchd/com.user.ivrank.daily.plist ~/Library/LaunchAgents/
launchctl load ~/Library/LaunchAgents/com.user.ivrank.daily.plist

# For Linux (crontab)
crontab -e
# Add: 0 8 * * 1-5 cd /path/to/app && npm run collect-iv >> logs/iv.log 2>&1
```

#### Step 6: Test IV Rank Display

```bash
# After 30+ days of data collection, run the app
npm run dev

# Enter a symbol
# IV Rank should display in header
```

### Expected Timeline

| Day | What Happens |
|-----|--------------|
| **Day 1** | First IV collection (1 data point) |
| **Day 7** | 7 data points - IV Rank calculation starts but unreliable |
| **Day 30** | 30 data points - IV Rank reasonably accurate |
| **Day 60** | 60 data points - Good accuracy |
| **Day 252** | Full year - Highly accurate IV Rank |

### Monitoring

```bash
# Check collection logs
tail -f logs/iv-collection.log

# View database stats
npm run show-iv-stats

# Check data quality for a symbol
npm run data-quality AAPL
```

---

## Advantages of This Approach

### 1. **Self-Contained**
- No external API dependencies beyond Alpaca
- No Tastytrade account required
- No IBKR complexity

### 2. **Cost-Effective**
- Uses free Alpaca paper trading tier
- No market data subscription fees
- Minimal storage costs

### 3. **Fast Performance**
- <500ms per symbol for data collection
- 0ms IV Rank lookups (cached)
- Efficient batch processing

### 4. **Grows Better Over Time**
- IV Rank accuracy improves as data accumulates
- Natural historical dataset builds automatically
- No need to backfill (start fresh, grow daily)

### 5. **Educational Value**
- Understand how IV Rank is calculated
- Full control over calculation methodology
- Can customize for different time windows (30-day, 90-day)

---

## Limitations & Workarounds

### Limitation 1: Initial Data Collection Period

**Problem**: Need 30+ days before IV Rank is accurate

**Workarounds**:
1. Start with high-priority symbols first
2. Show data quality indicator in UI
3. Offer manual "force refresh" for impatient users
4. Display "Collecting data..." message for new symbols

### Limitation 2: No Easy Historical Backfill

**Problem**: Can't easily fetch past IV data from Alpaca

**Workarounds**:
1. Accept natural growth (patient approach)
2. Use third-party data source for initial backfill (Polygon.io)
3. Start with a small watchlist, grow gradually

### Limitation 3: Weekend/Holiday Gaps

**Problem**: No data collected when markets closed

**Workarounds**:
1. This is actually fine - IV Rank uses trading days only
2. Database design accounts for gaps
3. Calculation logic ignores missing dates

---

## Alternative: Hybrid Approach

If you need IV Rank **immediately** while building historical data:

### Option A: Use Tastytrade for Initial 6 Months

```typescript
// In SmartIVRankProvider
async getIVRank(symbol: string): Promise<IVMetrics> {
  const dataQuality = this.getDataQuality(symbol);
  
  if (dataQuality.dataPoints < 100) {
    // Insufficient local data, use Tastytrade
    return await this.tastytradeClient.getIVRank(symbol);
  } else {
    // Use local calculation
    return await this.calculateLocalIVRank(symbol);
  }
}
```

### Option B: Polygon.io Historical Backfill

Polygon.io offers historical options data:
- One-time backfill using their API
- Costs ~$200/month (can cancel after backfill)
- Gets you full year of historical IV instantly

---

## Conclusion

This Alpaca-based approach provides:

✅ **Self-contained IV Rank calculation** using only Alpaca APIs  
✅ **Fast performance** with intelligent caching  
✅ **Zero ongoing costs** (uses free tier)  
✅ **Growing accuracy** as data accumulates  
✅ **Simple maintenance** (one daily cron job)  

**Trade-off**: Requires 30+ days of data collection before IV Rank is accurate.

**Best for**: Patient developers who want full control and zero ongoing costs.

---

## Next Steps

1. **Week 1**: Implement database + ATM IV extractor
2. **Week 2**: Build smart provider + batch job
3. **Week 3**: UI integration + testing
4. **Week 4+**: Let data accumulate naturally

---

**Questions or Issues?**

Open an issue at: https://github.com/davek42/jesse-option-viewer-tui/issues

---

**End of Document**
