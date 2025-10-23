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
  };

  return descriptions[type] || '';
}
