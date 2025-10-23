// AIDEV-NOTE: Full-screen saved strategies management

import React from 'react';
import { Box, Text } from 'ink';
import { useAppContext } from '../context/AppContext.js';
import { SavedStrategies } from '../components/SavedStrategies.js';

interface SavedStrategiesScreenProps {
  /** Currently highlighted strategy index */
  highlightedIndex?: number;

  /** Callback when user removes a strategy */
  onRemove?: (strategyId: string) => void;
}

/**
 * SavedStrategiesScreen Component
 *
 * Full-screen view for managing saved option strategies.
 * Provides detailed view of all strategies with management capabilities.
 */
export function SavedStrategiesScreen({
  highlightedIndex = 0,
  onRemove,
}: SavedStrategiesScreenProps) {
  const { state, dispatch } = useAppContext();
  const { savedStrategies } = state;

  /**
   * Handle strategy removal
   */
  function handleStrategyRemove(strategyId: string) {
    dispatch({ type: 'REMOVE_STRATEGY', payload: strategyId });
    dispatch({
      type: 'SET_STATUS',
      payload: { message: 'Strategy removed', type: 'info' },
    });

    if (onRemove) {
      onRemove(strategyId);
    }
  }

  return (
    <Box flexDirection="column" paddingY={1}>
      {/* Header */}
      <Box
        paddingX={1}
        marginBottom={1}
        borderStyle="round"
        borderColor="cyan"
      >
        <Text bold color="cyan">
          💼 Saved Strategies Management
        </Text>
      </Box>

      {/* Strategies list */}
      <Box marginBottom={2}>
        <SavedStrategies
          strategies={savedStrategies}
          onRemove={handleStrategyRemove}
          highlightedIndex={highlightedIndex}
          isFocused={true}
        />
      </Box>

      {/* Portfolio summary */}
      {savedStrategies.length > 0 && (
        <Box
          flexDirection="column"
          paddingX={1}
          marginBottom={2}
          borderStyle="single"
          borderColor="green"
        >
          <Box marginBottom={1}>
            <Text bold color="green">
              📊 Portfolio Summary
            </Text>
          </Box>

          <Box flexDirection="column">
            <Box>
              <Box width={20}>
                <Text dimColor>Total Strategies:</Text>
              </Box>
              <Text bold>{savedStrategies.length}</Text>
            </Box>

            <Box>
              <Box width={20}>
                <Text dimColor>Total Capital at Risk:</Text>
              </Box>
              <Text color="red">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(-savedStrategies.reduce((sum, s) => sum + Math.abs(s.maxLoss), 0))}
              </Text>
            </Box>

            <Box>
              <Box width={20}>
                <Text dimColor>Total Potential Gain:</Text>
              </Box>
              <Text color="green">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(savedStrategies.reduce((sum, s) => sum + s.maxGain, 0))}
              </Text>
            </Box>

            <Box>
              <Box width={20}>
                <Text dimColor>Overall Risk/Reward:</Text>
              </Box>
              <Text bold color="cyan">
                1:
                {savedStrategies.reduce((sum, s) => sum + Math.abs(s.maxLoss), 0) > 0
                  ? (
                      savedStrategies.reduce((sum, s) => sum + s.maxGain, 0) /
                      savedStrategies.reduce((sum, s) => sum + Math.abs(s.maxLoss), 0)
                    ).toFixed(2)
                  : '0.00'}
              </Text>
            </Box>
          </Box>
        </Box>
      )}

      {/* Instructions */}
      <Box paddingX={1} marginTop={1}>
        <Text dimColor>
          <Text bold color="cyan">↑↓/j/k</Text> Navigate{' '}
          <Text bold color="cyan">x</Text> Delete Strategy{' '}
          <Text bold color="cyan">q</Text> Back
        </Text>
      </Box>
    </Box>
  );
}
