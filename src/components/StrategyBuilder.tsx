// AIDEV-NOTE: Interactive strategy builder component for Bull Call Spread (Task #7)

import React from 'react';
import { Box, Text } from 'ink';
import type { OptionContract } from '../types/index.js';
import { calculateBullCallSpread, formatCurrency, formatPercentage } from '../utils/strategies.js';

/**
 * Safely format a number with toFixed, handling string values from API
 */
function safeToFixed(value: number | undefined, decimals: number = 2): string {
  if (value === undefined || value === null) return '-';

  // Handle non-number types (API might return strings)
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));

  // Check if conversion resulted in valid number
  if (isNaN(numValue)) return '-';

  return numValue.toFixed(decimals);
}

interface StrategyBuilderProps {
  /** Available call options for building the spread */
  calls: OptionContract[];

  /** Currently selected long call (buy - lower strike) */
  longCall: OptionContract | null;

  /** Currently selected short call (sell - higher strike) */
  shortCall: OptionContract | null;

  /** Current selection step: 'long' or 'short' */
  selectionStep: 'long' | 'short';

  /** Highlighted index for option selection */
  highlightedIndex: number;

  /** Quantity of spreads */
  quantity: number;

  /** Callback when user selects an option */
  onSelectOption: (option: OptionContract) => void;

  /** Callback when user confirms the strategy */
  onConfirm: () => void;

  /** Callback when user cancels */
  onCancel: () => void;
}

/**
 * StrategyBuilder Component (Task #7)
 *
 * Interactive builder for Bull Call Spread strategy.
 * User selects two calls: buy lower strike, sell higher strike.
 */
export function StrategyBuilder({
  calls,
  longCall,
  shortCall,
  selectionStep,
  highlightedIndex,
  quantity,
  onSelectOption: _onSelectOption,
  onConfirm: _onConfirm,
  onCancel: _onCancel,
}: StrategyBuilderProps) {
  // Calculate strategy metrics if both legs are selected
  const metrics = longCall && shortCall
    ? calculateBullCallSpread(longCall, shortCall, quantity)
    : null;

  // Filter calls for appropriate selection
  const availableCalls = selectionStep === 'long'
    ? calls // All calls available for long position
    : calls.filter(call => longCall ? call.strikePrice > longCall.strikePrice : true); // Only higher strikes for short

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="double" borderColor="green">
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="green">
          🏗️  Bull Call Spread Builder
        </Text>
        <Text dimColor> (Moderately Bullish Strategy)</Text>
      </Box>

      {/* Instructions */}
      <Box marginBottom={1} flexDirection="column">
        <Text>
          {selectionStep === 'long' && (
            <>
              <Text bold color="cyan">Step 1:</Text> Select LONG CALL (Buy) - Choose ATM or slightly OTM
            </>
          )}
          {selectionStep === 'short' && (
            <>
              <Text bold color="cyan">Step 2:</Text> Select SHORT CALL (Sell) - Choose higher strike
            </>
          )}
        </Text>
        <Text dimColor>
          ↑↓ Navigate | Enter Select | Esc Cancel
        </Text>
      </Box>

      {/* Current Selections */}
      <Box marginBottom={1} flexDirection="column" borderStyle="single" padding={1}>
        <Box>
          <Box width={15}>
            <Text bold>Long Call:</Text>
          </Box>
          <Box>
            {longCall ? (
              <Text color="green">
                ✓ BUY ${safeToFixed(longCall.strikePrice, 2)} @ ${safeToFixed(longCall.ask, 2)}
              </Text>
            ) : (
              <Text dimColor>Not selected</Text>
            )}
          </Box>
        </Box>
        <Box>
          <Box width={15}>
            <Text bold>Short Call:</Text>
          </Box>
          <Box>
            {shortCall ? (
              <Text color="red">
                ✓ SELL ${safeToFixed(shortCall.strikePrice, 2)} @ ${safeToFixed(shortCall.bid, 2)}
              </Text>
            ) : (
              <Text dimColor>Not selected</Text>
            )}
          </Box>
        </Box>
        <Box>
          <Box width={15}>
            <Text bold>Quantity:</Text>
          </Box>
          <Box>
            <Text>{quantity} spread(s)</Text>
          </Box>
        </Box>
      </Box>

      {/* Option Selection List */}
      <Box marginBottom={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>
            Available {selectionStep === 'long' ? 'LONG' : 'SHORT'} Calls:
          </Text>
        </Box>

        {/* Column headers */}
        <Box marginBottom={1}>
          <Box width={12}>
            <Text bold dimColor>Strike</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>{selectionStep === 'long' ? 'Ask' : 'Bid'}</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>Last</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>Delta</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>IV</Text>
          </Box>
        </Box>

        {/* Options list */}
        <Box flexDirection="column">
          {availableCalls.slice(0, 10).map((call, index) => {
            const isHighlighted = index === highlightedIndex;
            const bgColor = isHighlighted ? 'cyan' : undefined;
            const textColor = isHighlighted ? 'black' : 'white';

            return (
              <Box key={call.symbol}>
                <Box width={12}>
                  <Text color={textColor} backgroundColor={bgColor} bold={isHighlighted}>
                    {isHighlighted ? '▶ ' : '  '}${safeToFixed(call.strikePrice, 2)}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={textColor} backgroundColor={bgColor}>
                    ${safeToFixed(selectionStep === 'long' ? call.ask : call.bid, 2)}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={textColor} backgroundColor={bgColor}>
                    ${safeToFixed(call.lastPrice, 2)}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={textColor} backgroundColor={bgColor}>
                    {safeToFixed(call.delta, 3)}
                  </Text>
                </Box>
                <Box width={10}>
                  <Text color={textColor} backgroundColor={bgColor}>
                    {call.impliedVolatility !== undefined
                      ? formatPercentage(call.impliedVolatility * 100)
                      : '-'}
                  </Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>

      {/* Strategy Preview */}
      {metrics && (
        <Box marginBottom={1} flexDirection="column" borderStyle="single" borderColor="green" padding={1}>
          <Box marginBottom={1}>
            <Text bold color="green">
              📊 Strategy Preview
            </Text>
          </Box>

          <Box flexDirection="column">
            <Box>
              <Box width={20}>
                <Text bold>Net Debit:</Text>
              </Box>
              <Text color="yellow">{formatCurrency(metrics.netDebit)}</Text>
            </Box>
            <Box>
              <Box width={20}>
                <Text bold>Max Loss:</Text>
              </Box>
              <Text color="red">{formatCurrency(-Math.abs(metrics.maxLoss))}</Text>
            </Box>
            <Box>
              <Box width={20}>
                <Text bold>Max Gain:</Text>
              </Box>
              <Text color="green">{formatCurrency(metrics.maxGain)}</Text>
            </Box>
            <Box>
              <Box width={20}>
                <Text bold>Break Even:</Text>
              </Box>
              <Text>${safeToFixed(metrics.breakEven, 2)}</Text>
            </Box>
            <Box>
              <Box width={20}>
                <Text bold>Profit Potential:</Text>
              </Box>
              <Text color="cyan">{formatPercentage(metrics.profitPotential)}</Text>
            </Box>
            <Box>
              <Box width={20}>
                <Text bold>Risk/Reward:</Text>
              </Box>
              <Text>1:{safeToFixed(metrics.riskRewardRatio, 2)}</Text>
            </Box>
          </Box>

          <Box marginTop={1}>
            <Text bold color="green">
              Press Enter to SAVE this strategy
            </Text>
          </Box>
        </Box>
      )}

      {/* Help text */}
      <Box>
        <Text dimColor>
          Strategy: Buy lower strike call (bullish), sell higher strike call (limit profit).
          Max loss = net debit. Max gain = spread width - net debit.
        </Text>
      </Box>
    </Box>
  );
}
