#!/usr/bin/env node
// AIDEV-NOTE: Test script to verify Alpaca options API implementation

import { getAlpacaClient } from '../src/lib/alpaca.js';
import { logger } from '../src/utils/logger.js';

async function testAlpacaAPI() {
  logger.info('🧪 Starting Alpaca Options API Test...\n');

  try {
    // Initialize client
    const client = getAlpacaClient();

    // Test 1: Connection test
    logger.info('Test 1: Testing Alpaca API connection...');
    const connected = await client.testConnection();
    if (!connected) {
      logger.error('❌ Connection test failed');
      process.exit(1);
    }
    logger.success('✅ Connection test passed\n');

    // Test 2: Stock quote
    const testSymbol = 'AAPL';
    logger.info(`Test 2: Fetching stock quote for ${testSymbol}...`);
    const quote = await client.getStockQuote(testSymbol);
    if (!quote) {
      logger.error('❌ Stock quote test failed');
      process.exit(1);
    }
    logger.success(`✅ Stock quote: ${quote.symbol} @ $${quote.price.toFixed(2)}\n`);

    // Test 3: Expiration dates
    logger.info(`Test 3: Fetching expiration dates for ${testSymbol}...`);
    const expirations = await client.getExpirationDates(testSymbol);
    if (!expirations || expirations.dates.length === 0) {
      logger.error('❌ Expiration dates test failed');
      process.exit(1);
    }
    logger.success(
      `✅ Found ${expirations.dates.length} expiration dates:\n   ${expirations.dates.slice(0, 5).join(', ')}${expirations.dates.length > 5 ? '...' : ''}\n`
    );

    // Test 4: Option chain
    const testExpiration = expirations.dates[0];
    logger.info(`Test 4: Fetching option chain for ${testSymbol} expiring ${testExpiration}...`);
    const optionChain = await client.getOptionChain(testSymbol, testExpiration!);
    if (!optionChain) {
      logger.error('❌ Option chain test failed');
      process.exit(1);
    }
    logger.success(
      `✅ Option chain loaded: ${optionChain.calls.length} calls, ${optionChain.puts.length} puts\n`
    );

    // Display sample option data
    if (optionChain.calls.length > 0) {
      const atmCall = optionChain.calls.find(
        (c) => c.strikePrice >= optionChain.underlyingPrice
      ) || optionChain.calls[0];

      logger.info('📋 Sample Call Option:');
      logger.info(`   Symbol: ${atmCall!.symbol}`);
      logger.info(`   Strike: $${atmCall!.strikePrice}`);
      logger.info(`   Bid/Ask: $${atmCall!.bid} / $${atmCall!.ask}`);
      logger.info(`   Last: $${atmCall!.lastPrice}`);
      logger.info(`   Volume: ${atmCall!.volume}`);
      logger.info(`   OI: ${atmCall!.openInterest}`);
      if (atmCall!.delta !== undefined) {
        logger.info(`   Delta: ${atmCall!.delta?.toFixed(4)}`);
        logger.info(`   Gamma: ${atmCall!.gamma?.toFixed(4)}`);
        logger.info(`   Theta: ${atmCall!.theta?.toFixed(4)}`);
        logger.info(`   Vega: ${atmCall!.vega?.toFixed(4)}`);
      }
      logger.info('');
    }

    logger.success('🎉 All API tests passed!\n');
    logger.info('✨ The Alpaca options API integration is working correctly.');
    logger.info('📊 You can now proceed with building the UI components.\n');

  } catch (error) {
    logger.error('❌ Test failed with error:', error);
    process.exit(1);
  }
}

// Run tests
testAlpacaAPI().catch((error) => {
  logger.error('Fatal error:', error);
  process.exit(1);
});
