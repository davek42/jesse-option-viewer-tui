// AIDEV-NOTE: Symbol detail screen - Hub for stock info and navigation to other screens

import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';
import { ExpirationSelect } from '../components/ExpirationSelect.js';
import { getAlpacaClient } from '../lib/alpaca.js';
import { logger } from '../utils/logger.js';
import { safeToFixed } from '../utils/formatters.js';

interface SymbolDetailScreenProps {
  /** Highlighted index for expiration selector */
  highlightedIndex?: number;

  /** Callback when user selects expiration */
  onExpirationSelect?: (expiration: string) => void;
}

/**
 * SymbolDetailScreen Component
 *
 * Hub screen showing stock information and navigation options.
 * Acts as a central point for accessing:
 * - Option Chain View (press 'o')
 * - Strategy Builder (press 'b')
 * - Saved Strategies (press 'v')
 */
export function SymbolDetailScreen({
  highlightedIndex = 0,
  onExpirationSelect,
}: SymbolDetailScreenProps) {
  const { state, dispatch } = useAppContext();

  const {
    currentSymbol,
    stockQuote,
    availableExpirations,
    selectedExpiration,
    savedStrategies,
    loading,
    error,
  } = state;

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

        // Call parent callback if provided
        if (onExpirationSelect) {
          onExpirationSelect(expiration);
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
  if (loading && !stockQuote) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="cyan">🔄 Loading data for {currentSymbol}...</Text>
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

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Stock quote banner */}
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

      {/* Expiration selector */}
      {availableExpirations.length > 0 && (
        <Box marginBottom={2}>
          <ExpirationSelect
            expirations={availableExpirations}
            selectedExpiration={selectedExpiration}
            onSelect={handleExpirationSelect}
            highlightedIndex={highlightedIndex}
            isFocused={true}
            maxVisible={6}
          />
        </Box>
      )}

      {/* Saved strategies summary */}
      <Box
        flexDirection="column"
        paddingX={1}
        marginBottom={2}
        borderStyle="round"
        borderColor="yellow"
      >
        <Box marginBottom={1}>
          <Text bold color="yellow">
            💼 Saved Strategies
          </Text>
          {savedStrategies.length > 0 && (
            <Text dimColor> ({savedStrategies.length} active)</Text>
          )}
        </Box>

        {savedStrategies.length === 0 ? (
          <Text dimColor>No strategies saved yet.</Text>
        ) : (
          <Box flexDirection="column">
            <Box>
              <Text dimColor>Total Risk: </Text>
              <Text color="red">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(-savedStrategies.reduce((sum, s) => sum + Math.abs(s.maxLoss), 0))}
              </Text>
            </Box>
            <Box>
              <Text dimColor>Potential Gain: </Text>
              <Text color="green">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(savedStrategies.reduce((sum, s) => sum + s.maxGain, 0))}
              </Text>
            </Box>
            <Box marginTop={1}>
              <Text dimColor>
                Press <Text bold color="cyan">v</Text> to view all strategies
              </Text>
            </Box>
          </Box>
        )}
      </Box>

      {/* Quick actions */}
      <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor="green">
        <Box marginBottom={1}>
          <Text bold color="green">
            📋 Quick Actions
          </Text>
        </Box>

        <Box flexDirection="column">
          <Text>
            <Text bold color="cyan">o</Text> <Text dimColor>View Full Option Chain</Text>
          </Text>
          <Text>
            <Text bold color="cyan">b</Text> <Text dimColor>Build New Strategy</Text>
            {!selectedExpiration && <Text color="yellow"> (select expiration first)</Text>}
          </Text>
          <Text>
            <Text bold color="cyan">v</Text> <Text dimColor>View Saved Strategies</Text>
          </Text>
          <Text>
            <Text bold color="cyan">s</Text> <Text dimColor>Change Symbol</Text>
          </Text>
          <Text>
            <Text bold color="cyan">q</Text> <Text dimColor>Back to Home</Text>
          </Text>
        </Box>
      </Box>

      {/* Loading indicator for background operations */}
      {loading && stockQuote && (
        <Box paddingX={1} marginTop={1}>
          <Text color="cyan">🔄 Loading...</Text>
        </Box>
      )}
    </Box>
  );
}
