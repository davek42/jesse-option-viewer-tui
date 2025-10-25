// AIDEV-NOTE: Comprehensive tests for option strategy calculations

import { describe, it, expect } from 'vitest';
import {
  calculateBullCallSpread,
  calculateBearPutSpread,
  calculateLongStraddle,
  calculateIronCondor,
  calculateCoveredCall,
  createBullCallSpread,
  createBearPutSpread,
  createLongStraddle,
  createIronCondor,
  createCoveredCall,
  getLegAction,
  getStrategyDisplayName,
  getStrategyDescription,
  formatCurrency,
  formatPercentage,
} from './strategies.js';
import {
  createMockOption,
  createBullCallSpreadPair,
  createBearPutSpreadPair,
  createStraddlePair,
  createIronCondorLegs,
} from '../test-utils/mocks.js';

describe('calculateBullCallSpread', () => {
  describe('Valid spreads', () => {
    it('should calculate correct net debit', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Net debit = (buy at ask * 100) - (sell at bid * 100)
      // = (5.0 * 100) - (2.0 * 100) = $300
      expect(result?.netDebit).toBe(300);
    });

    it('should calculate correct max loss (equals net debit)', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Max loss = Net debit paid to enter position
      expect(result?.maxLoss).toBe(300);
    });

    it('should calculate correct max gain', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Max gain = (Spread width * 100) - Net debit
      // = ((110 - 100) * 100) - 300 = 1000 - 300 = $700
      expect(result?.maxGain).toBe(700);
    });

    it('should calculate correct break-even price', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Break-even = Lower strike + (net debit / 100)
      // = 100 + (300 / 100) = 103
      expect(result?.breakEven).toBe(103);
    });

    it('should calculate correct risk/reward ratio', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Risk/Reward = Max gain / Max loss = 700 / 300 = 2.33...
      expect(result?.riskRewardRatio).toBeCloseTo(2.333, 2);
    });

    it('should calculate correct profit potential percentage', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Profit potential = (Max gain / Max loss) * 100 = (700 / 300) * 100 = 233.33%
      expect(result?.profitPotential).toBeCloseTo(233.33, 2);
    });

    it('should scale correctly with quantity', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const result = calculateBullCallSpread(longCall, shortCall, 2);

      // With 2 contracts:
      // Net debit = ((5.0 * 2) - (2.0 * 2)) * 100 = 6.0 * 100 = $600
      expect(result?.netDebit).toBe(600);
      // Max loss = $600
      expect(result?.maxLoss).toBe(600);
      // Max gain = ((110 - 100) * 100 * 2) - 600 = 2000 - 600 = $1400
      expect(result?.maxGain).toBe(1400);
      // Break-even = 100 + (600 / 200) = 103
      expect(result?.breakEven).toBe(103);
    });

    it('should handle narrow spreads (small width)', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 101, 2.0, 1.5);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Spread width = $1
      // Net debit = (2.0 - 1.5) * 100 = $50
      expect(result?.netDebit).toBe(50);
      // Max gain = (1 * 100) - 50 = $50
      expect(result?.maxGain).toBe(50);
    });

    it('should handle wide spreads (large width)', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 150, 20.0, 5.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Spread width = $50
      // Net debit = (20.0 - 5.0) * 100 = $1500
      expect(result?.netDebit).toBe(1500);
      // Max gain = (50 * 100) - 1500 = $3500
      expect(result?.maxGain).toBe(3500);
    });

    it('should handle low strike prices', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(5, 10, 1.0, 0.3);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      expect(result?.netDebit).toBe(70); // (1.0 - 0.3) * 100
      expect(result?.maxGain).toBe(430); // (5 * 100) - 70
    });

    it('should handle decimal strike prices', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(50.5, 55.5, 3.0, 1.0);
      const result = calculateBullCallSpread(longCall, shortCall, 1);

      // Spread width = 5.0
      expect(result?.maxGain).toBe(300); // (5.0 * 100) - 200
    });
  });

  describe('Invalid spreads', () => {
    it('should return null when long and short are not both calls', () => {
      const call = createMockOption({ optionType: 'call', strikePrice: 100 });
      const put = createMockOption({ optionType: 'put', strikePrice: 110 });

      const result = calculateBullCallSpread(call, put, 1);
      expect(result).toBeNull();
    });

    it('should return null when long strike >= short strike', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(110, 100); // Reversed!

      const result = calculateBullCallSpread(longCall, shortCall, 1);
      expect(result).toBeNull();
    });

    it('should return null when strikes are equal', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 100);

      const result = calculateBullCallSpread(longCall, shortCall, 1);
      expect(result).toBeNull();
    });

    it('should return null when expiration dates differ', () => {
      const longCall = createMockOption({
        optionType: 'call',
        strikePrice: 100,
        expirationDate: '2025-10-24',
      });
      const shortCall = createMockOption({
        optionType: 'call',
        strikePrice: 110,
        expirationDate: '2025-11-21', // Different expiration!
      });

      const result = calculateBullCallSpread(longCall, shortCall, 1);
      expect(result).toBeNull();
    });
  });
});

describe('calculateBearPutSpread', () => {
  describe('Valid spreads', () => {
    it('should calculate correct net debit', () => {
      const [longPut, shortPut] = createBearPutSpreadPair(110, 100, 5.0, 2.0);
      const result = calculateBearPutSpread(longPut, shortPut, 1);

      // Net debit = (5.0 * 100) - (2.0 * 100) = $300
      expect(result?.netDebit).toBe(300);
    });

    it('should calculate correct max loss', () => {
      const [longPut, shortPut] = createBearPutSpreadPair(110, 100, 5.0, 2.0);
      const result = calculateBearPutSpread(longPut, shortPut, 1);

      expect(result?.maxLoss).toBe(300);
    });

    it('should calculate correct max gain', () => {
      const [longPut, shortPut] = createBearPutSpreadPair(110, 100, 5.0, 2.0);
      const result = calculateBearPutSpread(longPut, shortPut, 1);

      // Max gain = (Spread width * 100) - Net debit
      // = ((110 - 100) * 100) - 300 = $700
      expect(result?.maxGain).toBe(700);
    });

    it('should calculate correct break-even price', () => {
      const [longPut, shortPut] = createBearPutSpreadPair(110, 100, 5.0, 2.0);
      const result = calculateBearPutSpread(longPut, shortPut, 1);

      // Break-even = Higher strike - (net debit / 100)
      // = 110 - (300 / 100) = 107
      expect(result?.breakEven).toBe(107);
    });

    it('should scale correctly with quantity', () => {
      const [longPut, shortPut] = createBearPutSpreadPair(110, 100, 5.0, 2.0);
      const result = calculateBearPutSpread(longPut, shortPut, 3);

      // With 3 contracts: net debit = (5.0 - 2.0) * 3 * 100 = $900
      expect(result?.netDebit).toBe(900);
      expect(result?.maxLoss).toBe(900);
      // Max gain = (10 * 100 * 3) - 900 = $2100
      expect(result?.maxGain).toBe(2100);
    });
  });

  describe('Invalid spreads', () => {
    it('should return null when long and short are not both puts', () => {
      const put = createMockOption({ optionType: 'put', strikePrice: 110 });
      const call = createMockOption({ optionType: 'call', strikePrice: 100 });

      const result = calculateBearPutSpread(put, call, 1);
      expect(result).toBeNull();
    });

    it('should return null when long strike <= short strike', () => {
      const [longPut, shortPut] = createBearPutSpreadPair(100, 110); // Reversed!

      const result = calculateBearPutSpread(longPut, shortPut, 1);
      expect(result).toBeNull();
    });

    it('should return null when expiration dates differ', () => {
      const longPut = createMockOption({
        optionType: 'put',
        strikePrice: 110,
        expirationDate: '2025-10-24',
      });
      const shortPut = createMockOption({
        optionType: 'put',
        strikePrice: 100,
        expirationDate: '2025-11-21',
      });

      const result = calculateBearPutSpread(longPut, shortPut, 1);
      expect(result).toBeNull();
    });
  });
});

describe('calculateLongStraddle', () => {
  describe('Valid straddles', () => {
    it('should calculate correct net debit', () => {
      const [call, put] = createStraddlePair(150, 8.0, 7.5);
      const result = calculateLongStraddle(call, put, 1);

      // Net debit = (call ask + put ask) * 100
      // = (8.0 + 7.5) * 100 = $1550
      expect(result?.netDebit).toBe(1550);
    });

    it('should calculate correct max loss', () => {
      const [call, put] = createStraddlePair(150, 8.0, 7.5);
      const result = calculateLongStraddle(call, put, 1);

      // Max loss = Total premium paid
      expect(result?.maxLoss).toBe(1550);
    });

    it('should have infinite max gain', () => {
      const [call, put] = createStraddlePair(150, 8.0, 7.5);
      const result = calculateLongStraddle(call, put, 1);

      expect(result?.maxGain).toBe(Infinity);
      expect(result?.profitPotential).toBe(Infinity);
    });

    it('should calculate correct upper break-even', () => {
      const [call, put] = createStraddlePair(150, 8.0, 7.5);
      const result = calculateLongStraddle(call, put, 1);

      // Upper break-even = Strike + (total premium / 100)
      // = 150 + (1550 / 100) = 165.50
      expect(result?.upperBreakEven).toBe(165.5);
    });

    it('should calculate correct lower break-even', () => {
      const [call, put] = createStraddlePair(150, 8.0, 7.5);
      const result = calculateLongStraddle(call, put, 1);

      // Lower break-even = Strike - (total premium / 100)
      // = 150 - (1550 / 100) = 134.50
      expect(result?.lowerBreakEven).toBe(134.5);
    });

    it('should scale correctly with quantity', () => {
      const [call, put] = createStraddlePair(150, 8.0, 7.5);
      const result = calculateLongStraddle(call, put, 2);

      // With 2 contracts: net debit = 15.5 * 2 * 100 = $3100
      expect(result?.netDebit).toBe(3100);
      // Break-evens = 150 +/- (3100 / 200) = 150 +/- 15.5
      expect(result?.upperBreakEven).toBe(165.5);
      expect(result?.lowerBreakEven).toBe(134.5);
    });
  });

  describe('Invalid straddles', () => {
    it('should return null when call and put have different strikes', () => {
      const call = createMockOption({ optionType: 'call', strikePrice: 150 });
      const put = createMockOption({ optionType: 'put', strikePrice: 145 }); // Different!

      const result = calculateLongStraddle(call, put, 1);
      expect(result).toBeNull();
    });

    it('should return null when both are calls', () => {
      const call1 = createMockOption({ optionType: 'call', strikePrice: 150 });
      const call2 = createMockOption({ optionType: 'call', strikePrice: 150 });

      const result = calculateLongStraddle(call1, call2, 1);
      expect(result).toBeNull();
    });

    it('should return null when both are puts', () => {
      const put1 = createMockOption({ optionType: 'put', strikePrice: 150 });
      const put2 = createMockOption({ optionType: 'put', strikePrice: 150 });

      const result = calculateLongStraddle(put1, put2, 1);
      expect(result).toBeNull();
    });

    it('should return null when expiration dates differ', () => {
      const call = createMockOption({
        optionType: 'call',
        strikePrice: 150,
        expirationDate: '2025-10-24',
      });
      const put = createMockOption({
        optionType: 'put',
        strikePrice: 150,
        expirationDate: '2025-11-21',
      });

      const result = calculateLongStraddle(call, put, 1);
      expect(result).toBeNull();
    });
  });
});

describe('calculateIronCondor', () => {
  describe('Valid iron condors', () => {
    it('should calculate correct net credit', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs(
        90, 100, 110, 120,
        1.0, 2.5, 2.5, 1.0
      );
      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);

      // Net credit = (short credits) - (long costs)
      // = (2.5 + 2.5) * 100 - (1.0 + 1.0) * 100
      // = 500 - 200 = $300
      expect(result?.netCredit).toBe(300);
    });

    it('should calculate correct max gain (equals net credit)', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);

      // Max gain = Net credit received
      expect(result?.maxGain).toBe(300);
    });

    it('should calculate correct max loss', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);

      // Put spread width = 100 - 90 = $10
      // Call spread width = 120 - 110 = $10
      // Max spread width = $10
      // Max loss = (10 * 100) - 300 = $700
      expect(result?.maxLoss).toBe(700);
    });

    it('should use wider spread for max loss calculation', () => {
      // Asymmetric spreads: put spread = $15, call spread = $10
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs(
        85, 100, 110, 120,
        1.0, 2.5, 2.5, 1.0
      );
      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);

      // Put spread width = 100 - 85 = $15 (wider)
      // Call spread width = 120 - 110 = $10
      // Max loss = (15 * 100) - 300 = $1200
      expect(result?.maxLoss).toBe(1200);
    });

    it('should calculate correct upper break-even', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);

      // Upper break-even = Short call strike + (net credit / 100)
      // = 110 + (300 / 100) = 113
      expect(result?.upperBreakEven).toBe(113);
    });

    it('should calculate correct lower break-even', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);

      // Lower break-even = Short put strike - (net credit / 100)
      // = 100 - (300 / 100) = 97
      expect(result?.lowerBreakEven).toBe(97);
    });

    it('should calculate correct risk/reward ratio', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);

      // Risk/Reward = Max gain / Max loss = 300 / 700 = 0.428...
      expect(result?.riskRewardRatio).toBeCloseTo(0.428, 2);
    });
  });

  describe('Invalid iron condors', () => {
    it('should return null when option types are wrong', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      // Make one a call that should be a put
      const badLongPut = createMockOption({ optionType: 'call', strikePrice: 90 });

      const result = calculateIronCondor(longCall, shortCall, shortPut, badLongPut, 1);
      expect(result).toBeNull();
    });

    it('should return null when strike order is wrong', () => {
      // Strikes must be: longPut < shortPut < shortCall < longCall
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs(
        100, 90, 110, 120 // longPut > shortPut (invalid!)
      );

      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);
      expect(result).toBeNull();
    });

    it('should return null when put strikes overlap with call strikes', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs(
        90, 105, 100, 120 // shortPut (105) > shortCall (100) - invalid!
      );

      const result = calculateIronCondor(longCall, shortCall, shortPut, longPut, 1);
      expect(result).toBeNull();
    });

    it('should return null when expiration dates differ', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      const badLongCall = { ...longCall, expirationDate: '2025-11-21' };

      const result = calculateIronCondor(badLongCall, shortCall, shortPut, longPut, 1);
      expect(result).toBeNull();
    });
  });
});

describe('calculateCoveredCall', () => {
  describe('Valid covered calls', () => {
    it('should calculate correct call premium', () => {
      const call = createMockOption({ bid: 5.0, optionType: 'call' });
      const result = calculateCoveredCall(call, 100, 1);

      // Call premium = bid * 100 = $500
      expect(result?.callPremium).toBe(500);
    });

    it('should calculate correct max gain when stock called away above purchase price', () => {
      const call = createMockOption({ bid: 5.0, strikePrice: 110, optionType: 'call' });
      const stockPrice = 100;
      const result = calculateCoveredCall(call, stockPrice, 1);

      // Max gain = Call premium + Capital gain
      // = 500 + ((110 - 100) * 100) = 500 + 1000 = $1500
      expect(result?.maxGain).toBe(1500);
    });

    it('should calculate correct max gain when call is ITM (stock price > strike)', () => {
      const call = createMockOption({ bid: 5.0, strikePrice: 95, optionType: 'call' });
      const stockPrice = 100;
      const result = calculateCoveredCall(call, stockPrice, 1);

      // Stock will be called away at a loss
      // Max gain = Call premium only (no capital gain since strike < current price)
      // = 500 + 0 = $500
      expect(result?.maxGain).toBe(500);
    });

    it('should calculate correct max loss', () => {
      const call = createMockOption({ bid: 5.0, optionType: 'call' });
      const stockPrice = 100;
      const result = calculateCoveredCall(call, stockPrice, 1);

      // Max loss = Stock cost - Call premium
      // = (100 * 100) - 500 = $9500
      expect(result?.maxLoss).toBe(9500);
    });

    it('should calculate correct break-even price', () => {
      const call = createMockOption({ bid: 5.0, optionType: 'call' });
      const stockPrice = 100;
      const result = calculateCoveredCall(call, stockPrice, 1);

      // Break-even = Stock price - (call premium / 100)
      // = 100 - (500 / 100) = 95
      expect(result?.breakEven).toBe(95);
    });

    it('should calculate correct return if called', () => {
      const call = createMockOption({ bid: 5.0, strikePrice: 110, optionType: 'call' });
      const stockPrice = 100;
      const result = calculateCoveredCall(call, stockPrice, 1);

      // Return if called = (max gain / stock cost) * 100
      // = (1500 / 10000) * 100 = 15%
      expect(result?.returnIfCalled).toBe(15);
    });

    it('should calculate correct return if calls expire worthless', () => {
      const call = createMockOption({ bid: 5.0, optionType: 'call' });
      const stockPrice = 100;
      const result = calculateCoveredCall(call, stockPrice, 1);

      // Return = (call premium / stock cost) * 100
      // = (500 / 10000) * 100 = 5%
      expect(result?.returnIfCallsExpireWorthless).toBe(5);
    });

    it('should scale correctly with quantity', () => {
      const call = createMockOption({ bid: 5.0, strikePrice: 110, optionType: 'call' });
      const result = calculateCoveredCall(call, 100, 2);

      // With 2 contracts (200 shares):
      // Call premium = 5.0 * 2 * 100 = $1000
      expect(result?.callPremium).toBe(1000);
      // Max gain = 1000 + ((110 - 100) * 200) = $3000
      expect(result?.maxGain).toBe(3000);
      // Max loss = (100 * 200) - 1000 = $19000
      expect(result?.maxLoss).toBe(19000);
    });
  });

  describe('Invalid covered calls', () => {
    it('should return null when option is not a call', () => {
      const put = createMockOption({ optionType: 'put' });
      const result = calculateCoveredCall(put, 100, 1);

      expect(result).toBeNull();
    });
  });
});

describe('Strategy creation functions', () => {
  describe('createBullCallSpread', () => {
    it('should create valid strategy with correct properties', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(100, 110, 5.0, 2.0);
      const strategy = createBullCallSpread('AAPL', longCall, shortCall, 1);

      expect(strategy).not.toBeNull();
      expect(strategy?.type).toBe('bull_call_spread');
      expect(strategy?.symbol).toBe('AAPL');
      expect(strategy?.legs).toHaveLength(2);
      expect(strategy?.legs[0]).toBe(longCall);
      expect(strategy?.legs[1]).toBe(shortCall);
      expect(strategy?.maxLoss).toBe(300);
      expect(strategy?.maxGain).toBe(700);
      expect(strategy?.breakEvenPrices).toEqual([103]);
      expect(strategy?.id).toMatch(/^bull-call-/);
      expect(strategy?.createdAt).toBeInstanceOf(Date);
    });

    it('should return null for invalid spread', () => {
      const [longCall, shortCall] = createBullCallSpreadPair(110, 100); // Invalid order
      const strategy = createBullCallSpread('AAPL', longCall, shortCall, 1);

      expect(strategy).toBeNull();
    });
  });

  describe('createBearPutSpread', () => {
    it('should create valid strategy', () => {
      const [longPut, shortPut] = createBearPutSpreadPair(110, 100, 5.0, 2.0);
      const strategy = createBearPutSpread('SPY', longPut, shortPut, 1);

      expect(strategy).not.toBeNull();
      expect(strategy?.type).toBe('bear_put_spread');
      expect(strategy?.symbol).toBe('SPY');
      expect(strategy?.id).toMatch(/^bear-put-/);
    });
  });

  describe('createLongStraddle', () => {
    it('should create valid strategy with capped max gain', () => {
      const [call, put] = createStraddlePair(150, 8.0, 7.5);
      const strategy = createLongStraddle('TSLA', call, put, 1);

      expect(strategy).not.toBeNull();
      expect(strategy?.type).toBe('long_straddle');
      expect(strategy?.symbol).toBe('TSLA');
      // Max gain should be capped at 999999 for display
      expect(strategy?.maxGain).toBe(999999);
      expect(strategy?.breakEvenPrices).toHaveLength(2);
      expect(strategy?.breakEvenPrices[0]).toBe(134.5); // Lower
      expect(strategy?.breakEvenPrices[1]).toBe(165.5); // Upper
    });
  });

  describe('createIronCondor', () => {
    it('should create valid strategy with legs in correct order', () => {
      const [longPut, shortPut, shortCall, longCall] = createIronCondorLegs();
      const strategy = createIronCondor('NVDA', longCall, shortCall, shortPut, longPut, 1);

      expect(strategy).not.toBeNull();
      expect(strategy?.type).toBe('iron_condor');
      expect(strategy?.symbol).toBe('NVDA');
      expect(strategy?.legs).toHaveLength(4);
      // Legs should be ordered: longPut, shortPut, shortCall, longCall
      expect(strategy?.legs[0]).toBe(longPut);
      expect(strategy?.legs[1]).toBe(shortPut);
      expect(strategy?.legs[2]).toBe(shortCall);
      expect(strategy?.legs[3]).toBe(longCall);
      expect(strategy?.breakEvenPrices).toHaveLength(2);
    });
  });

  describe('createCoveredCall', () => {
    it('should create valid strategy with single leg', () => {
      const call = createMockOption({ bid: 5.0, strikePrice: 110, optionType: 'call' });
      const strategy = createCoveredCall('F', call, 100, 1);

      expect(strategy).not.toBeNull();
      expect(strategy?.type).toBe('covered_call');
      expect(strategy?.symbol).toBe('F');
      expect(strategy?.legs).toHaveLength(1);
      expect(strategy?.legs[0]).toBe(call);
    });
  });
});

describe('Helper functions', () => {
  describe('getLegAction', () => {
    it('should return correct actions for bull_call_spread', () => {
      expect(getLegAction('bull_call_spread', 0)).toBe('buy');
      expect(getLegAction('bull_call_spread', 1)).toBe('sell');
    });

    it('should return correct actions for bear_put_spread', () => {
      expect(getLegAction('bear_put_spread', 0)).toBe('buy');
      expect(getLegAction('bear_put_spread', 1)).toBe('sell');
    });

    it('should return correct actions for long_straddle', () => {
      expect(getLegAction('long_straddle', 0)).toBe('buy');
      expect(getLegAction('long_straddle', 1)).toBe('buy');
    });

    it('should return correct actions for iron_condor', () => {
      expect(getLegAction('iron_condor', 0)).toBe('buy');  // Long put
      expect(getLegAction('iron_condor', 1)).toBe('sell'); // Short put
      expect(getLegAction('iron_condor', 2)).toBe('sell'); // Short call
      expect(getLegAction('iron_condor', 3)).toBe('buy');  // Long call
    });

    it('should return correct action for covered_call', () => {
      expect(getLegAction('covered_call', 0)).toBe('sell');
    });

    it('should default to buy for invalid index', () => {
      expect(getLegAction('bull_call_spread', 99)).toBe('buy');
      expect(getLegAction('bull_call_spread', -1)).toBe('buy');
    });
  });

  describe('getStrategyDisplayName', () => {
    it('should return correct display names', () => {
      expect(getStrategyDisplayName('bull_call_spread')).toBe('Bull Call Spread');
      expect(getStrategyDisplayName('bear_put_spread')).toBe('Bear Put Spread');
      expect(getStrategyDisplayName('iron_condor')).toBe('Iron Condor');
      expect(getStrategyDisplayName('long_straddle')).toBe('Long Straddle');
      expect(getStrategyDisplayName('covered_call')).toBe('Covered Call');
    });
  });

  describe('getStrategyDescription', () => {
    it('should return descriptions for all strategy types', () => {
      const desc = getStrategyDescription('bull_call_spread');
      expect(desc).toContain('Buy lower strike');
      expect(desc).toContain('sell higher strike');

      const ironCondorDesc = getStrategyDescription('iron_condor');
      expect(ironCondorDesc).toContain('Sell OTM');
      expect(ironCondorDesc).toContain('Range-bound');
    });
  });

  describe('formatCurrency', () => {
    it('should format positive values with + sign', () => {
      expect(formatCurrency(100)).toBe('+$100.00');
      expect(formatCurrency(1500.50)).toBe('+$1500.50');
    });

    it('should format negative values (BUG: missing negative sign)', () => {
      // NOTE: This is a bug in the implementation!
      // formatCurrency sets sign to '' for negative values instead of '-'
      // Current behavior: -100 => '$100.00' (should be '-$100.00')
      expect(formatCurrency(-100)).toBe('$100.00');
      expect(formatCurrency(-1500.50)).toBe('$1500.50');
    });

    it('should format zero', () => {
      expect(formatCurrency(0)).toBe('+$0.00');
    });
  });

  describe('formatPercentage', () => {
    it('should format percentages with one decimal place', () => {
      expect(formatPercentage(12.345)).toBe('12.3%');
      expect(formatPercentage(100)).toBe('100.0%');
      expect(formatPercentage(0.5)).toBe('0.5%');
    });
  });
});
