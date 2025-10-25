// AIDEV-NOTE: Option strategy calculations (Bull Call Spread, Bear Put Spread, etc.)

import type { OptionContract, OptionStrategy, StrategyType } from '../types/index.js';

/**
 * Strategy leg representing a single option position
 */
export interface StrategyLeg {
  contract: OptionContract;
  action: 'buy' | 'sell';
  quantity: number;
}

/**
 * Calculate Bull Call Spread strategy metrics
 *
 * Bull Call Spread:
 * - BUY 1 call at lower strike (ATM or slightly OTM)
 * - SELL 1 call at higher strike
 * - Moderately bullish strategy
 *
 * @param longCall - The call option to buy (lower strike)
 * @param shortCall - The call option to sell (higher strike)
 * @param quantity - Number of spreads (default: 1)
 * @returns Strategy metrics or null if invalid
 */
export function calculateBullCallSpread(
  longCall: OptionContract,
  shortCall: OptionContract,
  quantity: number = 1
): {
  netDebit: number;
  maxLoss: number;
  maxGain: number;
  breakEven: number;
  profitPotential: number;
  riskRewardRatio: number;
} | null {
  // Validation
  if (longCall.optionType !== 'call' || shortCall.optionType !== 'call') {
    return null;
  }

  if (longCall.strikePrice >= shortCall.strikePrice) {
    return null; // Long strike must be lower than short strike
  }

  if (longCall.expirationDate !== shortCall.expirationDate) {
    return null; // Must have same expiration
  }

  // Calculate costs (using ask for buy, bid for sell)
  const longCost = longCall.ask * quantity * 100; // Buy at ask, multiply by 100 shares per contract
  const shortCredit = shortCall.bid * quantity * 100; // Sell at bid

  // Net debit (what you pay to enter the position)
  const netDebit = longCost - shortCredit;

  // Max loss = Net debit paid
  const maxLoss = netDebit;

  // Max gain = (Spread width - Net debit) * 100 shares * quantity
  const spreadWidth = shortCall.strikePrice - longCall.strikePrice;
  const maxGain = (spreadWidth * 100 * quantity) - netDebit;

  // Break even = Lower strike + Net premium per share
  const breakEven = longCall.strikePrice + (netDebit / (100 * quantity));

  // Profit potential as percentage
  const profitPotential = maxLoss > 0 ? (maxGain / maxLoss) * 100 : 0;

  // Risk/Reward ratio
  const riskRewardRatio = maxLoss > 0 ? maxGain / maxLoss : 0;

  return {
    netDebit,
    maxLoss,
    maxGain,
    breakEven,
    profitPotential,
    riskRewardRatio,
  };
}

/**
 * Create a Bull Call Spread strategy object
 */
export function createBullCallSpread(
  symbol: string,
  longCall: OptionContract,
  shortCall: OptionContract,
  quantity: number = 1
): OptionStrategy | null {
  const metrics = calculateBullCallSpread(longCall, shortCall, quantity);
  if (!metrics) return null;

  const id = `bull-call-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id,
    type: 'bull_call_spread',
    symbol,
    legs: [longCall, shortCall],
    maxLoss: metrics.maxLoss,
    maxGain: metrics.maxGain,
    breakEvenPrices: [metrics.breakEven],
    createdAt: new Date(),
  };
}

/**
 * Calculate Bear Put Spread strategy metrics
 *
 * Bear Put Spread:
 * - BUY 1 put at higher strike
 * - SELL 1 put at lower strike
 * - Moderately bearish strategy
 */
export function calculateBearPutSpread(
  longPut: OptionContract,
  shortPut: OptionContract,
  quantity: number = 1
): {
  netDebit: number;
  maxLoss: number;
  maxGain: number;
  breakEven: number;
  profitPotential: number;
  riskRewardRatio: number;
} | null {
  // Validation
  if (longPut.optionType !== 'put' || shortPut.optionType !== 'put') {
    return null;
  }

  if (longPut.strikePrice <= shortPut.strikePrice) {
    return null; // Long strike must be higher than short strike
  }

  if (longPut.expirationDate !== shortPut.expirationDate) {
    return null;
  }

  // Calculate costs
  const longCost = longPut.ask * quantity * 100;
  const shortCredit = shortPut.bid * quantity * 100;

  const netDebit = longCost - shortCredit;
  const maxLoss = netDebit;

  const spreadWidth = longPut.strikePrice - shortPut.strikePrice;
  const maxGain = (spreadWidth * 100 * quantity) - netDebit;

  const breakEven = longPut.strikePrice - (netDebit / (100 * quantity));

  const profitPotential = maxLoss > 0 ? (maxGain / maxLoss) * 100 : 0;
  const riskRewardRatio = maxLoss > 0 ? maxGain / maxLoss : 0;

  return {
    netDebit,
    maxLoss,
    maxGain,
    breakEven,
    profitPotential,
    riskRewardRatio,
  };
}

/**
 * Create a Bear Put Spread strategy object
 */
export function createBearPutSpread(
  symbol: string,
  longPut: OptionContract,
  shortPut: OptionContract,
  quantity: number = 1
): OptionStrategy | null {
  const metrics = calculateBearPutSpread(longPut, shortPut, quantity);
  if (!metrics) return null;

  const id = `bear-put-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id,
    type: 'bear_put_spread',
    symbol,
    legs: [longPut, shortPut],
    maxLoss: metrics.maxLoss,
    maxGain: metrics.maxGain,
    breakEvenPrices: [metrics.breakEven],
    createdAt: new Date(),
  };
}

/**
 * Calculate Long Straddle strategy metrics (Task #9)
 *
 * Long Straddle:
 * - BUY 1 ATM call
 * - BUY 1 ATM put (same strike as call)
 * - High volatility strategy - profit from large move in either direction
 */
export function calculateLongStraddle(
  call: OptionContract,
  put: OptionContract,
  quantity: number = 1
): {
  netDebit: number;
  maxLoss: number;
  maxGain: number;
  upperBreakEven: number;
  lowerBreakEven: number;
  profitPotential: number;
} | null {
  // Validation
  if (call.optionType !== 'call' || put.optionType !== 'put') {
    return null;
  }

  // Must be same strike (ATM straddle)
  if (call.strikePrice !== put.strikePrice) {
    return null;
  }

  if (call.expirationDate !== put.expirationDate) {
    return null;
  }

  // Calculate costs (buy both at ask)
  const callCost = call.ask * quantity * 100;
  const putCost = put.ask * quantity * 100;

  const netDebit = callCost + putCost;
  const maxLoss = netDebit;

  // Max gain is theoretically unlimited (stock can go to infinity or zero)
  // We'll use a practical placeholder
  const maxGain = Infinity;

  // Break-even points
  const strike = call.strikePrice;
  const premiumPerShare = netDebit / (100 * quantity);
  const upperBreakEven = strike + premiumPerShare;
  const lowerBreakEven = strike - premiumPerShare;

  // Profit potential - undefined for unlimited gain
  const profitPotential = Infinity;

  return {
    netDebit,
    maxLoss,
    maxGain,
    upperBreakEven,
    lowerBreakEven,
    profitPotential,
  };
}

/**
 * Create a Long Straddle strategy object (Task #9)
 */
export function createLongStraddle(
  symbol: string,
  call: OptionContract,
  put: OptionContract,
  quantity: number = 1
): OptionStrategy | null {
  const metrics = calculateLongStraddle(call, put, quantity);
  if (!metrics) return null;

  const id = `long-straddle-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id,
    type: 'long_straddle',
    symbol,
    legs: [call, put],
    maxLoss: metrics.maxLoss,
    maxGain: metrics.maxGain === Infinity ? 999999 : metrics.maxGain, // Cap for display
    breakEvenPrices: [metrics.lowerBreakEven, metrics.upperBreakEven],
    createdAt: new Date(),
  };
}

/**
 * Calculate Iron Condor strategy metrics (Task #9)
 *
 * Iron Condor:
 * - SELL OTM call spread (sell lower strike call, buy higher strike call)
 * - SELL OTM put spread (sell higher strike put, buy lower strike put)
 * - Neutral range-bound strategy - profit if stock stays between short strikes
 */
export function calculateIronCondor(
  longCall: OptionContract,    // Buy higher strike call (protection)
  shortCall: OptionContract,   // Sell lower strike call (income)
  shortPut: OptionContract,    // Sell higher strike put (income)
  longPut: OptionContract,     // Buy lower strike put (protection)
  quantity: number = 1
): {
  netCredit: number;
  maxLoss: number;
  maxGain: number;
  upperBreakEven: number;
  lowerBreakEven: number;
  profitPotential: number;
  riskRewardRatio: number;
} | null {
  // Validation
  if (longCall.optionType !== 'call' || shortCall.optionType !== 'call' ||
      shortPut.optionType !== 'put' || longPut.optionType !== 'put') {
    return null;
  }

  // Strike order: longPut < shortPut < shortCall < longCall
  if (longPut.strikePrice >= shortPut.strikePrice ||
      shortPut.strikePrice >= shortCall.strikePrice ||
      shortCall.strikePrice >= longCall.strikePrice) {
    return null;
  }

  // All must have same expiration
  if (longCall.expirationDate !== shortCall.expirationDate ||
      shortCall.expirationDate !== shortPut.expirationDate ||
      shortPut.expirationDate !== longPut.expirationDate) {
    return null;
  }

  // Calculate credits and debits
  const shortCallCredit = shortCall.bid * quantity * 100;
  const longCallCost = longCall.ask * quantity * 100;
  const shortPutCredit = shortPut.bid * quantity * 100;
  const longPutCost = longPut.ask * quantity * 100;

  const netCredit = (shortCallCredit + shortPutCredit) - (longCallCost + longPutCost);
  const maxGain = netCredit;

  // Max loss occurs if stock moves beyond either spread
  const callSpreadWidth = longCall.strikePrice - shortCall.strikePrice;
  const putSpreadWidth = shortPut.strikePrice - longPut.strikePrice;
  const maxSpreadWidth = Math.max(callSpreadWidth, putSpreadWidth);
  const maxLoss = (maxSpreadWidth * 100 * quantity) - netCredit;

  // Break-even points
  const upperBreakEven = shortCall.strikePrice + (netCredit / (100 * quantity));
  const lowerBreakEven = shortPut.strikePrice - (netCredit / (100 * quantity));

  // Profit potential
  const profitPotential = maxLoss > 0 ? (maxGain / maxLoss) * 100 : 0;
  const riskRewardRatio = maxLoss > 0 ? maxGain / maxLoss : 0;

  return {
    netCredit,
    maxLoss,
    maxGain,
    upperBreakEven,
    lowerBreakEven,
    profitPotential,
    riskRewardRatio,
  };
}

/**
 * Create an Iron Condor strategy object (Task #9)
 */
export function createIronCondor(
  symbol: string,
  longCall: OptionContract,
  shortCall: OptionContract,
  shortPut: OptionContract,
  longPut: OptionContract,
  quantity: number = 1
): OptionStrategy | null {
  const metrics = calculateIronCondor(longCall, shortCall, shortPut, longPut, quantity);
  if (!metrics) return null;

  const id = `iron-condor-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id,
    type: 'iron_condor',
    symbol,
    legs: [longPut, shortPut, shortCall, longCall], // Order: low to high strikes
    maxLoss: metrics.maxLoss,
    maxGain: metrics.maxGain,
    breakEvenPrices: [metrics.lowerBreakEven, metrics.upperBreakEven],
    createdAt: new Date(),
  };
}

/**
 * Calculate Covered Call strategy metrics (Task #9)
 *
 * Covered Call:
 * - OWN 100 shares of stock
 * - SELL 1 OTM call
 * - Income generation strategy with limited upside
 */
export function calculateCoveredCall(
  call: OptionContract,
  stockPrice: number,
  quantity: number = 1
): {
  callPremium: number;
  maxGain: number;
  maxLoss: number;
  breakEven: number;
  returnIfCalled: number;
  returnIfCallsExpireWorthless: number;
} | null {
  // Validation
  if (call.optionType !== 'call') {
    return null;
  }

  // Calculate income from selling call
  const callPremium = call.bid * quantity * 100;

  // Stock cost (assuming we own it at current price)
  const stockCost = stockPrice * 100 * quantity;

  // Max gain: call premium + (strike - stock price) if called away
  const capitalGain = (call.strikePrice - stockPrice) * 100 * quantity;
  const maxGain = callPremium + (capitalGain > 0 ? capitalGain : 0);

  // Max loss: entire stock value minus call premium (if stock goes to zero)
  const maxLoss = stockCost - callPremium;

  // Break-even: stock price - premium per share
  const breakEven = stockPrice - (callPremium / (100 * quantity));

  // Return if called (%)
  const returnIfCalled = stockCost > 0 ? (maxGain / stockCost) * 100 : 0;

  // Return if calls expire worthless (%)
  const returnIfCallsExpireWorthless = stockCost > 0 ? (callPremium / stockCost) * 100 : 0;

  return {
    callPremium,
    maxGain,
    maxLoss,
    breakEven,
    returnIfCalled,
    returnIfCallsExpireWorthless,
  };
}

/**
 * Create a Covered Call strategy object (Task #9)
 */
export function createCoveredCall(
  symbol: string,
  call: OptionContract,
  stockPrice: number,
  quantity: number = 1
): OptionStrategy | null {
  const metrics = calculateCoveredCall(call, stockPrice, quantity);
  if (!metrics) return null;

  const id = `covered-call-${Date.now()}-${Math.random().toString(36).substring(7)}`;

  return {
    id,
    type: 'covered_call',
    symbol,
    legs: [call], // Only the call option (stock ownership is implied)
    maxLoss: metrics.maxLoss,
    maxGain: metrics.maxGain,
    breakEvenPrices: [metrics.breakEven],
    createdAt: new Date(),
  };
}

/**
 * Format currency value for display
 */
export function formatCurrency(value: number): string {
  const sign = value >= 0 ? '+' : '';
  return `${sign}$${Math.abs(value).toFixed(2)}`;
}

/**
 * Format percentage for display
 */
export function formatPercentage(value: number): string {
  return `${value.toFixed(1)}%`;
}

/**
 * Get strategy display name
 */
export function getStrategyDisplayName(type: StrategyType): string {
  const names: Record<StrategyType, string> = {
    bull_call_spread: 'Bull Call Spread',
    bear_put_spread: 'Bear Put Spread',
    bull_put_spread: 'Bull Put Spread',
    bear_call_spread: 'Bear Call Spread',
    diagonal_call_spread: 'Diagonal Call Spread',
    diagonal_put_spread: 'Diagonal Put Spread',
    butterfly_spread: 'Butterfly Spread',
    condor_spread: 'Condor Spread',
    strangle_spread: 'Strangle Spread',
    iron_condor: 'Iron Condor',
    long_straddle: 'Long Straddle',
    covered_call: 'Covered Call',
  };

  return names[type] || type;
}

/**
 * Get strategy description
 */
export function getStrategyDescription(type: StrategyType): string {
  const descriptions: Record<StrategyType, string> = {
    bull_call_spread: 'Buy lower strike call, sell higher strike call. Limited risk, limited profit. Moderately bullish.',
    bear_put_spread: 'Buy higher strike put, sell lower strike put. Limited risk, limited profit. Moderately bearish.',
    bull_put_spread: 'Sell higher strike put, buy lower strike put. Limited risk, credit received. Neutral to bullish.',
    bear_call_spread: 'Sell lower strike call, buy higher strike call. Limited risk, credit received. Neutral to bearish.',
    diagonal_call_spread: 'Different strikes and expirations. Calendar spread with directional bias.',
    diagonal_put_spread: 'Different strikes and expirations. Calendar spread with directional bias.',
    butterfly_spread: 'Three strikes, four legs. Limited risk and profit. Neutral strategy.',
    condor_spread: 'Four strikes, four legs. Wider profit range than butterfly.',
    strangle_spread: 'Buy/sell OTM call and put at different strikes. High volatility play.',
    iron_condor: 'Sell OTM call spread + OTM put spread. Range-bound neutral. Limited risk, credit received.',
    long_straddle: 'Buy ATM call + ATM put. High volatility play. Profit from big move either direction.',
    covered_call: 'Own 100 shares + sell OTM call. Income generation. Limited upside, downside risk.',
  };

  return descriptions[type] || '';
}

/**
 * Get the action (BUY/SELL) for a specific leg in a strategy
 *
 * @param strategyType - The type of strategy
 * @param legIndex - The index of the leg (0-based)
 * @returns 'buy' or 'sell'
 */
export function getLegAction(strategyType: StrategyType, legIndex: number): 'buy' | 'sell' {
  // Define action patterns for each strategy type
  const actionPatterns: Record<StrategyType, Array<'buy' | 'sell'>> = {
    // Bull Call Spread: BUY lower strike call, SELL higher strike call
    bull_call_spread: ['buy', 'sell'],

    // Bear Put Spread: BUY higher strike put, SELL lower strike put
    bear_put_spread: ['buy', 'sell'],

    // Bull Put Spread: SELL higher strike put, BUY lower strike put
    bull_put_spread: ['sell', 'buy'],

    // Bear Call Spread: SELL lower strike call, BUY higher strike call
    bear_call_spread: ['sell', 'buy'],

    // Long Straddle: BUY call, BUY put
    long_straddle: ['buy', 'buy'],

    // Iron Condor: BUY low put, SELL high put, SELL low call, BUY high call
    iron_condor: ['buy', 'sell', 'sell', 'buy'],

    // Covered Call: SELL call (stock ownership implied)
    covered_call: ['sell'],

    // Diagonal spreads (TODO - add when implemented)
    diagonal_call_spread: ['buy', 'sell'],
    diagonal_put_spread: ['buy', 'sell'],

    // Butterfly (TODO - add when implemented)
    butterfly_spread: ['buy', 'sell', 'sell', 'buy'],

    // Condor (TODO - add when implemented)
    condor_spread: ['buy', 'sell', 'sell', 'buy'],

    // Strangle (TODO - add when implemented)
    strangle_spread: ['buy', 'buy'],
  };

  const pattern = actionPatterns[strategyType];
  if (!pattern || legIndex >= pattern.length || legIndex < 0) {
    // Default to 'buy' if pattern not found or index out of range
    return 'buy';
  }

  const action = pattern[legIndex];
  return action ?? 'buy'; // Ensure we never return undefined
}
