// AIDEV-NOTE: Home screen - Initial landing page with symbol entry

import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';
import { safeToFixed } from '../utils/formatters.js';
import { VERSION } from '../version.js';

/**
 * HomeScreen component
 */
export function HomeScreen() {
  const { state } = useAppContext();

  return (
    <Box flexDirection="column" padding={1}>
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🏠 Welcome to Jesse Option Chain Viewer
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
                Price: <Text bold color="cyan">${safeToFixed(state.stockQuote.price, 2)}</Text>
                {' '}
                <Text color={state.stockQuote.change >= 0 ? 'green' : 'red'}>
                  {state.stockQuote.change >= 0 ? '▲' : '▼'}
                  {' '}
                  {safeToFixed(state.stockQuote.change, 2)}
                  {' '}
                  ({safeToFixed(state.stockQuote.changePercent, 2)}%)
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

      {/* Version footer */}
      <Box marginTop={2}>
        <Text dimColor>Jesse Option Viewer TUI v{VERSION}</Text>
      </Box>
    </Box>
  );
}
