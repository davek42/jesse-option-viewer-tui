// AIDEV-NOTE: Save confirmation dialog showing full strategy summary before saving

import React from 'react';
import { Box, Text } from 'ink';
import type { OptionStrategy } from '../types/index.js';
import { safeToFixed } from '../utils/formatters.js';

interface SaveConfirmationProps {
  /** The strategy to be saved */
  strategy: OptionStrategy;
}

/**
 * Get display name for strategy type
 */
function getStrategyDisplayName(type: string): string {
  const names: Record<string, string> = {
    bull_call_spread: 'Bull Call Spread',
    bear_put_spread: 'Bear Put Spread',
    bull_put_spread: 'Bull Put Spread',
    bear_call_spread: 'Bear Call Spread',
    diagonal_call_spread: 'Diagonal Call Spread',
    diagonal_put_spread: 'Diagonal Put Spread',
    butterfly_spread: 'Butterfly Spread',
    condor_spread: 'Condor Spread',
    strangle_spread: 'Strangle Spread',
    iron_condor: 'Iron Condor',
    long_straddle: 'Long Straddle',
    covered_call: 'Covered Call',
  };
  return names[type] || type;
}

/**
 * SaveConfirmation Component
 *
 * Displays a confirmation dialog with full strategy details
 * before saving the strategy.
 */
export function SaveConfirmation({ strategy }: SaveConfirmationProps) {
  return (
    <Box flexDirection="column" paddingX={2} paddingY={1}>
      {/* Header */}
      <Box
        marginBottom={1}
        borderStyle="double"
        borderColor="yellow"
        paddingX={1}
      >
        <Text bold color="yellow">
          ⚠️  Confirm Save Strategy
        </Text>
      </Box>

      {/* Strategy Type */}
      <Box marginBottom={1} paddingX={1}>
        <Text bold color="cyan">Strategy Type: </Text>
        <Text>{getStrategyDisplayName(strategy.type)}</Text>
      </Box>

      {/* Symbol */}
      <Box marginBottom={1} paddingX={1}>
        <Text bold color="cyan">Symbol: </Text>
        <Text>{strategy.symbol}</Text>
      </Box>

      {/* Legs */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="green">Strategy Legs:</Text>
        <Box marginTop={1} flexDirection="column">
          {strategy.legs.map((leg, index) => {
            const legNumber = index + 1;
            const isLong = leg.optionType === 'call' || leg.optionType === 'put';
            const color = isLong ? 'green' : 'red';
            const action = isLong ? 'BUY' : 'SELL';

            return (
              <Box key={index} marginBottom={0}>
                <Box width={12}>
                  <Text bold color={color}>Leg {legNumber}:</Text>
                </Box>
                <Box width={8}>
                  <Text color={color}>{action}</Text>
                </Box>
                <Box width={15}>
                  <Text>{leg.optionType.toUpperCase()}</Text>
                </Box>
                <Box width={15}>
                  <Text>Strike: ${safeToFixed(leg.strikePrice, 2)}</Text>
                </Box>
                <Box width={15}>
                  <Text>Exp: {leg.expirationDate}</Text>
                </Box>
                <Box width={12}>
                  <Text>@ ${safeToFixed(leg.ask, 2)}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Risk/Reward Summary */}
      <Box marginBottom={1} flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
        <Text bold color="magenta">Risk/Reward Summary:</Text>
        <Box marginTop={1} flexDirection="column">
          <Box>
            <Box width={20}>
              <Text bold>Max Loss:</Text>
            </Box>
            <Text color="red">${safeToFixed(Math.abs(strategy.maxLoss), 2)}</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text bold>Max Gain:</Text>
            </Box>
            <Text color="green">${safeToFixed(strategy.maxGain, 2)}</Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text bold>Risk/Reward:</Text>
            </Box>
            <Text>
              {strategy.maxLoss !== 0
                ? safeToFixed(strategy.maxGain / Math.abs(strategy.maxLoss), 2)
                : 'N/A'}
            </Text>
          </Box>
          <Box>
            <Box width={20}>
              <Text bold>Break-Even:</Text>
            </Box>
            <Text>
              {strategy.breakEvenPrices.length > 0
                ? strategy.breakEvenPrices.map(p => `$${safeToFixed(p, 2)}`).join(', ')
                : 'N/A'}
            </Text>
          </Box>
        </Box>
      </Box>

      {/* Instructions */}
      <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="yellow">
        <Box flexDirection="column">
          <Text bold color="yellow">Confirm this strategy?</Text>
          <Box marginTop={1}>
            <Text>
              Press <Text bold color="green">Enter</Text> to save  |  Press{' '}
              <Text bold color="red">Esc/q</Text> to cancel
            </Text>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
