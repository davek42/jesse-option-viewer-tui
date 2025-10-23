// AIDEV-NOTE: Dedicated full-screen option chain view

import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';
import { OptionChain } from '../components/OptionChain.js';

interface OptionChainViewScreenProps {
  /** Highlighted row index */
  highlightedRow?: number;

  /** Whether to show Greeks */
  showGreeks?: boolean;

  /** Display limit for strikes */
  displayLimit?: number;
}

/**
 * OptionChainViewScreen Component
 *
 * Full-screen dedicated view for displaying option chains.
 * Takes maximum advantage of available screen space.
 */
export function OptionChainViewScreen({
  highlightedRow = 0,
  showGreeks = true,
  displayLimit = 40,
}: OptionChainViewScreenProps) {
  const { state } = useAppContext();

  const {
    currentSymbol,
    stockQuote,
    optionChain,
    selectedExpiration,
    loading,
  } = state;

  // No symbol selected
  if (!currentSymbol) {
    return (
      <Box padding={1}>
        <Text color="yellow">⚠️ No symbol selected. Press 'q' to go back.</Text>
      </Box>
    );
  }

  // No option chain loaded
  if (!optionChain) {
    return (
      <Box padding={1} flexDirection="column">
        <Text color="yellow">⚠️ No option chain loaded.</Text>
        <Text dimColor>Press 'q' to go back and select an expiration date.</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Compact header with stock info and expiration */}
      <Box
        paddingX={1}
        marginBottom={1}
        flexDirection="column"
        borderStyle="round"
        borderColor="cyan"
      >
        <Box>
          {stockQuote && (
            <>
              <Text bold color="cyan">
                {stockQuote.symbol}
              </Text>
              <Text> @ </Text>
              <Text bold color="white">
                ${stockQuote.price.toFixed(2)}
              </Text>
              <Box marginLeft={2}>
                <Text color={stockQuote.change >= 0 ? 'green' : 'red'}>
                  {stockQuote.change >= 0 ? '▲' : '▼'} {stockQuote.change.toFixed(2)} (
                  {stockQuote.changePercent.toFixed(2)}%)
                </Text>
              </Box>
            </>
          )}
          {selectedExpiration && (
            <Box marginLeft={2}>
              <Text dimColor>Exp: </Text>
              <Text bold>{selectedExpiration}</Text>
            </Box>
          )}
        </Box>
      </Box>

      {/* Full option chain display */}
      <Box>
        <OptionChain
          optionChain={optionChain}
          displayLimit={displayLimit}
          showGreeks={showGreeks}
          highlightedRow={highlightedRow}
          isFocused={true}
        />
      </Box>

      {/* Loading indicator */}
      {loading && (
        <Box paddingX={1} marginTop={1}>
          <Text color="cyan">🔄 Loading...</Text>
        </Box>
      )}

      {/* Footer with keyboard shortcuts */}
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          <Text bold color="cyan">↑↓/j/k</Text> Navigate{' '}
          <Text bold color="cyan">l</Text> Limit ({displayLimit === -1 ? 'ALL' : displayLimit}){' '}
          <Text bold color="cyan">g</Text> Greeks{' '}
          <Text bold color="cyan">q</Text> Back
        </Text>
      </Box>
    </Box>
  );
}
