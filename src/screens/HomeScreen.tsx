// AIDEV-NOTE: Home screen - Initial landing page with symbol entry

import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';

/**
 * HomeScreen component
 */
export function HomeScreen() {
  const { state } = useAppContext();

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🏠 Welcome to Option Chain Viewer
        </Text>
      </Box>

      <Box flexDirection="column" marginBottom={1}>
        <Text>Get started by entering a stock symbol:</Text>
        <Text dimColor>  • Press <Text bold color="green">s</Text> to enter a symbol</Text>
        <Text dimColor>  • Press <Text bold color="yellow">h</Text> or <Text bold color="yellow">?</Text> for help</Text>
        <Text dimColor>  • Press <Text bold color="red">q</Text> to quit</Text>
      </Box>

      {state.currentSymbol && (
        <Box flexDirection="column" borderStyle="round" padding={1} marginTop={1}>
          <Text color="green">
            ✓ Current Symbol: <Text bold>{state.currentSymbol}</Text>
          </Text>
          {state.stockQuote && (
            <Box marginTop={1}>
              <Text>
                Price: <Text bold color="cyan">${state.stockQuote.price.toFixed(2)}</Text>
                {' '}
                <Text color={state.stockQuote.change >= 0 ? 'green' : 'red'}>
                  {state.stockQuote.change >= 0 ? '▲' : '▼'}
                  {' '}
                  {state.stockQuote.change.toFixed(2)}
                  {' '}
                  ({state.stockQuote.changePercent.toFixed(2)}%)
                </Text>
              </Text>
            </Box>
          )}
        </Box>
      )}

      {state.mode === 'input' && (
        <Box marginTop={1}>
          <Text color="yellow">
            💡 Enter stock symbol and press Enter (ESC to cancel)
          </Text>
        </Box>
      )}
    </Box>
  );
}
