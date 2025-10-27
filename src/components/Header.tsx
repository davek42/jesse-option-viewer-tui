// AIDEV-NOTE: Application header with branding

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';
// Task #18: Import TradingMode type
import type { TradingMode } from '../config/index.js';

interface HeaderProps {
  compact?: boolean;
  tradingMode?: TradingMode;
}

/**
 * Header component - Displays app title and trading mode indicator
 */
export function Header({ compact = false, tradingMode = 'paper' }: HeaderProps) {
  // Trading mode indicator
  const modeIndicator = (
    <Box>
      <Text bold color={tradingMode === 'paper' ? 'green' : 'red'}>
        {tradingMode === 'paper' ? '🟢 PAPER' : '🔴 LIVE'}
      </Text>
    </Box>
  );

  if (compact) {
    return (
      <Box borderStyle="double" paddingX={1} justifyContent="space-between">
        <Box flexGrow={1} justifyContent="center">
          <Gradient name="rainbow">
            <Text bold>📊 JESSE OPTION VIEWER 📊</Text>
          </Gradient>
        </Box>
        <Box paddingLeft={2}>
          {modeIndicator}
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingBottom={1}>
      <Box justifyContent="space-between">
        <Box flexGrow={1}>
          <Gradient name="rainbow">
            <BigText text="Options" font="tiny" />
          </Gradient>
        </Box>
        <Box paddingTop={1}>
          {modeIndicator}
        </Box>
      </Box>
      <Box justifyContent="center">
        <Text dimColor>Terminal-based Option Chain Viewer powered by Alpaca</Text>
      </Box>
    </Box>
  );
}
