// AIDEV-NOTE: Saved strategies display component (Task #8) - spreadsheet-like layout

import React from 'react';
import { Box, Text } from 'ink';
import type { OptionStrategy } from '../types/index.js';
import { getStrategyDisplayName, formatCurrency, getLegAction } from '../utils/strategies.js';
import { safeToFixed } from '../utils/formatters.js';

interface SavedStrategiesProps {
  /** List of saved strategies */
  strategies: OptionStrategy[];

  /** Callback when user wants to remove a strategy */
  onRemove?: (strategyId: string) => void;

  /** Currently selected/highlighted strategy index */
  highlightedIndex?: number;

  /** Whether this component has focus */
  isFocused?: boolean;
}

/**
 * SavedStrategies Component (Task #8)
 *
 * Displays saved option strategies in a spreadsheet-like layout.
 * Shows: type, strike prices, max loss, max gain, break even prices.
 */
export function SavedStrategies({
  strategies,
  onRemove: _onRemove,
  highlightedIndex = 0,
  isFocused = false,
}: SavedStrategiesProps) {
  if (strategies.length === 0) {
    return (
      <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="gray">
        <Box marginBottom={1}>
          <Text bold color="yellow">
            💼 Saved Strategies
          </Text>
        </Box>
        <Box>
          <Text dimColor>No strategies saved yet. Build a strategy to get started!</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Press <Text bold color="cyan">b</Text> to build a Bull Call Spread strategy
          </Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="round" borderColor="cyan">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          💼 Saved Strategies ({strategies.length})
        </Text>
        {isFocused && (
          <Text color="yellow"> (↑↓ to navigate, x to delete)</Text>
        )}
      </Box>

      {/* Column Headers */}
      <Box marginBottom={1}>
        <Box width={3}>
          <Text bold dimColor>#</Text>
        </Box>
        <Box width={22}>
          <Text bold dimColor>Strategy</Text>
        </Box>
        <Box width={30}>
          <Text bold dimColor>Legs</Text>
        </Box>
        <Box width={12}>
          <Text bold dimColor>Max Loss</Text>
        </Box>
        <Box width={12}>
          <Text bold dimColor>Max Gain</Text>
        </Box>
        <Box width={14}>
          <Text bold dimColor>Break Even</Text>
        </Box>
        <Box width={10}>
          <Text bold dimColor>R/R</Text>
        </Box>
      </Box>

      {/* Strategy Rows */}
      <Box flexDirection="column">
        {strategies.map((strategy, index) => {
          const isHighlighted = isFocused && index === highlightedIndex;
          const bgColor = isHighlighted ? 'cyan' : undefined;
          const textColor = isHighlighted ? 'black' : 'white';

          // Calculate risk/reward ratio
          const riskRewardRatio = strategy.maxLoss > 0
            ? safeToFixed(strategy.maxGain / strategy.maxLoss, 2)
            : '-';

          // Format break even prices
          const breakEvens = strategy.breakEvenPrices
            .map(be => `$${safeToFixed(be, 2)}`)
            .join(', ');

          return (
            <Box key={strategy.id} marginBottom={0}>
              {/* Index */}
              <Box width={3}>
                <Text color={textColor} backgroundColor={bgColor}>
                  {index + 1}.
                </Text>
              </Box>

              {/* Strategy Type */}
              <Box width={22}>
                <Text color={textColor} backgroundColor={bgColor} bold={isHighlighted}>
                  {getStrategyDisplayName(strategy.type)}
                </Text>
              </Box>

              {/* Legs with color coding (BUY=green, SELL=red) */}
              <Box width={30}>
                {strategy.legs.map((leg, legIndex) => {
                  const action = getLegAction(strategy.type, legIndex);
                  const actionColor = isHighlighted
                    ? textColor
                    : action === 'buy'
                    ? 'green'
                    : 'red';
                  const actionText = action.toUpperCase();
                  const strikeText = `$${safeToFixed(leg.strikePrice, 2)}`;

                  return (
                    <Box key={legIndex} marginRight={legIndex < strategy.legs.length - 1 ? 1 : 0}>
                      <Text color={actionColor} backgroundColor={bgColor}>
                        {actionText} {strikeText}
                        {legIndex < strategy.legs.length - 1 ? ' |' : ''}
                      </Text>
                    </Box>
                  );
                })}
              </Box>

              {/* Max Loss */}
              <Box width={12}>
                <Text color={isHighlighted ? textColor : 'red'} backgroundColor={bgColor}>
                  {formatCurrency(-Math.abs(strategy.maxLoss))}
                </Text>
              </Box>

              {/* Max Gain */}
              <Box width={12}>
                <Text color={isHighlighted ? textColor : 'green'} backgroundColor={bgColor}>
                  {formatCurrency(strategy.maxGain)}
                </Text>
              </Box>

              {/* Break Even */}
              <Box width={14}>
                <Text color={textColor} backgroundColor={bgColor}>
                  {breakEvens}
                </Text>
              </Box>

              {/* Risk/Reward */}
              <Box width={10}>
                <Text color={textColor} backgroundColor={bgColor}>
                  1:{riskRewardRatio}
                </Text>
              </Box>

              {/* Delete indicator */}
              {isHighlighted && (
                <Box marginLeft={1}>
                  <Text color={textColor} backgroundColor={bgColor} dimColor>
                    ✕
                  </Text>
                </Box>
              )}
            </Box>
          );
        })}
      </Box>

      {/* Footer info */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          Total Strategies: {strategies.length} | Max Risk: {formatCurrency(
            -strategies.reduce((sum, s) => sum + Math.abs(s.maxLoss), 0)
          )} | Potential: {formatCurrency(
            strategies.reduce((sum, s) => sum + s.maxGain, 0)
          )}
        </Text>
        {!isFocused && strategies.length > 0 && (
          <Text dimColor>
            Press <Text bold color="cyan">v</Text> to view/manage strategies
          </Text>
        )}
      </Box>
    </Box>
  );
}
