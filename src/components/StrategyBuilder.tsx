// AIDEV-NOTE: Interactive strategy builder component (Task #7, Task #9 - Multi-strategy support)

import React from 'react';
import { Box, Text } from 'ink';
import type { OptionContract, StrategyType } from '../types/index.js';
import {
  calculateBullCallSpread,
  calculateBearPutSpread,
  calculateLongStraddle,
  calculateIronCondor,
  calculateCoveredCall,
  formatCurrency,
  formatPercentage,
  getStrategyDisplayName,
  getStrategyDescription
} from '../utils/strategies.js';
import { safeToFixed } from '../utils/formatters.js';
import { logger } from '../utils/logger.js';

interface StrategyBuilderProps {
  /** Strategy type being built (Task #9) */
  strategyType: StrategyType;

  /** Available call options for building the spread */
  calls: OptionContract[];

  /** Available put options for building the spread (Task #9) */
  puts: OptionContract[];

  /** Current stock price (for Covered Call) */
  stockPrice: number;

  /** Currently selected long call (buy - lower strike) */
  longCall: OptionContract | null;

  /** Currently selected short call (sell - higher strike) */
  shortCall: OptionContract | null;

  /** Currently selected legs (for multi-leg strategies like Iron Condor) */
  selectedLegs: OptionContract[];

  /** Current selection step (Task #9 - Multi-strategy support) */
  selectionStep: 'long' | 'short' | 'leg1' | 'leg2' | 'leg3' | 'leg4';

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
 * Get the number of legs for a strategy type
 */
function getLegCount(strategyType: StrategyType): number {
  switch (strategyType) {
    case 'bull_call_spread':
    case 'bear_put_spread':
      return 2;
    case 'long_straddle':
      return 2;
    case 'iron_condor':
      return 4;
    case 'covered_call':
      return 1;
    default:
      return 2;
  }
}

/**
 * Get instruction text for current step based on strategy type
 */
function getStepInstruction(strategyType: StrategyType, step: string): JSX.Element {
  switch (strategyType) {
    case 'bull_call_spread':
      if (step === 'long') {
        return <><Text bold color="cyan">Step 1:</Text> Select LONG CALL (Buy) - Choose ATM or slightly OTM</>;
      }
      return <><Text bold color="cyan">Step 2:</Text> Select SHORT CALL (Sell) - Choose higher strike</>;

    case 'bear_put_spread':
      if (step === 'leg1') {
        return <><Text bold color="cyan">Step 1:</Text> Select LONG PUT (Buy) - Choose higher strike</>;
      }
      return <><Text bold color="cyan">Step 2:</Text> Select SHORT PUT (Sell) - Choose lower strike</>;

    case 'long_straddle':
      if (step === 'leg1') {
        return <><Text bold color="cyan">Step 1:</Text> Select ATM CALL (Buy)</>;
      }
      return <><Text bold color="cyan">Step 2:</Text> Select ATM PUT (Buy) - Same strike as call</>;

    case 'iron_condor':
      const stepNum = step.replace('leg', '');
      const labels = ['Buy OTM Put (lowest strike)', 'Sell Put (higher strike)', 'Sell Call (even higher)', 'Buy OTM Call (highest)'];
      return <><Text bold color="cyan">Step {stepNum}:</Text> {labels[parseInt(stepNum) - 1]}</>;

    case 'covered_call':
      return <><Text bold color="cyan">Select:</Text> OTM CALL (Sell) - You must own 100 shares</>;

    default:
      return <Text>Select option</Text>;
  }
}

/**
 * StrategyBuilder Component (Task #7, Task #9 - Multi-strategy support)
 *
 * Interactive builder for option strategies.
 * Dynamically adapts to different strategy types.
 */
export function StrategyBuilder({
  strategyType,
  calls,
  puts,
  stockPrice,
  longCall,
  shortCall,
  selectedLegs,
  selectionStep,
  highlightedIndex,
  quantity,
  onSelectOption: _onSelectOption,
  onConfirm: _onConfirm,
  onCancel: _onCancel,
}: StrategyBuilderProps) {
  // Calculate strategy metrics based on strategy type
  const metrics = React.useMemo(() => {
    switch (strategyType) {
      case 'bull_call_spread':
        return longCall && shortCall
          ? calculateBullCallSpread(longCall, shortCall, quantity)
          : null;

      case 'bear_put_spread':
        // For bear put spread: buy higher strike put, sell lower strike put
        const longPut = selectedLegs[0];
        const shortPut = selectedLegs[1];
        return longPut && shortPut
          ? calculateBearPutSpread(longPut, shortPut, quantity)
          : null;

      case 'long_straddle':
        // For straddle: buy ATM call + ATM put (same strike)
        const straddleCall = selectedLegs.find(leg => leg.optionType === 'call');
        const straddlePut = selectedLegs.find(leg => leg.optionType === 'put');
        return straddleCall && straddlePut
          ? calculateLongStraddle(straddleCall, straddlePut, quantity)
          : null;

      case 'iron_condor':
        // For iron condor: 4 legs
        if (selectedLegs.length === 4) {
          const [leg1, leg2, leg3, leg4] = selectedLegs;
          return calculateIronCondor(leg1!, leg2!, leg3!, leg4!, quantity);
        }
        return null;

      case 'covered_call':
        // For covered call: just need the call
        const coveredCall = selectedLegs[0] || longCall;
        return coveredCall
          ? calculateCoveredCall(coveredCall, stockPrice, quantity)
          : null;

      default:
        return null;
    }
  }, [strategyType, longCall, shortCall, selectedLegs, stockPrice, quantity]);

  // Get available options based on strategy type and current step
  const { availableOptions, optionType } = React.useMemo(() => {
    // For bull_call_spread (legacy support with longCall/shortCall)
    if (strategyType === 'bull_call_spread') {
      const availableCalls = selectionStep === 'long'
        ? calls
        : calls.filter(call => longCall ? call.strikePrice > longCall.strikePrice : true);
      return { availableOptions: availableCalls, optionType: 'call' as const };
    }

    // For bear_put_spread
    if (strategyType === 'bear_put_spread') {
      if (selectionStep === 'leg1') {
        return { availableOptions: puts, optionType: 'put' as const };
      }
      // leg2: sell lower strike put (must be lower than leg1)
      const longPut = selectedLegs[0];
      const filtered = longPut ? puts.filter(p => p.strikePrice < longPut.strikePrice) : puts;
      return { availableOptions: filtered, optionType: 'put' as const };
    }

    // For long_straddle
    if (strategyType === 'long_straddle') {
      logger.debug(`🔍 BUILDER FILTER: long_straddle - selectionStep=${selectionStep}, selectedLegs.length=${selectedLegs.length}`);
      if (selectionStep === 'leg1') {
        logger.debug(`🔍 BUILDER FILTER: long_straddle leg1 - returning ${calls.length} calls`);
        return { availableOptions: calls, optionType: 'call' as const };
      }
      // leg2: buy ATM put (same strike as call)
      const selectedCall = selectedLegs.find(leg => leg.optionType === 'call');
      const filtered = selectedCall
        ? puts.filter(p => p.strikePrice === selectedCall.strikePrice)
        : puts;
      logger.debug(`🔍 BUILDER FILTER: long_straddle leg2 - selectedCall strike=${selectedCall?.strikePrice}, filtered=${filtered.length} puts (from ${puts.length} total)`);
      return { availableOptions: filtered, optionType: 'put' as const };
    }

    // For iron_condor
    if (strategyType === 'iron_condor') {
      if (selectionStep === 'leg1') {
        return { availableOptions: puts, optionType: 'put' as const };
      }
      if (selectionStep === 'leg2') {
        // Sell put: must be higher strike than leg 1 (the long put)
        const longPut = selectedLegs[0];
        const filtered = longPut ? puts.filter(p => p.strikePrice > longPut.strikePrice) : puts;
        return { availableOptions: filtered, optionType: 'put' as const };
      }
      if (selectionStep === 'leg3') {
        // Sell call: just show all calls (user will choose OTM call above stock price)
        return { availableOptions: calls, optionType: 'call' as const };
      }
      if (selectionStep === 'leg4') {
        // Buy call: must be higher strike than leg 3 (the short call)
        const shortCall = selectedLegs[2];
        logger.debug(`🔍 BUILDER FILTER: leg4 - selectedLegs.length=${selectedLegs.length}, shortCall=${shortCall ? `strike ${shortCall.strikePrice}` : 'undefined'}`);
        logger.debug(`🔍 BUILDER FILTER: calls.length=${calls.length}, filtering for strikes > ${shortCall?.strikePrice}`);
        const filtered = shortCall ? calls.filter(c => c.strikePrice > shortCall.strikePrice) : calls;
        logger.debug(`🔍 BUILDER FILTER: filtered.length=${filtered.length}, first=${filtered[0]?.strikePrice}, last=${filtered[filtered.length-1]?.strikePrice}`);
        return { availableOptions: filtered, optionType: 'call' as const };
      }
    }

    // For covered_call
    if (strategyType === 'covered_call') {
      return { availableOptions: calls, optionType: 'call' as const };
    }

    // Default fallback
    return { availableOptions: calls, optionType: 'call' as const };
  }, [strategyType, selectionStep, calls, puts, longCall, selectedLegs]);

  // Calculate current leg number and total legs
  const totalLegs = getLegCount(strategyType);
  const currentLegNumber = (() => {
    if (strategyType === 'bull_call_spread') {
      return selectionStep === 'long' ? 1 : 2;
    }
    // For other strategies, extract leg number from selectionStep (e.g., 'leg1' -> 1)
    const match = selectionStep.match(/leg(\d+)/);
    return match && match[1] ? parseInt(match[1], 10) : 1;
  })();

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="double" borderColor="green">
      {/* Header */}
      <Box marginBottom={1} justifyContent="space-between">
        <Box>
          <Text bold color="green">
            🏗️  {getStrategyDisplayName(strategyType)} Builder
          </Text>
          <Text dimColor> ({getStrategyDescription(strategyType)})</Text>
        </Box>
        {/* Leg position indicator */}
        <Box marginLeft={2}>
          <Text bold color="yellow">
            Leg {currentLegNumber}/{totalLegs}
          </Text>
        </Box>
      </Box>

      {/* Instructions */}
      <Box marginBottom={1} flexDirection="column">
        <Text>
          {getStepInstruction(strategyType, selectionStep)}
        </Text>
        <Text dimColor>
          ↑↓ Navigate | Enter Select | Esc Cancel
        </Text>
      </Box>

      {/* Current Selections */}
      <Box marginBottom={1} flexDirection="column" borderStyle="single" padding={1}>
        {/* Bull Call Spread: show longCall and shortCall */}
        {strategyType === 'bull_call_spread' && (
          <>
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
          </>
        )}

        {/* Other strategies: show selectedLegs array */}
        {strategyType !== 'bull_call_spread' && (
          <>
            {selectedLegs.map((leg, index) => (
              <Box key={index}>
                <Box width={15}>
                  <Text bold>Leg {index + 1}:</Text>
                </Box>
                <Box>
                  <Text color={leg.optionType === 'call' ? 'green' : 'magenta'}>
                    ✓ {leg.optionType.toUpperCase()} ${safeToFixed(leg.strikePrice, 2)}
                  </Text>
                </Box>
              </Box>
            ))}
            {/* Show empty slots for remaining legs */}
            {Array.from({ length: getLegCount(strategyType) - selectedLegs.length }).map((_, index) => (
              <Box key={`empty-${index}`}>
                <Box width={15}>
                  <Text bold dimColor>Leg {selectedLegs.length + index + 1}:</Text>
                </Box>
                <Box>
                  <Text dimColor>Not selected</Text>
                </Box>
              </Box>
            ))}
          </>
        )}

        <Box>
          <Box width={15}>
            <Text bold>Quantity:</Text>
          </Box>
          <Box>
            <Text>{quantity} {strategyType === 'covered_call' ? 'contract(s)' : 'spread(s)'}</Text>
          </Box>
        </Box>
      </Box>

      {/* Option Selection List */}
      <Box marginBottom={1} flexDirection="column">
        <Box marginBottom={1}>
          <Text bold underline>
            Available {optionType === 'call' ? 'Calls' : 'Puts'}:
          </Text>
        </Box>

        {/* Column headers */}
        <Box marginBottom={1}>
          <Box width={12}>
            <Text bold dimColor>Strike</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>Bid/Ask</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>Last</Text>
          </Box>
          <Box width={8}>
            <Text bold dimColor>Volume</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>Delta</Text>
          </Box>
          <Box width={10}>
            <Text bold dimColor>IV</Text>
          </Box>
        </Box>

        {/* Options list with scrolling window */}
        <Box flexDirection="column">
          {(() => {
            const DISPLAY_LIMIT = 10;
            const totalOptions = availableOptions.length;

            // Calculate scroll window
            let startIndex = Math.max(0, highlightedIndex - Math.floor(DISPLAY_LIMIT / 2));
            const endIndex = Math.min(totalOptions, startIndex + DISPLAY_LIMIT);

            // Adjust start if we're near the end
            if (endIndex - startIndex < DISPLAY_LIMIT) {
              startIndex = Math.max(0, endIndex - DISPLAY_LIMIT);
            }

            const visibleOptions = availableOptions.slice(startIndex, endIndex);
            const hasMore = {
              above: startIndex > 0,
              below: endIndex < totalOptions,
            };

            // AIDEV-NOTE: Debug logging for display indexing (tracking visual display bug)
            logger.debug(`🔍 DISPLAY: highlightedIndex=${highlightedIndex}, startIndex=${startIndex}, endIndex=${endIndex}, totalOptions=${totalOptions}`);
            logger.debug(`🔍 DISPLAY: visibleOptions.length=${visibleOptions.length}, first visible strike=${visibleOptions[0]?.strikePrice || 'none'}, last visible strike=${visibleOptions[visibleOptions.length - 1]?.strikePrice || 'none'}`);

            // Log all visible strikes for full transparency
            const visibleStrikes = visibleOptions.map(o => o.strikePrice).join(', ');
            logger.debug(`🔍 DISPLAY: All visible strikes: [${visibleStrikes}]`);

            return (
              <>
                {/* Scroll indicator - more above */}
                {hasMore.above && (
                  <Box marginBottom={1}>
                    <Text dimColor>▲ {startIndex} more above</Text>
                  </Box>
                )}

                {/* Visible options */}
                {visibleOptions.map((option, displayIndex) => {
                  const actualIndex = startIndex + displayIndex;
                  const isHighlighted = actualIndex === highlightedIndex;
                  const bgColor = isHighlighted ? 'cyan' : undefined;
                  const textColor = isHighlighted ? 'black' : 'white';

                  // AIDEV-NOTE: Log the highlighted option being rendered
                  if (isHighlighted) {
                    logger.debug(`🔍 DISPLAY: 🎯 RENDERING HIGHLIGHTED: displayIndex=${displayIndex}, actualIndex=${actualIndex}, strikePrice=${option.strikePrice}`);
                  }

                  return (
                    <Box key={option.symbol}>
                      <Box width={12}>
                        <Text color={textColor} backgroundColor={bgColor} bold={isHighlighted}>
                          {isHighlighted ? '▶ ' : '  '}${safeToFixed(option.strikePrice, 2)}
                        </Text>
                      </Box>
                      <Box width={10}>
                        <Text color={textColor} backgroundColor={bgColor}>
                          ${safeToFixed(option.bid, 2)}/${safeToFixed(option.ask, 2)}
                        </Text>
                      </Box>
                      <Box width={10}>
                        <Text color={textColor} backgroundColor={bgColor}>
                          ${safeToFixed(option.lastPrice, 2)}
                        </Text>
                      </Box>
                      <Box width={8}>
                        <Text color={textColor} backgroundColor={bgColor}>
                          {option.volume || 0}
                        </Text>
                      </Box>
                      <Box width={10}>
                        <Text color={textColor} backgroundColor={bgColor}>
                          {safeToFixed(option.delta, 3)}
                        </Text>
                      </Box>
                      <Box width={10}>
                        <Text color={textColor} backgroundColor={bgColor}>
                          {option.impliedVolatility !== undefined
                            ? formatPercentage(option.impliedVolatility * 100)
                            : '-'}
                        </Text>
                      </Box>
                    </Box>
                  );
                })}

                {/* Scroll indicator - more below */}
                {hasMore.below && (
                  <Box marginTop={1}>
                    <Text dimColor>▼ {totalOptions - endIndex} more below</Text>
                  </Box>
                )}
              </>
            );
          })()}
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
            {/* Net Debit or Net Credit */}
            {'netDebit' in metrics && (
              <Box>
                <Box width={20}>
                  <Text bold>Net Debit:</Text>
                </Box>
                <Text color="yellow">{formatCurrency(metrics.netDebit)}</Text>
              </Box>
            )}
            {'netCredit' in metrics && (
              <Box>
                <Box width={20}>
                  <Text bold>Net Credit:</Text>
                </Box>
                <Text color="green">{formatCurrency(metrics.netCredit)}</Text>
              </Box>
            )}
            {'callPremium' in metrics && (
              <Box>
                <Box width={20}>
                  <Text bold>Call Premium:</Text>
                </Box>
                <Text color="green">{formatCurrency(metrics.callPremium)}</Text>
              </Box>
            )}

            {/* Max Loss */}
            <Box>
              <Box width={20}>
                <Text bold>Max Loss:</Text>
              </Box>
              <Text color="red">{formatCurrency(-Math.abs(metrics.maxLoss))}</Text>
            </Box>

            {/* Max Gain */}
            <Box>
              <Box width={20}>
                <Text bold>Max Gain:</Text>
              </Box>
              <Text color="green">
                {metrics.maxGain === Infinity ? '∞ (Unlimited)' : formatCurrency(metrics.maxGain)}
              </Text>
            </Box>

            {/* Break Even (single or dual) */}
            {'breakEven' in metrics && (
              <Box>
                <Box width={20}>
                  <Text bold>Break Even:</Text>
                </Box>
                <Text>${safeToFixed(metrics.breakEven, 2)}</Text>
              </Box>
            )}
            {'upperBreakEven' in metrics && (
              <>
                <Box>
                  <Box width={20}>
                    <Text bold>Upper Break Even:</Text>
                  </Box>
                  <Text>${safeToFixed(metrics.upperBreakEven, 2)}</Text>
                </Box>
                <Box>
                  <Box width={20}>
                    <Text bold>Lower Break Even:</Text>
                  </Box>
                  <Text>${safeToFixed(metrics.lowerBreakEven, 2)}</Text>
                </Box>
              </>
            )}

            {/* Optional metrics */}
            {'profitPotential' in metrics && typeof metrics.profitPotential === 'number' && (
              <Box>
                <Box width={20}>
                  <Text bold>Profit Potential:</Text>
                </Box>
                <Text color="cyan">
                  {metrics.profitPotential === Infinity ? '∞' : formatPercentage(metrics.profitPotential)}
                </Text>
              </Box>
            )}
            {'riskRewardRatio' in metrics && (
              <Box>
                <Box width={20}>
                  <Text bold>Risk/Reward:</Text>
                </Box>
                <Text>1:{safeToFixed(metrics.riskRewardRatio, 2)}</Text>
              </Box>
            )}
            {'returnIfCalled' in metrics && (
              <Box>
                <Box width={20}>
                  <Text bold>Return if Called:</Text>
                </Box>
                <Text color="cyan">{formatPercentage(metrics.returnIfCalled)}</Text>
              </Box>
            )}
          </Box>

          <Box marginTop={1}>
            <Text bold color="green">
              Press Enter to SAVE this strategy
            </Text>
          </Box>
        </Box>
      )}

      {/* Keyboard Shortcuts Reminder */}
      <Box marginTop={1} paddingX={1} borderStyle="single" borderColor="gray">
        <Box flexDirection="column">
          <Text bold dimColor>Keyboard Shortcuts:</Text>
          <Box marginTop={1} flexDirection="row" flexWrap="wrap">
            <Box marginRight={2}>
              <Text color="cyan">↑↓/j/k</Text>
              <Text dimColor> Navigate</Text>
            </Box>
            <Box marginRight={2}>
              <Text color="cyan">Enter</Text>
              <Text dimColor> Select</Text>
            </Box>
            <Box marginRight={2}>
              <Text color="cyan">1-{totalLegs}</Text>
              <Text dimColor> Jump to leg</Text>
            </Box>
            <Box marginRight={2}>
              <Text color="cyan">q/Esc</Text>
              <Text dimColor> Cancel</Text>
            </Box>
          </Box>
        </Box>
      </Box>
    </Box>
  );
}
