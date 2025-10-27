// AIDEV-NOTE: Test helper utilities for creating mock data

import type { OptionContract, OptionStrategy } from '../../src/types/index.js';

/**
 * Create a mock OptionContract for testing
 *
 * @param overrides - Partial contract data to override defaults
 * @returns Complete mock OptionContract
 */
export function createMockOption(overrides: Partial<OptionContract> = {}): OptionContract {
  return {
    symbol: 'AAPL251024C00150000',
    strikePrice: 150,
    expirationDate: '2025-10-24',
    optionType: 'call',
    bid: 5.0,
    ask: 5.2,
    lastPrice: 5.1,
    volume: 100,
    openInterest: 500,
    impliedVolatility: 0.25,
    delta: 0.5,
    gamma: 0.05,
    theta: -0.02,
    vega: 0.15,
    rho: 0.05,
    ...overrides,
  };
}

/**
 * Create a mock OptionStrategy for testing
 *
 * @param overrides - Partial strategy data to override defaults
 * @returns Complete mock OptionStrategy
 */
export function createMockStrategy(overrides: Partial<OptionStrategy> = {}): OptionStrategy {
  return {
    id: 'test-123',
    type: 'bull_call_spread',
    symbol: 'AAPL',
    legs: [
      createMockOption({ strikePrice: 100, ask: 5.0, bid: 4.8 }),
      createMockOption({ strikePrice: 110, ask: 2.0, bid: 1.8 }),
    ],
    maxLoss: 300,
    maxGain: 700,
    breakEvenPrices: [103],
    createdAt: new Date('2025-01-15'),
    ...overrides,
  };
}

/**
 * Create a pair of options for a bull call spread
 *
 * @param longStrike - Strike price for the long call
 * @param shortStrike - Strike price for the short call
 * @param longAsk - Ask price for the long call
 * @param shortBid - Bid price for the short call
 * @returns Tuple of [longCall, shortCall]
 */
export function createBullCallSpreadPair(
  longStrike: number = 100,
  shortStrike: number = 110,
  longAsk: number = 5.0,
  shortBid: number = 2.0
): [OptionContract, OptionContract] {
  return [
    createMockOption({
      strikePrice: longStrike,
      ask: longAsk,
      optionType: 'call',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: shortStrike,
      bid: shortBid,
      optionType: 'call',
      expirationDate: '2025-10-24',
    }),
  ];
}

/**
 * Create a pair of options for a bear put spread
 *
 * @param longStrike - Strike price for the long put (higher)
 * @param shortStrike - Strike price for the short put (lower)
 * @param longAsk - Ask price for the long put
 * @param shortBid - Bid price for the short put
 * @returns Tuple of [longPut, shortPut]
 */
export function createBearPutSpreadPair(
  longStrike: number = 110,
  shortStrike: number = 100,
  longAsk: number = 5.0,
  shortBid: number = 2.0
): [OptionContract, OptionContract] {
  return [
    createMockOption({
      strikePrice: longStrike,
      ask: longAsk,
      optionType: 'put',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: shortStrike,
      bid: shortBid,
      optionType: 'put',
      expirationDate: '2025-10-24',
    }),
  ];
}

/**
 * Create a straddle pair (call + put at same strike)
 *
 * @param strike - Strike price for both options
 * @param callAsk - Ask price for the call
 * @param putAsk - Ask price for the put
 * @returns Tuple of [call, put]
 */
export function createStraddlePair(
  strike: number = 150,
  callAsk: number = 8.0,
  putAsk: number = 7.5
): [OptionContract, OptionContract] {
  return [
    createMockOption({
      strikePrice: strike,
      ask: callAsk,
      optionType: 'call',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: strike,
      ask: putAsk,
      optionType: 'put',
      expirationDate: '2025-10-24',
    }),
  ];
}

/**
 * Create a pair of options for a bull put spread (credit spread)
 *
 * @param longStrike - Strike price for the long put (lower - protection)
 * @param shortStrike - Strike price for the short put (higher - sell for credit)
 * @param longAsk - Ask price for the long put
 * @param shortBid - Bid price for the short put
 * @returns Tuple of [longPut, shortPut]
 */
export function createBullPutSpreadPair(
  longStrike: number = 95,
  shortStrike: number = 100,
  longAsk: number = 1.5,
  shortBid: number = 3.0
): [OptionContract, OptionContract] {
  return [
    createMockOption({
      strikePrice: longStrike,
      ask: longAsk,
      optionType: 'put',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: shortStrike,
      bid: shortBid,
      optionType: 'put',
      expirationDate: '2025-10-24',
    }),
  ];
}

/**
 * Create a pair of options for a bear call spread (credit spread)
 *
 * @param shortStrike - Strike price for the short call (lower - sell for credit)
 * @param longStrike - Strike price for the long call (higher - protection)
 * @param shortBid - Bid price for the short call
 * @param longAsk - Ask price for the long call
 * @returns Tuple of [longCall, shortCall]
 */
export function createBearCallSpreadPair(
  shortStrike: number = 105,
  longStrike: number = 110,
  shortBid: number = 3.0,
  longAsk: number = 1.5
): [OptionContract, OptionContract] {
  return [
    createMockOption({
      strikePrice: longStrike,
      ask: longAsk,
      optionType: 'call',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: shortStrike,
      bid: shortBid,
      optionType: 'call',
      expirationDate: '2025-10-24',
    }),
  ];
}

/**
 * Create a pair of options for a diagonal call spread
 *
 * @param longStrike - Strike price for the long call (lower)
 * @param shortStrike - Strike price for the short call (higher)
 * @param longAsk - Ask price for the long call
 * @param shortBid - Bid price for the short call
 * @param longExpiration - Expiration date for long call (LONGER)
 * @param shortExpiration - Expiration date for short call (SHORTER)
 * @returns Tuple of [longCall, shortCall]
 */
export function createDiagonalCallSpreadPair(
  longStrike: number = 100,
  shortStrike: number = 110,
  longAsk: number = 6.0,
  shortBid: number = 2.0,
  longExpiration: string = '2025-11-21', // Longer expiration
  shortExpiration: string = '2025-10-24'  // Shorter expiration
): [OptionContract, OptionContract] {
  return [
    createMockOption({
      strikePrice: longStrike,
      ask: longAsk,
      optionType: 'call',
      expirationDate: longExpiration,
    }),
    createMockOption({
      strikePrice: shortStrike,
      bid: shortBid,
      optionType: 'call',
      expirationDate: shortExpiration,
    }),
  ];
}

/**
 * Create four legs for an iron condor
 *
 * Order: [longPut, shortPut, shortCall, longCall]
 * Strikes: longPut < shortPut < shortCall < longCall
 *
 * @returns Array of 4 option contracts
 */
export function createIronCondorLegs(
  longPutStrike: number = 90,
  shortPutStrike: number = 100,
  shortCallStrike: number = 110,
  longCallStrike: number = 120,
  longPutAsk: number = 1.0,
  shortPutBid: number = 2.5,
  shortCallBid: number = 2.5,
  longCallAsk: number = 1.0
): [OptionContract, OptionContract, OptionContract, OptionContract] {
  return [
    createMockOption({
      strikePrice: longPutStrike,
      ask: longPutAsk,
      optionType: 'put',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: shortPutStrike,
      bid: shortPutBid,
      optionType: 'put',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: shortCallStrike,
      bid: shortCallBid,
      optionType: 'call',
      expirationDate: '2025-10-24',
    }),
    createMockOption({
      strikePrice: longCallStrike,
      ask: longCallAsk,
      optionType: 'call',
      expirationDate: '2025-10-24',
    }),
  ];
}
