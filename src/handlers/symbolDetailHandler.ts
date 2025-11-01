// AIDEV-NOTE: Handler for Symbol Detail screen navigation and input
// Extracted from App.tsx to reduce complexity

import type { HandlerContext, HandlerResult } from './types.js';
import { handleStrategyBuilder } from './strategyBuilderHandler.js';
import { handleAllNavigation } from './navigationHelpers.js';
import { getAlpacaClient } from '../lib/alpaca.js';
import { getATMIndex } from '../components/OptionChain.js';
import { logger } from '../utils/logger.js';

/**
 * Main handler for Symbol Detail screen
 */
export function handleSymbolDetailScreen(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  const { state } = context;

  if (state.currentScreen !== 'symbolDetail') {
    return { handled: false };
  }

  // Delegate to strategy builder if active
  if (state.strategyBuilderActive) {
    return handleStrategyBuilder(input, key, context);
  }

  // Normal mode navigation
  return handleSymbolDetailNormal(input, key, context);
}

/**
 * Handle Symbol Detail screen in normal mode (not building strategy)
 */
function handleSymbolDetailNormal(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  const { state, dispatch, setHighlightedIndex } = context;
  const { availableExpirations } = state;

  // Navigation keys for expiration selector
  const maxIndex = availableExpirations.length - 1;
  if (handleAllNavigation(input, key, setHighlightedIndex, maxIndex, dispatch)) {
    return { handled: true };
  }

  // Select expiration and load option chain
  if (key.return) {
    return handleExpirationSelection(context);
  }

  // View full option chain
  if (input === 'o') {
    return handleViewOptionChain(context);
  }

  // Activate strategy builder
  if (input === 'b') {
    return handleActivateBuilder(context);
  }

  // View saved strategies
  if (input === 'v') {
    dispatch({ type: 'SET_SCREEN', payload: 'savedStrategies' });
    setHighlightedIndex(0);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Saved Strategies', type: 'info' } });
    return { handled: true };
  }

  // Symbol entry
  if (input === 's') {
    dispatch({ type: 'SET_MODE', payload: 'input' });
    dispatch({ type: 'SET_STATUS', payload: { message: 'Enter stock symbol', type: 'info' } });
    return { handled: true };
  }

  // Go back to home
  if (input === 'q') {
    // Clear screen before going back
    process.stdout.write('\x1Bc');
    dispatch({ type: 'GO_BACK' });
    setHighlightedIndex(0);
    return { handled: true };
  }

  return { handled: false };
}

/**
 * Handle expiration selection
 */
function handleExpirationSelection(context: HandlerContext): HandlerResult {
  const {
    state,
    dispatch,
    highlightedIndex,
    setHighlightedIndex,
  } = context;

  const { availableExpirations, currentSymbol, displayLimit } = state;

  if (availableExpirations.length === 0) {
    dispatch({ type: 'SET_STATUS', payload: { message: 'No expirations available', type: 'warning' } });
    return { handled: true };
  }

  const selectedExp = availableExpirations[highlightedIndex];
  if (!selectedExp) {
    dispatch({ type: 'SET_STATUS', payload: { message: 'Invalid expiration selection', type: 'error' } });
    return { handled: true };
  }

  if (!currentSymbol) {
    dispatch({ type: 'SET_STATUS', payload: { message: 'No symbol selected', type: 'error' } });
    return { handled: true };
  }

  // Set selected expiration
  dispatch({ type: 'SET_EXPIRATION', payload: selectedExp });
  dispatch({ type: 'SET_LOADING', payload: true });
  dispatch({
    type: 'SET_STATUS',
    payload: { message: `Loading option chain for ${selectedExp}...`, type: 'info' },
  });

  // Load option chain asynchronously
  (async () => {
    try {
      logger.info(`📊 Loading option chain for ${currentSymbol} - ${selectedExp}`);
      const client = getAlpacaClient();
      const chain = await client.getOptionChain(currentSymbol, selectedExp);

      if (chain) {
        dispatch({ type: 'SET_OPTION_CHAIN', payload: chain });

        // Auto-center on ATM strike
        const atmIndex = getATMIndex(chain.calls, chain.puts, chain.underlyingPrice, displayLimit);
        setHighlightedIndex(atmIndex);
        logger.info(`🎯 Auto-centered on ATM strike (index ${atmIndex})`);

        dispatch({
          type: 'SET_STATUS',
          payload: {
            message: `✓ Loaded ${chain.calls.length} calls, ${chain.puts.length} puts`,
            type: 'success',
          },
        });
        logger.info(`✅ Option chain loaded: ${chain.calls.length} calls, ${chain.puts.length} puts`);
      } else {
        dispatch({
          type: 'SET_STATUS',
          payload: { message: 'Failed to load option chain', type: 'error' },
        });
        logger.error('❌ Failed to load option chain: No data returned');
      }
    } catch (error) {
      logger.error('❌ Error loading option chain:', error);
      dispatch({
        type: 'SET_STATUS',
        payload: { message: 'Error loading option chain', type: 'error' },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  })();

  return { handled: true };
}

/**
 * Handle viewing option chain
 */
function handleViewOptionChain(context: HandlerContext): HandlerResult {
  const { state, dispatch, setHighlightedIndex } = context;
  const { optionChain, displayLimit } = state;

  if (optionChain) {
    dispatch({ type: 'SET_SCREEN', payload: 'optionChainView' });

    // Auto-center on ATM strike
    const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
    setHighlightedIndex(atmIndex);

    dispatch({ type: 'SET_STATUS', payload: { message: 'Option Chain View', type: 'info' } });
  } else {
    dispatch({ type: 'SET_STATUS', payload: { message: 'Select an expiration date first', type: 'warning' } });
  }

  return { handled: true };
}

/**
 * Handle activating strategy builder
 */
function handleActivateBuilder(context: HandlerContext): HandlerResult {
  const { state, dispatch, setHighlightedIndex } = context;
  const { optionChain } = state;

  if (optionChain && optionChain.calls.length > 0) {
    logger.info('🏗️ Activating Strategy Builder - Choose strategy type');
    dispatch({ type: 'ACTIVATE_STRATEGY_BUILDER' });
    setHighlightedIndex(0);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy Builder: Choose strategy type', type: 'info' } });
  } else {
    dispatch({ type: 'SET_STATUS', payload: { message: 'Load option chain first (select expiration)', type: 'warning' } });
  }

  return { handled: true };
}
