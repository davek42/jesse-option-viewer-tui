// AIDEV-NOTE: Comprehensive help screen with all keyboard shortcuts and instructions

import React from 'react';
import { Box, Text } from 'ink';
import { VERSION } from '../version.js';

/**
 * HelpScreen Component
 *
 * Comprehensive help screen showing all keyboard shortcuts,
 * navigation instructions, and feature explanations.
 */
export function HelpScreen() {
  return (
    <Box flexDirection="column" paddingY={1} paddingX={2}>
      {/* Header */}
      <Box
        marginBottom={1}
        borderStyle="double"
        borderColor="cyan"
        paddingX={1}
      >
        <Text bold color="cyan">
          📖 Option Viewer TUI - Help & Keyboard Shortcuts
        </Text>
      </Box>

      {/* Overview */}
      <Box marginBottom={1} flexDirection="column" paddingX={1}>
        <Text bold color="yellow">Overview:</Text>
        <Text dimColor>
          A terminal-based option chain viewer and strategy builder using Alpaca Markets API.
        </Text>
        <Text dimColor>
          View real-time option chains, analyze Greeks, and build multi-leg option strategies.
        </Text>
      </Box>

      {/* Global Shortcuts */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Global Shortcuts (work on any screen):</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={20}>
              <Text color="cyan">h</Text><Text> or </Text><Text color="cyan">?</Text>
            </Box>
            <Text>Show this help screen</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">/help</Text>
            </Box>
            <Text>Show help screen (command mode)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">q</Text>
            </Box>
            <Text>Go back / Quit</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">/back</Text>
            </Box>
            <Text>Go back (command mode)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">/refresh</Text>
            </Box>
            <Text>Refresh/redraw screen (command mode)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">Ctrl+C</Text>
            </Box>
            <Text>Exit application</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">/exit</Text>
            </Box>
            <Text>Exit application (command mode)</Text>
          </Box>
        </Box>
      </Box>

      {/* Home Screen */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Home Screen:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={20}>
              <Text color="cyan">s</Text>
            </Box>
            <Text>Enter stock symbol</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">h</Text><Text> or </Text><Text color="cyan">?</Text>
            </Box>
            <Text>Show help</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">q</Text>
            </Box>
            <Text>Quit application</Text>
          </Box>
        </Box>
      </Box>

      {/* Symbol Detail Screen */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Symbol Detail Screen:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={20}>
              <Text color="cyan">o</Text>
            </Box>
            <Text>View option chain (full screen)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">b</Text>
            </Box>
            <Text>Build option strategy</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">v</Text>
            </Box>
            <Text>View saved strategies</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">s</Text>
            </Box>
            <Text>Change symbol</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">q</Text>
            </Box>
            <Text>Back to home</Text>
          </Box>
        </Box>
      </Box>

      {/* Option Chain View */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Option Chain View:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={20}>
              <Text color="cyan">↑↓</Text><Text> or </Text><Text color="cyan">j/k</Text>
            </Box>
            <Text>Navigate strikes (one at a time)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">a</Text>
            </Box>
            <Text>Jump to ATM (at-the-money) strike</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">Ctrl+↑</Text>
            </Box>
            <Text>Jump to top (first strike)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">Ctrl+↓</Text>
            </Box>
            <Text>Jump to bottom (last strike)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">l</Text>
            </Box>
            <Text>Toggle display limit (10/20/40/ALL)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">g</Text>
            </Box>
            <Text>Toggle Greeks display (delta, IV, etc.)</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">/</Text>
            </Box>
            <Text>Enter command mode</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Commands: /atm, /scroll up, /scroll down, /top, /bottom, /refresh, /exit, /back</Text>
          </Box>
        </Box>
      </Box>

      {/* Strategy Builder */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Strategy Builder:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={20}>
              <Text color="cyan">↑↓</Text><Text> or </Text><Text color="cyan">j/k</Text>
            </Box>
            <Text>Navigate options</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">Enter</Text>
            </Box>
            <Text>Select option / Save strategy</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">1-4</Text>
            </Box>
            <Text>Jump directly to leg 1, 2, 3, or 4</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">q</Text><Text> or </Text><Text color="cyan">Esc</Text>
            </Box>
            <Text>Cancel strategy builder</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Strategies: Bull Call, Bear Put, Long Straddle, Iron Condor, Covered Call</Text>
          </Box>
        </Box>
      </Box>

      {/* Saved Strategies */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Saved Strategies Screen:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={20}>
              <Text color="cyan">↑↓</Text><Text> or </Text><Text color="cyan">j/k</Text>
            </Box>
            <Text>Navigate strategies</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">x</Text>
            </Box>
            <Text>Delete selected strategy</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text color="cyan">q</Text>
            </Box>
            <Text>Back to symbol detail</Text>
          </Box>
        </Box>
      </Box>

      {/* Visual Indicators */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Visual Indicators:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={25}>
              <Text color="green">GREEN text (BUY)</Text>
            </Box>
            <Text>Long position / Call option / Debit paid</Text>
          </Box>
          <Box>
            <Box width={25}>
              <Text color="red">RED text (SELL)</Text>
            </Box>
            <Text>Short position / Put option / Credit received</Text>
          </Box>
          <Box>
            <Box width={25}>
              <Text color="yellow">YELLOW bid/ask</Text>
            </Box>
            <Text>Wide spread (5-10%) - lower liquidity</Text>
          </Box>
          <Box>
            <Box width={25}>
              <Text color="red">RED bid/ask</Text>
            </Box>
            <Text>Very wide spread (&gt;10%) - poor liquidity</Text>
          </Box>
          <Box>
            <Box width={25}>
              <Text backgroundColor="yellow" color="black">Highlighted row</Text>
            </Box>
            <Text>ATM (at-the-money) strike</Text>
          </Box>
          <Box>
            <Box width={25}>
              <Text backgroundColor="cyan" color="black">Highlighted row</Text>
            </Box>
            <Text>Currently selected row</Text>
          </Box>
        </Box>
      </Box>

      {/* Tips */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="yellow">
        <Text bold color="yellow">💡 Tips:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>• Vim-style navigation (j/k) works everywhere alongside arrow keys</Text>
          <Text dimColor>• Watch for colored spreads - yellow/red means low liquidity</Text>
          <Text dimColor>• Check volume before trading - low volume = harder to fill</Text>
          <Text dimColor>• Strategy builder auto-centers on ATM strikes for better UX</Text>
          <Text dimColor>• Use number keys (1-4) to quickly jump between legs</Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box paddingX={1} marginTop={1} flexDirection="column">
        <Text dimColor>
          Press <Text bold color="cyan">q</Text> to go back
        </Text>
        <Box marginTop={1}>
          <Text dimColor>Jesse Option Viewer TUI v{VERSION}</Text>
        </Box>
      </Box>
    </Box>
  );
}
