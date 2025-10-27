// AIDEV-NOTE: Mode switch confirmation dialog (Task #18 Phase 4)

import React from 'react';
import { Box, Text } from 'ink';
import type { TradingMode } from '../config/index.js';

interface ModeConfirmationDialogProps {
  currentMode: TradingMode;
  targetMode: TradingMode;
  validationWarnings?: string[];
}

/**
 * ModeConfirmationDialog component
 * Shows a warning dialog when switching trading modes
 *
 * Safety features:
 * - Clear visual indication of mode change
 * - Prominent warning for LIVE mode
 * - Explicit confirmation required
 */
export function ModeConfirmationDialog({
  currentMode,
  targetMode,
  validationWarnings = [],
}: ModeConfirmationDialogProps) {
  const isSwitchingToLive = targetMode === 'live';

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={isSwitchingToLive ? 'red' : 'yellow'}
      padding={1}
      width={70}
    >
      {/* Title */}
      <Box justifyContent="center" marginBottom={1}>
        <Text bold color={isSwitchingToLive ? 'red' : 'yellow'}>
          {isSwitchingToLive ? '⚠️  CONFIRM LIVE TRADING MODE  ⚠️' : '🔄 CONFIRM MODE SWITCH'}
        </Text>
      </Box>

      {/* Current and target mode */}
      <Box flexDirection="column" marginBottom={1}>
        <Box>
          <Text>Current Mode: </Text>
          <Text bold color={currentMode === 'paper' ? 'green' : 'red'}>
            {currentMode === 'paper' ? '🟢 PAPER' : '🔴 LIVE'}
          </Text>
        </Box>
        <Box>
          <Text>Target Mode:  </Text>
          <Text bold color={targetMode === 'paper' ? 'green' : 'red'}>
            {targetMode === 'paper' ? '🟢 PAPER' : '🔴 LIVE'}
          </Text>
        </Box>
      </Box>

      {/* Warning message */}
      {isSwitchingToLive && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="red"
          padding={1}
          marginBottom={1}
        >
          <Text bold color="red">
            ⚠️  WARNING: SWITCHING TO LIVE TRADING MODE
          </Text>
          <Text color="red">
            • This will connect to your REAL Alpaca trading account
          </Text>
          <Text color="red">
            • All trades will use REAL MONEY
          </Text>
          <Text color="red">
            • You can lose money - trade at your own risk
          </Text>
          <Box marginTop={1}>
            <Text bold color="red">
              Are you absolutely sure you want to proceed?
            </Text>
          </Box>
        </Box>
      )}

      {/* Confirmation for switching to paper */}
      {!isSwitchingToLive && (
        <Box flexDirection="column" marginBottom={1}>
          <Text color="green">
            Switching to PAPER trading mode (simulated trading).
          </Text>
          <Text dimColor>
            No real money will be used.
          </Text>
        </Box>
      )}

      {/* Validation warnings (Phase 5) */}
      {validationWarnings.length > 0 && (
        <Box
          flexDirection="column"
          borderStyle="single"
          borderColor="yellow"
          padding={1}
          marginBottom={1}
        >
          <Text bold color="yellow">
            Additional Warnings:
          </Text>
          <Box marginTop={1} flexDirection="column">
            {validationWarnings.map((warning, index) => (
              <Text key={index} color="yellow">
                {warning}
              </Text>
            ))}
          </Box>
        </Box>
      )}

      {/* Action buttons */}
      <Box justifyContent="center" marginTop={1}>
        <Box marginRight={2}>
          <Text bold color="green">
            [Y] Confirm
          </Text>
        </Box>
        <Box>
          <Text bold color="red">
            [N] Cancel
          </Text>
        </Box>
      </Box>
    </Box>
  );
}
