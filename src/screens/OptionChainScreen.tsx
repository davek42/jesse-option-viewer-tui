// AIDEV-NOTE: Option chain screen showing expiration selector and option chain display

import React, { useEffect } from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';
import { ExpirationSelect } from '../components/ExpirationSelect.js';
import { OptionChain } from '../components/OptionChain.js';
import { SavedStrategies } from '../components/SavedStrategies.js';
import { StrategyBuilder } from '../components/StrategyBuilder.js';
import { getAlpacaClient } from '../lib/alpaca.js';
import { logger } from '../utils/logger.js';
import { createBullCallSpread } from '../utils/strategies.js';
import type { OptionContract } from '../types/index.js';
import { safeToFixed } from '../utils/formatters.js';

type FocusArea = 'expiration' | 'optionChain' | 'strategies' | 'builder';

interface OptionChainScreenProps {
  /** Current focus area for keyboard navigation */
  currentFocus?: FocusArea;

  /** Highlighted index in the focused area */
  highlightedIndex?: number;

  /** Whether to show Greeks in option chain */
  showGreeks?: boolean;

  /** Whether strategy builder mode is active */
  strategyBuilderActive?: boolean;

  /** Current builder selection step (Task #9 - Multi-strategy support) */
  builderStep?: 'long' | 'short' | 'leg1' | 'leg2' | 'leg3' | 'leg4';

  /** Selected long call for strategy */
  selectedLongCall?: OptionContract | null;

  /** Selected short call for strategy */
  selectedShortCall?: OptionContract | null;

  /** Callback when user navigates */
  onNavigate?: (direction: 'up' | 'down') => void;

  /** Callback when user selects an item */
  onSelect?: () => void;

  /** Callback when user changes focus area */
  onChangeFocus?: (focus: FocusArea) => void;
}

/**
 * OptionChainScreen Component
 *
 * Main screen for viewing option chains.
 * Shows expiration date selector and option chain display.
 */
export function OptionChainScreen({
  currentFocus = 'expiration',
  highlightedIndex = 0,
  showGreeks = true,
  strategyBuilderActive = false,
  builderStep = 'long',
  selectedLongCall = null,
  selectedShortCall = null,
  onNavigate: _onNavigate,
  onSelect: _onSelect,
  onChangeFocus,
}: OptionChainScreenProps) {
  const { state, dispatch } = useAppContext();

  const {
    currentSymbol,
    stockQuote,
    availableExpirations,
    selectedExpiration,
    optionChain,
    savedStrategies,
    loading,
    error,
    displayLimit,
  } = state;

  // Auto-select first expiration if none selected
  useEffect(() => {
    if (availableExpirations.length > 0 && !selectedExpiration) {
      const firstExpiration = availableExpirations[0];
      if (firstExpiration) {
        handleExpirationSelect(firstExpiration);
      }
    }
  }, [availableExpirations, selectedExpiration]);

  /**
   * Handle strategy save
   */
  function handleStrategySave() {
    if (!currentSymbol || !selectedLongCall || !selectedShortCall) return;

    const strategy = createBullCallSpread(currentSymbol, selectedLongCall, selectedShortCall, 1);
    if (strategy) {
      dispatch({ type: 'ADD_STRATEGY', payload: strategy });
      dispatch({
        type: 'SET_STATUS',
        payload: { message: '✓ Bull Call Spread saved!', type: 'success' },
      });
      logger.success(`💼 Strategy saved: ${strategy.type} for ${currentSymbol}`);
    }
  }

  /**
   * Handle strategy removal
   */
  function handleStrategyRemove(strategyId: string) {
    dispatch({ type: 'REMOVE_STRATEGY', payload: strategyId });
    dispatch({
      type: 'SET_STATUS',
      payload: { message: 'Strategy removed', type: 'info' },
    });
  }

  /**
   * Handle expiration date selection
   */
  async function handleExpirationSelect(expiration: string) {
    if (!currentSymbol) return;

    dispatch({ type: 'SET_EXPIRATION', payload: expiration });
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({
      type: 'SET_STATUS',
      payload: { message: `Loading option chain for ${expiration}...`, type: 'info' },
    });

    try {
      const client = getAlpacaClient();
      const chain = await client.getOptionChain(currentSymbol, expiration);

      if (chain) {
        dispatch({ type: 'SET_OPTION_CHAIN', payload: chain });
        dispatch({
          type: 'SET_STATUS',
          payload: {
            message: `✓ Loaded ${chain.calls.length} calls, ${chain.puts.length} puts`,
            type: 'success',
          },
        });

        // Switch focus to option chain after loading
        if (onChangeFocus) {
          onChangeFocus('optionChain');
        }
      } else {
        dispatch({
          type: 'SET_STATUS',
          payload: { message: 'Failed to load option chain', type: 'error' },
        });
      }
    } catch (error) {
      logger.error('Error loading option chain:', error);
      dispatch({
        type: 'SET_STATUS',
        payload: { message: 'Error loading option chain', type: 'error' },
      });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  // No symbol selected
  if (!currentSymbol) {
    return (
      <Box padding={1}>
        <Text color="yellow">⚠️ No symbol selected. Press 's' to enter a symbol.</Text>
      </Box>
    );
  }

  // Loading state
  if (loading && !optionChain) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="cyan">🔄 Loading option data for {currentSymbol}...</Text>
      </Box>
    );
  }

  // Error state
  if (error) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="red">❌ Error: {error}</Text>
        <Text dimColor>Press 'q' to go back or 's' to try another symbol</Text>
      </Box>
    );
  }

  // No expirations available
  if (availableExpirations.length === 0) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="yellow">⚠️ No expiration dates available for {currentSymbol}</Text>
        <Text dimColor>Press 'q' to go back or 's' to try another symbol</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Stock quote banner - Always visible */}
      {stockQuote && (
        <Box paddingX={1} marginBottom={1} borderStyle="round" borderColor="cyan">
          <Box>
            <Text bold color="cyan">
              {stockQuote.symbol}
            </Text>
            <Text> @ </Text>
            <Text bold color="white">
              ${safeToFixed(stockQuote.price, 2)}
            </Text>
          </Box>
          <Box marginLeft={2}>
            <Text color={stockQuote.change >= 0 ? 'green' : 'red'}>
              {stockQuote.change >= 0 ? '▲' : '▼'} {safeToFixed(stockQuote.change, 2)} (
              {safeToFixed(stockQuote.changePercent, 2)}%)
            </Text>
          </Box>
          <Box marginLeft={2}>
            <Text dimColor>Vol: {stockQuote.volume.toLocaleString()}</Text>
          </Box>
        </Box>
      )}

      {/* FULL-SCREEN MODAL MODE: Strategy Builder */}
      {strategyBuilderActive && optionChain ? (
        <Box marginBottom={2}>
          <StrategyBuilder
            strategyType={'bull_call_spread'} // TODO: Get from state when multi-strategy is fully implemented
            calls={optionChain.calls}
            puts={optionChain.puts}
            stockPrice={stockQuote?.price || 0}
            longCall={selectedLongCall}
            shortCall={selectedShortCall}
            selectedLegs={[]}
            selectionStep={builderStep}
            highlightedIndex={highlightedIndex}
            quantity={1}
            onSelectOption={() => {}} // Handled by global input handler
            onConfirm={handleStrategySave}
            onCancel={() => {}} // Handled by global input handler
          />
        </Box>
      ) : (
        <>
          {/* NORMAL MODE: Show all other components */}

          {/* Saved Strategies (Task #8) - Display below stock quote */}
          <Box marginBottom={2}>
            <SavedStrategies
              strategies={savedStrategies}
              onRemove={handleStrategyRemove}
              highlightedIndex={currentFocus === 'strategies' ? highlightedIndex : 0}
              isFocused={currentFocus === 'strategies'}
            />
          </Box>

          {/* Expiration selector */}
          <Box marginBottom={2}>
            <ExpirationSelect
              expirations={availableExpirations}
              selectedExpiration={selectedExpiration}
              onSelect={handleExpirationSelect}
              highlightedIndex={currentFocus === 'expiration' ? highlightedIndex : 0}
              isFocused={currentFocus === 'expiration'}
            />
          </Box>

          {/* Option chain display */}
          {optionChain && (
            <Box>
              <OptionChain
                optionChain={optionChain}
                displayLimit={displayLimit}
                showGreeks={showGreeks}
                highlightedRow={currentFocus === 'optionChain' ? highlightedIndex : 0}
                isFocused={currentFocus === 'optionChain'}
              />
            </Box>
          )}

          {/* Loading indicator for background operations */}
          {loading && optionChain && (
            <Box paddingX={1} marginTop={1}>
              <Text color="cyan">🔄 Loading...</Text>
            </Box>
          )}

          {/* Keyboard shortcuts help */}
          <Box paddingX={1} marginTop={1}>
            <Text dimColor>
              <Text bold color="cyan">
                e
              </Text>{' '}
              Expiration{' '}
              <Text bold color="cyan">
                o
              </Text>{' '}
              Options{' '}
              <Text bold color="cyan">
                l
              </Text>{' '}
              Limit (
              {displayLimit === -1 ? 'ALL' : displayLimit}){' '}
              <Text bold color="cyan">
                g
              </Text>{' '}
              Greeks{' '}
              <Text bold color="cyan">
                s
              </Text>{' '}
              Symbol{' '}
              <Text bold color="cyan">
                q
              </Text>{' '}
              Back
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
}
