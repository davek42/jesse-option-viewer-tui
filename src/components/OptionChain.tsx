// AIDEV-NOTE: Option chain display component showing calls and puts side-by-side

import React from 'react';
import { Box, Text } from 'ink';
import type { OptionChain as OptionChainType, OptionContract } from '../types/index.js';
import { safeToFixed, formatGreek } from '../utils/formatters.js';

interface OptionChainProps {
  /** Option chain data containing calls and puts */
  optionChain: OptionChainType;

  /** Number of strikes to display (10, 40, or -1 for ALL) */
  displayLimit?: number;

  /** Whether to show Greeks columns */
  showGreeks?: boolean;

  /** Currently highlighted row index for keyboard navigation */
  highlightedRow?: number;

  /** Whether this component has focus */
  isFocused?: boolean;
}

/**
 * Find the at-the-money (ATM) strike closest to current stock price
 */
function findATMStrike(calls: OptionContract[], puts: OptionContract[], stockPrice: number): number {
  const allStrikes = [...new Set([...calls.map(c => c.strikePrice), ...puts.map(p => p.strikePrice)])].sort((a, b) => a - b);

  let atmStrike = allStrikes[0] || stockPrice;
  let minDiff = Math.abs(atmStrike - stockPrice);

  for (const strike of allStrikes) {
    const diff = Math.abs(strike - stockPrice);
    if (diff < minDiff) {
      minDiff = diff;
      atmStrike = strike;
    }
  }

  return atmStrike;
}

/**
 * Get centered strikes around ATM for display
 */
function getCenteredStrikes(
  calls: OptionContract[],
  puts: OptionContract[],
  stockPrice: number,
  displayLimit: number
): number[] {
  const allStrikes = [...new Set([...calls.map(c => c.strikePrice), ...puts.map(p => p.strikePrice)])].sort((a, b) => a - b);

  if (displayLimit === -1 || allStrikes.length <= displayLimit) {
    return allStrikes;
  }

  const atmStrike = findATMStrike(calls, puts, stockPrice);
  const atmIndex = allStrikes.indexOf(atmStrike);

  // Calculate how many strikes to show on each side
  const half = Math.floor(displayLimit / 2);
  const startIndex = Math.max(0, atmIndex - half);
  const endIndex = Math.min(allStrikes.length, startIndex + displayLimit);

  return allStrikes.slice(startIndex, endIndex);
}


/**
 * OptionChain Component
 *
 * Displays option chain with calls on the left and puts on the right,
 * centered around the at-the-money strike price.
 */
export function OptionChain({
  optionChain,
  displayLimit = 40,
  showGreeks = true,
  highlightedRow = 0,
  isFocused = false,
}: OptionChainProps) {
  const { calls, puts, underlyingPrice, symbol, expirationDate } = optionChain;

  // Get strikes to display (centered around ATM)
  const displayStrikes = getCenteredStrikes(calls, puts, underlyingPrice, displayLimit);
  const atmStrike = findATMStrike(calls, puts, underlyingPrice);

  // Create maps for quick lookup
  const callsMap = new Map(calls.map(c => [c.strikePrice, c]));
  const putsMap = new Map(puts.map(p => [p.strikePrice, p]));

  // Calculate total shown
  const totalStrikes = [...new Set([...calls.map(c => c.strikePrice), ...puts.map(p => p.strikePrice)])].length;
  const isLimited = displayLimit !== -1 && displayStrikes.length < totalStrikes;

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          📊 Option Chain: {symbol} @ ${safeToFixed(underlyingPrice, 2)}
        </Text>
        <Text dimColor> | Exp: {expirationDate}</Text>
        {isLimited && (
          <Text dimColor>
            {' '}| Showing {displayStrikes.length} of {totalStrikes} strikes
          </Text>
        )}
      </Box>

      {/* Column headers */}
      <Box marginBottom={1}>
        {/* CALLS side */}
        <Box width="50%">
          <Text bold color="green" underline>
            CALLS
          </Text>
        </Box>

        {/* Strike divider */}
        <Box width={10} justifyContent="center">
          <Text bold underline>
            Strike
          </Text>
        </Box>

        {/* PUTS side */}
        <Box width="50%">
          <Text bold color="red" underline>
            PUTS
          </Text>
        </Box>
      </Box>

      {/* Sub-headers with field names */}
      <Box marginBottom={1}>
        {/* CALLS columns */}
        <Box width="50%">
          <Box width={8}>
            <Text dimColor bold>Bid</Text>
          </Box>
          <Box width={8}>
            <Text dimColor bold>Ask</Text>
          </Box>
          <Box width={9}>
            <Text dimColor bold>Last</Text>
          </Box>
          <Box width={9}>
            <Text dimColor bold>Vol</Text>
          </Box>
          {showGreeks && (
            <>
              <Box width={8}>
                <Text dimColor bold>Delta</Text>
              </Box>
              <Box width={8}>
                <Text dimColor bold>IV</Text>
              </Box>
            </>
          )}
        </Box>

        {/* Strike column */}
        <Box width={10} />

        {/* PUTS columns */}
        <Box width="50%">
          {showGreeks && (
            <>
              <Box width={8}>
                <Text dimColor bold>IV</Text>
              </Box>
              <Box width={8}>
                <Text dimColor bold>Delta</Text>
              </Box>
            </>
          )}
          <Box width={9}>
            <Text dimColor bold>Vol</Text>
          </Box>
          <Box width={9}>
            <Text dimColor bold>Last</Text>
          </Box>
          <Box width={8}>
            <Text dimColor bold>Ask</Text>
          </Box>
          <Box width={8}>
            <Text dimColor bold>Bid</Text>
          </Box>
        </Box>
      </Box>

      {/* Option rows */}
      <Box flexDirection="column">
        {displayStrikes.map((strike, index) => {
          const call = callsMap.get(strike);
          const put = putsMap.get(strike);
          const isATM = strike === atmStrike;
          const isHighlighted = isFocused && index === highlightedRow;

          // Determine background color
          let bgColor: string | undefined;
          if (isHighlighted) {
            bgColor = 'cyan';
          } else if (isATM) {
            bgColor = 'yellow';
          }

          const textColor = isHighlighted || isATM ? 'black' : 'white';

          return (
            <Box key={strike} marginBottom={0}>
              {/* CALL side */}
              <Box width="50%">
                {call ? (
                  <>
                    <Box width={8}>
                      <Text color={textColor} backgroundColor={bgColor}>
                        {safeToFixed(call.bid, 2)}
                      </Text>
                    </Box>
                    <Box width={8}>
                      <Text color={textColor} backgroundColor={bgColor}>
                        {safeToFixed(call.ask, 2)}
                      </Text>
                    </Box>
                    <Box width={9}>
                      <Text color={textColor} backgroundColor={bgColor} bold>
                        {safeToFixed(call.lastPrice, 2)}
                      </Text>
                    </Box>
                    <Box width={9}>
                      <Text color={textColor} backgroundColor={bgColor} dimColor={!isATM && !isHighlighted}>
                        {call.volume.toLocaleString()}
                      </Text>
                    </Box>
                    {showGreeks && (
                      <>
                        <Box width={8}>
                          <Text color={textColor} backgroundColor={bgColor}>
                            {formatGreek(call.delta)}
                          </Text>
                        </Box>
                        <Box width={8}>
                          <Text color={textColor} backgroundColor={bgColor}>
                            {call.impliedVolatility !== undefined
                              ? safeToFixed(call.impliedVolatility * 100, 1) + '%'
                              : '-'}
                          </Text>
                        </Box>
                      </>
                    )}
                  </>
                ) : (
                  <Box width={showGreeks ? 50 : 34}>
                    <Text color={textColor} backgroundColor={bgColor} dimColor>
                      -
                    </Text>
                  </Box>
                )}
              </Box>

              {/* Strike price (center) */}
              <Box width={10} justifyContent="center">
                <Text color={textColor} backgroundColor={bgColor} bold>
                  ${safeToFixed(strike, 2)}
                  {isATM && '●'}
                </Text>
              </Box>

              {/* PUT side */}
              <Box width="50%">
                {put ? (
                  <>
                    {showGreeks && (
                      <>
                        <Box width={8}>
                          <Text color={textColor} backgroundColor={bgColor}>
                            {put.impliedVolatility !== undefined
                              ? safeToFixed(put.impliedVolatility * 100, 1) + '%'
                              : '-'}
                          </Text>
                        </Box>
                        <Box width={8}>
                          <Text color={textColor} backgroundColor={bgColor}>
                            {formatGreek(put.delta)}
                          </Text>
                        </Box>
                      </>
                    )}
                    <Box width={9}>
                      <Text color={textColor} backgroundColor={bgColor} dimColor={!isATM && !isHighlighted}>
                        {put.volume.toLocaleString()}
                      </Text>
                    </Box>
                    <Box width={9}>
                      <Text color={textColor} backgroundColor={bgColor} bold>
                        {safeToFixed(put.lastPrice, 2)}
                      </Text>
                    </Box>
                    <Box width={8}>
                      <Text color={textColor} backgroundColor={bgColor}>
                        {safeToFixed(put.ask, 2)}
                      </Text>
                    </Box>
                    <Box width={8}>
                      <Text color={textColor} backgroundColor={bgColor}>
                        {safeToFixed(put.bid, 2)}
                      </Text>
                    </Box>
                  </>
                ) : (
                  <Box width={showGreeks ? 50 : 34}>
                    <Text color={textColor} backgroundColor={bgColor} dimColor>
                      -
                    </Text>
                  </Box>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>

      {/* Footer info */}
      <Box marginTop={1} flexDirection="column">
        <Text dimColor>
          ATM Strike: ${safeToFixed(atmStrike, 2)} ● | Total Calls: {calls.length} | Total Puts: {puts.length}
        </Text>
        {!showGreeks && (
          <Text dimColor>
            Press <Text bold color="cyan">g</Text> to toggle Greeks display
          </Text>
        )}
      </Box>
    </Box>
  );
}
