// AIDEV-NOTE: Settings screen for app configuration (Task #18)

import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';

/**
 * SettingsScreen Component
 *
 * Allows users to configure application settings:
 * - Switch trading mode (Paper/Live)
 * - View credentials status
 * - Future: Other preferences
 */
export function SettingsScreen() {
  const { state } = useAppContext();
  const { tradingMode, liveCredentialsConfigured } = state;

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
          ⚙️  Application Settings
        </Text>
      </Box>

      {/* Trading Mode Section */}
      <Box
        marginBottom={1}
        flexDirection="column"
        paddingX={1}
        borderStyle="single"
        borderColor="yellow"
      >
        <Text bold color="yellow">
          Trading Mode
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Box>
            <Text>Current Mode: </Text>
            <Text bold color={tradingMode === 'paper' ? 'green' : 'red'}>
              {tradingMode === 'paper' ? '🟢 PAPER' : '🔴 LIVE'}
            </Text>
          </Box>

          {tradingMode === 'paper' && (
            <Box marginTop={1} flexDirection="column">
              <Text color="green">
                ✓ You are in PAPER trading mode (simulated)
              </Text>
              <Text dimColor>
                No real money is being used.
              </Text>
            </Box>
          )}

          {tradingMode === 'live' && (
            <Box marginTop={1} flexDirection="column">
              <Text bold color="red">
                ⚠️  You are in LIVE trading mode!
              </Text>
              <Text color="red">
                All trades use REAL MONEY.
              </Text>
            </Box>
          )}
        </Box>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Credentials Status:</Text>
          <Box marginTop={1}>
            <Text>
              Paper: <Text bold color="green">✓ Configured</Text>
            </Text>
          </Box>
          <Box>
            <Text>
              Live:  <Text bold color={liveCredentialsConfigured ? 'green' : 'yellow'}>
                {liveCredentialsConfigured ? '✓ Configured' : '✗ Not Configured'}
              </Text>
            </Text>
          </Box>
        </Box>

        {!liveCredentialsConfigured && (
          <Box marginTop={1} flexDirection="column" borderStyle="single" borderColor="yellow" padding={1}>
            <Text color="yellow">
              💡 To enable live trading:
            </Text>
            <Text dimColor>
              1. Add ALPACA_LIVE_API_KEY to .env.local
            </Text>
            <Text dimColor>
              2. Add ALPACA_LIVE_SECRET_KEY to .env.local
            </Text>
            <Text dimColor>
              3. Restart the application
            </Text>
          </Box>
        )}

        <Box marginTop={1} flexDirection="column">
          <Text bold>Switch Mode:</Text>
          <Box marginTop={1}>
            <Text dimColor>
              Press <Text bold color="cyan">m</Text> to switch to{' '}
              <Text bold color={tradingMode === 'paper' ? 'red' : 'green'}>
                {tradingMode === 'paper' ? 'LIVE' : 'PAPER'}
              </Text>{' '}
              mode
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Safety Notice */}
      <Box
        marginBottom={1}
        flexDirection="column"
        paddingX={1}
        borderStyle="single"
        borderColor="red"
      >
        <Text bold color="red">
          ⚠️  Safety Notice
        </Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            • App always starts in PAPER mode for safety
          </Text>
          <Text dimColor>
            • Confirmation required before every mode switch
          </Text>
          <Text dimColor>
            • Live trading uses REAL MONEY - trade responsibly
          </Text>
          <Text dimColor>
            • Your last used mode is remembered but not auto-applied
          </Text>
        </Box>
      </Box>

      {/* Configuration File Location */}
      <Box marginBottom={1} flexDirection="column" paddingX={1}>
        <Text bold>Configuration:</Text>
        <Box marginTop={1} flexDirection="column">
          <Text dimColor>
            Config file: ~/.config/jesse-option-viewer/config.json
          </Text>
          <Text dimColor>
            Env file: .env.local (not committed to git)
          </Text>
        </Box>
      </Box>

      {/* Footer */}
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          Press <Text bold color="cyan">m</Text> to switch mode  •  Press <Text bold color="cyan">q</Text> to go back
        </Text>
      </Box>
    </Box>
  );
}
