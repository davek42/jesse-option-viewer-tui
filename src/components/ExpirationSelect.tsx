// AIDEV-NOTE: Expiration date selection component with keyboard navigation

import React from 'react';
import { Box, Text } from 'ink';

interface ExpirationSelectProps {
  /** Available expiration dates (YYYY-MM-DD format) */
  expirations: string[];

  /** Currently selected expiration date */
  selectedExpiration: string | null;

  /** Callback when expiration is selected */
  onSelect: (expiration: string) => void;

  /** Currently highlighted index for keyboard navigation */
  highlightedIndex?: number;

  /** Whether this component has focus for keyboard input */
  isFocused?: boolean;

  /** Maximum number of expirations to display at once (default: 8) */
  maxVisible?: number;
}

/**
 * Format expiration date for display
 * Converts YYYY-MM-DD to more readable format with days until expiration
 */
function formatExpirationDate(dateStr: string): {
  formatted: string;
  daysUntil: number;
  isToday: boolean;
  isWeekly: boolean;
} {
  const date = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate days until expiration
  const diffTime = date.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Format date
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[date.getMonth()];
  const day = date.getDate();
  const year = date.getFullYear();

  // Check if it's a weekly (Friday) expiration
  const isWeekly = date.getDay() === 5; // 5 = Friday

  return {
    formatted: `${month} ${day}, ${year}`,
    daysUntil,
    isToday: daysUntil === 0,
    isWeekly,
  };
}

/**
 * ExpirationSelect Component
 *
 * Displays a list of available expiration dates with keyboard navigation.
 * Shows days until expiration and highlights selected/focused items.
 */
export function ExpirationSelect({
  expirations,
  selectedExpiration,
  onSelect: _onSelect,
  highlightedIndex = 0,
  isFocused = false,
  maxVisible = 8,
}: ExpirationSelectProps) {
  if (expirations.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No expiration dates available</Text>
      </Box>
    );
  }

  // Limit displayed expirations
  const displayedExpirations = expirations.slice(0, maxVisible);
  const hasMore = expirations.length > maxVisible;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color={isFocused ? 'cyan' : 'white'}>
          📅 Expiration Dates {isFocused && <Text color="yellow">(↑↓ to navigate, Enter to select)</Text>}
        </Text>
      </Box>

      {/* Expiration list */}
      <Box flexDirection="column">
        {displayedExpirations.map((expiration, index) => {
          const { formatted, daysUntil, isToday, isWeekly } = formatExpirationDate(expiration);
          const isSelected = expiration === selectedExpiration;
          const isHighlighted = isFocused && index === highlightedIndex;

          // Determine styling
          let backgroundColor: string | undefined;
          let color: string = 'white';

          if (isHighlighted) {
            backgroundColor = 'cyan';
            color = 'black';
          } else if (isSelected) {
            backgroundColor = 'green';
            color = 'black';
          }

          // Days until label with color coding
          let daysLabel = '';
          let daysColor: string = 'white';

          if (isToday) {
            daysLabel = 'TODAY';
            daysColor = 'red';
          } else if (daysUntil === 1) {
            daysLabel = 'Tomorrow';
            daysColor = 'yellow';
          } else if (daysUntil < 7) {
            daysLabel = `${daysUntil}d`;
            daysColor = 'yellow';
          } else if (daysUntil < 30) {
            daysLabel = `${daysUntil}d`;
            daysColor = 'green';
          } else {
            daysLabel = `${daysUntil}d`;
            daysColor = 'cyan';
          }

          return (
            <Box key={expiration} marginBottom={0}>
              <Box width={4}>
                <Text color={color} backgroundColor={backgroundColor}>
                  {isSelected ? ' ✓ ' : isHighlighted ? ' ▶ ' : '   '}
                </Text>
              </Box>
              <Box width={16}>
                <Text color={color} backgroundColor={backgroundColor} bold={isSelected || isHighlighted}>
                  {formatted}
                </Text>
              </Box>
              <Box width={10}>
                <Text color={isHighlighted || isSelected ? color : daysColor} backgroundColor={backgroundColor}>
                  {daysLabel}
                </Text>
              </Box>
              <Box>
                <Text color={color} backgroundColor={backgroundColor} dimColor={!isHighlighted && !isSelected}>
                  {isWeekly ? '📆 Weekly' : '📅 Monthly'}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* More indicator */}
      {hasMore && (
        <Box marginTop={1}>
          <Text dimColor>
            ... and {expirations.length - maxVisible} more ({expirations.length} total)
          </Text>
        </Box>
      )}

      {/* Helper text */}
      {!isFocused && expirations.length > 0 && (
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold color="cyan">e</Text> to select expiration date
          </Text>
        </Box>
      )}
    </Box>
  );
}
