// AIDEV-NOTE: Status bar component showing mode, input buffer, and status messages

import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';

/**
 * StatusBar component - Displays at bottom of screen
 */
export function StatusBar() {
  const { state } = useAppContext();
  const { mode, inputBuffer, commandBuffer, statusMessage, statusType } = state;

  const statusColors = {
    info: 'blue',
    success: 'green',
    error: 'red',
    warning: 'yellow',
  } as const;

  const statusColor = statusColors[statusType];

  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Box>
        {/* Mode indicator */}
        <Text bold>
          {mode === 'navigation' && '[ NAVIGATION ]'}
          {mode === 'input' && '[ INPUT ]'}
          {mode === 'command' && '[ COMMAND ]'}
        </Text>

        {/* Input/Command buffer */}
        {(mode === 'input' || mode === 'command') && (
          <Text>
            {' '}
            {commandBuffer || inputBuffer}
            <Text backgroundColor="white" color="black">
              █
            </Text>
          </Text>
        )}
      </Box>

      {/* Status message */}
      {statusMessage && <Text color={statusColor}>{statusMessage}</Text>}
    </Box>
  );
}
