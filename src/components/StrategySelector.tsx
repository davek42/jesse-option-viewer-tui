// AIDEV-NOTE: Strategy type selection menu (Task #9)

import React from 'react';
import { Box, Text } from 'ink';
import type { StrategyType } from '../types/index.js';
import { getStrategyDisplayName, getStrategyDescription } from '../utils/strategies.js';

interface StrategySelectorProps {
  /** Currently highlighted strategy index */
  highlightedIndex: number;

  /** Callback when user selects a strategy */
  onSelect?: (strategyType: StrategyType) => void;

  /** Callback when user cancels */
  onCancel?: () => void;
}

// Available strategies for user selection (Task #9)
const AVAILABLE_STRATEGIES: StrategyType[] = [
  'bull_call_spread',
  'bear_put_spread',
  'diagonal_call_spread',
  'iron_condor',
  'long_straddle',
  'covered_call',
];

/**
 * StrategySelector Component (Task #9)
 *
 * Displays a menu of available option strategies for the user to choose from.
 * User navigates with ↑↓/j/k and selects with Enter.
 */
export function StrategySelector({
  highlightedIndex,
  onSelect: _onSelect,
  onCancel: _onCancel,
}: StrategySelectorProps) {
  return (
    <Box flexDirection="column" paddingX={1} borderStyle="double" borderColor="cyan">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          🏗️  Strategy Builder - Choose Strategy Type
        </Text>
      </Box>

      {/* Instructions */}
      <Box marginBottom={1}>
        <Text dimColor>
          ↑↓/j/k Navigate | Enter Select | Esc Cancel
        </Text>
      </Box>

      {/* Strategy list */}
      <Box flexDirection="column" marginBottom={1}>
        {AVAILABLE_STRATEGIES.map((strategyType, index) => {
          const isHighlighted = index === highlightedIndex;
          const bgColor = isHighlighted ? 'cyan' : undefined;
          const textColor = isHighlighted ? 'black' : 'white';

          const displayName = getStrategyDisplayName(strategyType);
          const description = getStrategyDescription(strategyType);

          // Get strategy characteristics
          const characteristics = getStrategyCharacteristics(strategyType);

          return (
            <Box
              key={strategyType}
              flexDirection="column"
              marginBottom={1}
              borderStyle={isHighlighted ? 'single' : undefined}
              borderColor={isHighlighted ? 'cyan' : undefined}
              paddingX={1}
            >
              {/* Strategy name */}
              <Box>
                <Text color={textColor} backgroundColor={bgColor} bold>
                  {isHighlighted ? '▶ ' : '  '}
                  {displayName}
                </Text>
                <Box marginLeft={2}>
                  <Text color={characteristics.color}>{characteristics.bias}</Text>
                </Box>
              </Box>

              {/* Description */}
              <Box marginLeft={3}>
                <Text dimColor={!isHighlighted}>{description}</Text>
              </Box>

              {/* Characteristics */}
              <Box marginLeft={3}>
                <Text dimColor>
                  Risk: <Text color={characteristics.riskColor}>{characteristics.risk}</Text> |
                  Legs: {characteristics.legs} |
                  Complexity: {characteristics.complexity}
                </Text>
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Footer help */}
      <Box>
        <Text dimColor>
          Select a strategy to begin building your position
        </Text>
      </Box>
    </Box>
  );
}

/**
 * Get strategy characteristics for display
 */
function getStrategyCharacteristics(type: StrategyType): {
  bias: string;
  color: string;
  risk: string;
  riskColor: string;
  legs: number;
  complexity: string;
} {
  const characteristics: Record<StrategyType, {
    bias: string;
    color: string;
    risk: string;
    riskColor: string;
    legs: number;
    complexity: string;
  }> = {
    bull_call_spread: {
      bias: '📈 Bullish',
      color: 'green',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: '⭐ Easy',
    },
    bear_put_spread: {
      bias: '📉 Bearish',
      color: 'red',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: '⭐ Easy',
    },
    iron_condor: {
      bias: '↔️  Neutral',
      color: 'yellow',
      risk: 'Limited',
      riskColor: 'green',
      legs: 4,
      complexity: '⭐⭐⭐ Complex',
    },
    long_straddle: {
      bias: '💥 High Vol',
      color: 'magenta',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: '⭐⭐ Medium',
    },
    covered_call: {
      bias: '📈 Income',
      color: 'cyan',
      risk: 'Stock Risk',
      riskColor: 'yellow',
      legs: 2,
      complexity: '⭐ Easy',
    },
    // Defaults for other strategies
    bull_put_spread: {
      bias: 'Bullish',
      color: 'green',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: 'Easy',
    },
    bear_call_spread: {
      bias: 'Bearish',
      color: 'red',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: 'Easy',
    },
    diagonal_call_spread: {
      bias: '📈 Bullish + Time',
      color: 'green',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: '⭐⭐ Medium',
    },
    diagonal_put_spread: {
      bias: 'Bearish',
      color: 'red',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: 'Medium',
    },
    butterfly_spread: {
      bias: 'Neutral',
      color: 'yellow',
      risk: 'Limited',
      riskColor: 'green',
      legs: 4,
      complexity: 'Complex',
    },
    condor_spread: {
      bias: 'Neutral',
      color: 'yellow',
      risk: 'Limited',
      riskColor: 'green',
      legs: 4,
      complexity: 'Complex',
    },
    strangle_spread: {
      bias: 'High Vol',
      color: 'magenta',
      risk: 'Limited',
      riskColor: 'green',
      legs: 2,
      complexity: 'Medium',
    },
  };

  return characteristics[type] || {
    bias: 'Unknown',
    color: 'white',
    risk: 'Unknown',
    riskColor: 'white',
    legs: 0,
    complexity: 'Unknown',
  };
}
