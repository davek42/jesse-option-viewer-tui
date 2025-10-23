// AIDEV-NOTE: Warning banner for small terminal sizes

import React from 'react';
import { Box, Text } from 'ink';
import type { TerminalSize } from '../hooks/useTerminalSize.js';

interface TerminalSizeWarningProps {
  terminalSize: TerminalSize;
}

/**
 * TerminalSizeWarning Component
 *
 * Displays a warning banner when the terminal is too small for optimal viewing.
 * Shows current size and recommended size.
 */
export function TerminalSizeWarning({ terminalSize }: TerminalSizeWarningProps) {
  const { columns, rows, isTooSmall, isSmall, recommendedColumns, recommendedRows } = terminalSize;

  // Don't show warning if terminal is adequate size
  if (!isSmall && !isTooSmall) {
    return null;
  }

  const borderColor = isTooSmall ? 'red' : 'yellow';
  const iconColor = isTooSmall ? 'red' : 'yellow';
  const icon = isTooSmall ? '⛔' : '⚠️';
  const severity = isTooSmall ? 'CRITICAL' : 'WARNING';

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={borderColor}
      paddingX={1}
      marginBottom={1}
    >
      {/* Warning header */}
      <Box>
        <Text bold color={iconColor}>
          {icon} {severity}: Terminal Size Too Small
        </Text>
      </Box>

      {/* Size information */}
      <Box marginTop={1} flexDirection="column">
        <Box>
          <Text dimColor>Current Size: </Text>
          <Text bold color={iconColor}>
            {columns}x{rows}
          </Text>
        </Box>
        <Box>
          <Text dimColor>Recommended: </Text>
          <Text bold color="green">
            {recommendedColumns}x{recommendedRows} or larger
          </Text>
        </Box>
      </Box>

      {/* Advice */}
      <Box marginTop={1}>
        <Text dimColor>
          {isTooSmall
            ? 'Please resize your terminal for better experience.'
            : 'Some components may be cramped. Consider resizing for optimal viewing.'}
        </Text>
      </Box>
    </Box>
  );
}
