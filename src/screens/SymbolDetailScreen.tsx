// AIDEV-NOTE: Symbol detail screen - Hub for stock info and navigation to other screens
// AIDEV-NOTE: Responsive UI - adapts to terminal size (compact mode below 40 lines)

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
 *
 * Responsive UI:
 * - Terminal height >= 40 lines: Full UI with borders and all sections
 * - Terminal height < 40 lines: Compact mode - simplified UI to fit small screens
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

  // Detect terminal size and determine UI mode
  const terminalHeight = process.stdout.rows || 30;
  const COMPACT_MODE_THRESHOLD = 40;
  const compactMode = terminalHeight < COMPACT_MODE_THRESHOLD;

  // Calculate dynamic maxVisible for expiration list based on available space
  const getMaxVisibleExpirations = (): number => {
    if (compactMode) {
      // Compact mode: Account for ALL UI elements including App.tsx chrome
      // Header (App.tsx): 2 lines
      // Stock quote: 1 line
      // Expiration header: 2 lines
      // Scroll indicators: 2 lines
      // Strategies (if any): 3 lines (single line + border)
      // Keyboard shortcuts (App.tsx): 2 lines
      // StatusBar (App.tsx): 2 lines
      // Margins/padding: 2 lines
      // Total reserved: ~16 lines
      // For 30-line terminal: Keep it very tight at 7 expirations
      return 7; // Fixed at 7 for small terminals to ensure it fits
    } else {
      // Full mode: Account for ALL UI elements including App.tsx chrome
      // Header (App.tsx): 2 lines
      // Stock quote: 3 lines
      // Expiration header: 2 lines
      // Scroll indicators: 2 lines
      // Strategies: 7 lines
      // Keyboard shortcuts (App.tsx): 2 lines
      // StatusBar (App.tsx): 2 lines
      // Margins/padding: 2 lines
      // Total reserved: ~22 lines
      const reservedLines = 22;
      const availableForExpirations = Math.max(8, terminalHeight - reservedLines);
      return Math.min(15, availableForExpirations);
    }
  };

  const maxVisible = getMaxVisibleExpirations();

  logger.debug(
    `📏 Terminal: ${terminalHeight} lines, Mode: ${compactMode ? 'COMPACT' : 'FULL'}, MaxVisible: ${maxVisible}`
  );

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
      {/* Stock quote banner - Compact or Full mode */}
      {stockQuote && (
        <>
          {compactMode ? (
            // Compact mode: Single line without border
            <Box paddingX={1} marginBottom={1}>
              <Text bold color="cyan">
                {stockQuote.symbol}
              </Text>
              <Text> @ </Text>
              <Text bold color="white">
                ${safeToFixed(stockQuote.price, 2)}
              </Text>
              <Text> </Text>
              <Text color={stockQuote.change >= 0 ? 'green' : 'red'}>
                {stockQuote.change >= 0 ? '▲' : '▼'} {safeToFixed(stockQuote.change, 2)} (
                {safeToFixed(stockQuote.changePercent, 2)}%)
              </Text>
              <Text dimColor> Vol: {stockQuote.volume.toLocaleString()}</Text>
            </Box>
          ) : (
            // Full mode: Multi-line with border
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
        </>
      )}

      {/* Expiration selector - Dynamic sizing */}
      {availableExpirations.length > 0 && (
        <Box marginBottom={compactMode ? 1 : 2}>
          <ExpirationSelect
            expirations={availableExpirations}
            selectedExpiration={selectedExpiration}
            onSelect={handleExpirationSelect}
            highlightedIndex={highlightedIndex}
            isFocused={true}
            maxVisible={maxVisible}
          />
        </Box>
      )}

      {/* Saved strategies summary - Hidden in compact mode if empty */}
      {(!compactMode || savedStrategies.length > 0) && (
        <Box
          flexDirection="column"
          paddingX={1}
          marginBottom={compactMode ? 0 : 2}
          borderStyle={compactMode ? 'single' : 'round'}
          borderColor="yellow"
        >
          {compactMode ? (
            // Compact mode: Single line with everything
            <Box>
              <Text bold color="yellow">
                💼 Strategies
              </Text>
              {savedStrategies.length > 0 ? (
                <>
                  <Text dimColor> ({savedStrategies.length}) - Risk: </Text>
                  <Text color="red">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(-savedStrategies.reduce((sum, s) => sum + Math.abs(s.maxLoss), 0))}
                  </Text>
                  <Text dimColor> | Gain: </Text>
                  <Text color="green">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(savedStrategies.reduce((sum, s) => sum + s.maxGain, 0))}
                  </Text>
                </>
              ) : (
                <Text dimColor> - None saved</Text>
              )}
            </Box>
          ) : (
            // Full mode: Multi-line layout
            <>
              <Box marginBottom={1}>
                <Text bold color="yellow">
                  💼 Strategies
                </Text>
                {savedStrategies.length > 0 && (
                  <Text dimColor> ({savedStrategies.length})</Text>
                )}
              </Box>

              {savedStrategies.length === 0 ? (
                <Text dimColor>None saved</Text>
              ) : (
                <Box flexDirection="column">
                  <Box>
                    <Text dimColor>Risk: </Text>
                    <Text color="red">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(-savedStrategies.reduce((sum, s) => sum + Math.abs(s.maxLoss), 0))}
                    </Text>
                    <Text dimColor> | Gain: </Text>
                    <Text color="green">
                      {new Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: 'USD',
                      }).format(savedStrategies.reduce((sum, s) => sum + s.maxGain, 0))}
                    </Text>
                  </Box>
                  <Box marginTop={1}>
                    <Text dimColor>
                      Press <Text bold color="cyan">v</Text> to view all
                    </Text>
                  </Box>
                </Box>
              )}
            </>
          )}
        </Box>
      )}


      {/* Loading indicator for background operations */}
      {loading && stockQuote && (
        <Box paddingX={1} marginTop={1}>
          <Text color="cyan">🔄 Loading...</Text>
        </Box>
      )}
    </Box>
  );
}
