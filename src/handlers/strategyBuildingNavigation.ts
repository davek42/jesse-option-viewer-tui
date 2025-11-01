// AIDEV-NOTE: Handle navigation within strategy builder
// Extracted from App.tsx strategy building section

import type { HandlerContext, HandlerResult } from './types.js';
import { getAvailableOptionsForStep, shouldCenterOnATM, getLegCountForStrategy } from './strategyHelpers.js';
import { logger } from '../utils/logger.js';

/**
 * Handle navigation within strategy building mode
 */
export function handleStrategyNavigation(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  const { state, highlightedIndex, setHighlightedIndex } = context;
  const { availableExpirations, optionChain, selectedStrategyType, builderStep, selectedLongCall, selectedLegs, leg1OptionChain, leg2OptionChain } = state;

  if (!selectedStrategyType) {
    return { handled: false };
  }

  // Navigation keys - allow scrolling through all available options
  if (key.upArrow || input === 'k') {
    setHighlightedIndex((prev) => Math.max(0, prev - 1));
    return { handled: true };
  }

  if (key.downArrow || input === 'j') {
    // For expiration selection, use availableExpirations instead of options
    let maxIndex: number;
    if (builderStep === 'expiration1' || builderStep === 'expiration2') {
      maxIndex = availableExpirations.length - 1;
    } else {
      // Get available options based on strategy type and step
      const availableOptions = getAvailableOptionsForStep(
        selectedStrategyType,
        builderStep,
        optionChain?.calls || [],
        optionChain?.puts || [],
        selectedLongCall,
        selectedLegs,
        leg1OptionChain,
        leg2OptionChain
      );
      maxIndex = availableOptions.length - 1; // Allow scrolling through all options

      // Debug logging for Iron Condor filtering issues
      if (selectedStrategyType === 'iron_condor' && (builderStep === 'leg2' || builderStep === 'leg4')) {
        const totalCalls = optionChain?.calls.length || 0;
        const totalPuts = optionChain?.puts.length || 0;
        const optionType = builderStep === 'leg2' ? 'puts' : 'calls';
        const totalOptions = builderStep === 'leg2' ? totalPuts : totalCalls;
        logger.debug(`Iron Condor ${builderStep}: ${availableOptions.length} options available (${totalOptions} total ${optionType}), maxIndex=${maxIndex}, currentIndex=${highlightedIndex}`);
        if (availableOptions.length > 0) {
          logger.debug(`First strike: ${availableOptions[0]?.strikePrice}, Last strike: ${availableOptions[availableOptions.length - 1]?.strikePrice}`);
        }
        // Show what was selected in previous legs
        if (builderStep === 'leg2' && selectedLegs[0]) {
          logger.debug(`Leg 1 (buy put) was: ${selectedLegs[0].strikePrice}, filtering for puts > ${selectedLegs[0].strikePrice}`);
        }
        if (builderStep === 'leg4' && selectedLegs[2]) {
          logger.debug(`Leg 3 (short call) was: ${selectedLegs[2].strikePrice}, filtering for calls > ${selectedLegs[2].strikePrice}`);
          // Also show what the total call range is
          if (optionChain?.calls && optionChain.calls.length > 0) {
            const allCallStrikes = optionChain.calls.map(c => c.strikePrice).sort((a, b) => a - b);
            logger.debug(`All available call strikes range: ${allCallStrikes[0]} to ${allCallStrikes[allCallStrikes.length - 1]}`);
          }
        }
      }
    }

    setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
    return { handled: true };
  }

  // Jump to specific leg with number keys (1-4) - only for multi-leg strategies
  if (input && ['1', '2', '3', '4'].includes(input)) {
    return handleLegJump(input, context);
  }

  return { handled: false };
}

/**
 * Handle jumping to a specific leg using number keys
 */
function handleLegJump(input: string, context: HandlerContext): HandlerResult {
  const { state, dispatch, setHighlightedIndex } = context;
  const { selectedStrategyType, optionChain, displayLimit, leg1OptionChain, leg2OptionChain } = state;

  if (!selectedStrategyType) {
    return { handled: false };
  }

  const legNum = parseInt(input);
  const legName = `leg${legNum}` as 'leg1' | 'leg2' | 'leg3' | 'leg4';
  const totalLegs = getLegCountForStrategy(selectedStrategyType);

  // Only allow jumping to valid legs for this strategy
  if (legNum <= totalLegs) {
    // For diagonal spreads, prevent jumping to legs before expiration is selected
    if (selectedStrategyType === 'diagonal_call_spread') {
      if (legName === 'leg1' && !leg1OptionChain) {
        dispatch({ type: 'SET_STATUS', payload: { message: 'Please select expiration for leg 1 first', type: 'warning' } });
        return { handled: true };
      }
      if (legName === 'leg2' && !leg2OptionChain) {
        dispatch({ type: 'SET_STATUS', payload: { message: 'Please select expiration for leg 2 first', type: 'warning' } });
        return { handled: true };
      }
    }

    dispatch({ type: 'SET_BUILDER_STEP', payload: legName });

    // Center on ATM if this leg shows all options
    if (shouldCenterOnATM(selectedStrategyType, legName) && optionChain) {
      const { getATMIndex } = require('../components/OptionChain.js');
      const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
      setHighlightedIndex(atmIndex);
    } else {
      setHighlightedIndex(0);
    }

    dispatch({ type: 'SET_STATUS', payload: { message: `Jumped to leg ${legNum}`, type: 'info' } });
    return { handled: true };
  }

  return { handled: false };
}
