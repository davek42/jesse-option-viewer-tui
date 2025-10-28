// AIDEV-NOTE: Expiration date selection component with keyboard navigation and scrolling (Phase 2)

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

  /** Maximum number of expirations to display at once (default: 15) */
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
  // Parse date string manually to avoid timezone issues
  // Input format: YYYY-MM-DD
  const [yearStr, monthStr, dayStr] = dateStr.split('-');
  const year = parseInt(yearStr!, 10);
  const month = parseInt(monthStr!, 10) - 1; // Month is 0-indexed
  const day = parseInt(dayStr!, 10);

  // Create date in local timezone (not UTC)
  const date = new Date(year, month, day);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Calculate days until expiration
  const diffTime = date.getTime() - today.getTime();
  const daysUntil = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Format date
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const monthName = monthNames[month];

  // Check if it's a weekly (Friday) expiration
  const isWeekly = date.getDay() === 5; // 5 = Friday

  return {
    formatted: `${monthName} ${day}, ${year}`,
    daysUntil,
    isToday: daysUntil === 0,
    isWeekly,
  };
}

/**
 * ExpirationSelect Component
 *
 * Displays a scrollable list of available expiration dates with keyboard navigation.
 * Shows days until expiration and highlights selected/focused items.
 * Supports scrolling when there are more expirations than can fit on screen.
 */
export function ExpirationSelect({
  expirations,
  selectedExpiration,
  onSelect: _onSelect,
  highlightedIndex = 0,
  isFocused = false,
  maxVisible = 15,
}: ExpirationSelectProps) {
  if (expirations.length === 0) {
    return (
      <Box paddingX={1}>
        <Text dimColor>No expiration dates available</Text>
      </Box>
    );
  }

  // Calculate scroll window to keep highlighted item visible
  // Strategy: Keep highlighted item in the middle when possible
  const totalItems = expirations.length;
  const needsScrolling = totalItems > maxVisible;

  let scrollOffset = 0;
  if (needsScrolling) {
    // Try to keep highlighted item in the middle of the visible window
    const middlePosition = Math.floor(maxVisible / 2);
    scrollOffset = Math.max(0, highlightedIndex - middlePosition);

    // Don't scroll past the end
    const maxOffset = totalItems - maxVisible;
    scrollOffset = Math.min(scrollOffset, maxOffset);
  }

  // Calculate visible range
  const visibleStart = scrollOffset;
  const visibleEnd = Math.min(scrollOffset + maxVisible, totalItems);
  const displayedExpirations = expirations.slice(visibleStart, visibleEnd);

  // Scroll indicators
  const hasItemsAbove = scrollOffset > 0;
  const hasItemsBelow = visibleEnd < totalItems;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header with scroll position */}
      <Box marginBottom={1} justifyContent="space-between">
        <Text bold color={isFocused ? 'cyan' : 'white'}>
          📅 Expiration Dates {isFocused && <Text color="yellow">(k/j navigate, K/J jump 10)</Text>}
        </Text>
        {needsScrolling && (
          <Text dimColor>
            Showing {visibleStart + 1}-{visibleEnd} of {totalItems}
          </Text>
        )}
      </Box>

      {/* Scroll indicator - items above */}
      {hasItemsAbove && (
        <Box marginBottom={0} paddingLeft={1}>
          <Text color="cyan" bold>▲ {scrollOffset} more above</Text>
        </Box>
      )}

      {/* Expiration list */}
      <Box flexDirection="column">
        {displayedExpirations.map((expiration, displayIndex) => {
          const actualIndex = visibleStart + displayIndex;
          const { formatted, daysUntil, isToday, isWeekly } = formatExpirationDate(expiration);
          const isSelected = expiration === selectedExpiration;
          const isHighlighted = isFocused && actualIndex === highlightedIndex;

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

      {/* Scroll indicator - items below */}
      {hasItemsBelow && (
        <Box marginTop={0} paddingLeft={1}>
          <Text color="cyan" bold>▼ {totalItems - visibleEnd} more below</Text>
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
