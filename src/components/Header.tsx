// AIDEV-NOTE: Application header with branding

import React from 'react';
import { Box, Text } from 'ink';
import Gradient from 'ink-gradient';
import BigText from 'ink-big-text';

interface HeaderProps {
  compact?: boolean;
}

/**
 * Header component - Displays app title
 */
export function Header({ compact = false }: HeaderProps) {
  if (compact) {
    return (
      <Box borderStyle="double" paddingX={1} justifyContent="center">
        <Gradient name="rainbow">
          <Text bold>📊 JESSE OPTION VIEWER 📊</Text>
        </Gradient>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingBottom={1}>
      <Gradient name="rainbow">
        <BigText text="Options" font="tiny" />
      </Gradient>
      <Box justifyContent="center">
        <Text dimColor>Terminal-based Option Chain Viewer powered by Alpaca</Text>
      </Box>
    </Box>
  );
}
