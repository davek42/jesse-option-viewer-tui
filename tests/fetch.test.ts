// AIDEV-NOTE: Unit tests for fetch utilities
import { describe, it, expect } from 'vitest';
import { parseOptionSymbol } from '../src/utils/fetch.js';

describe('parseOptionSymbol', () => {
  it('should parse valid call option symbol', () => {
    const result = parseOptionSymbol('AAPL251024C00260000');

    expect(result).not.toBeNull();
    expect(result?.underlying).toBe('AAPL');
    expect(result?.expirationDate).toBe('2025-10-24');
    expect(result?.optionType).toBe('call');
    expect(result?.strikePrice).toBe(260);
  });

  it('should parse valid put option symbol', () => {
    const result = parseOptionSymbol('AAPL251024P00260000');

    expect(result).not.toBeNull();
    expect(result?.underlying).toBe('AAPL');
    expect(result?.expirationDate).toBe('2025-10-24');
    expect(result?.optionType).toBe('put');
    expect(result?.strikePrice).toBe(260);
  });

  it('should parse option with decimal strike price', () => {
    const result = parseOptionSymbol('SPY251031C00450500');

    expect(result).not.toBeNull();
    expect(result?.underlying).toBe('SPY');
    expect(result?.expirationDate).toBe('2025-10-31');
    expect(result?.optionType).toBe('call');
    expect(result?.strikePrice).toBe(450.5);
  });

  it('should parse multi-character ticker symbol', () => {
    const result = parseOptionSymbol('TSLA260117C00300000');

    expect(result).not.toBeNull();
    expect(result?.underlying).toBe('TSLA');
    expect(result?.expirationDate).toBe('2026-01-17');
    expect(result?.optionType).toBe('call');
    expect(result?.strikePrice).toBe(300);
  });

  it('should return null for invalid format', () => {
    const result = parseOptionSymbol('INVALID');
    expect(result).toBeNull();
  });

  it('should return null for incomplete symbol', () => {
    const result = parseOptionSymbol('AAPL251024');
    expect(result).toBeNull();
  });

  it('should return null for symbol with invalid option type', () => {
    const result = parseOptionSymbol('AAPL251024X00260000');
    expect(result).toBeNull();
  });

  it('should handle low strike prices', () => {
    const result = parseOptionSymbol('F251024C00010000');

    expect(result).not.toBeNull();
    expect(result?.strikePrice).toBe(10);
  });

  it('should handle high strike prices', () => {
    const result = parseOptionSymbol('GOOGL251024C02500000');

    expect(result).not.toBeNull();
    expect(result?.strikePrice).toBe(2500);
  });
});
