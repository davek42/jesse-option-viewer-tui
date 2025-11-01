// AIDEV-NOTE: Strategy building helper functions
// Extracted from App.tsx to reduce file size and improve maintainability

import React from 'react';
import type { StrategyType, OptionContract, OptionStrategy, AppAction } from '../types/index.js';
import { getATMIndex } from '../components/OptionChain.js';
import { getAlpacaClient } from '../lib/alpaca.js';
import { logger } from '../utils/logger.js';
import {
  createBullCallSpread,
  createBearPutSpread,
  createBullPutSpread,
  createBearCallSpread,
  createLongStraddle,
  createIronCondor,
  createCoveredCall,
  createDiagonalCallSpread
} from '../utils/strategies.js';

/**
 * Check if a step shows all (unfiltered) options - should center on ATM
 */
export function shouldCenterOnATM(strategyType: StrategyType, step: string): boolean {
  switch (strategyType) {
    case 'bull_call_spread':
      return step === 'long'; // leg1 shows all calls
    case 'diagonal_call_spread':
      return step === 'leg1'; // leg1 shows all calls
    case 'bear_put_spread':
      return step === 'leg1'; // leg1 shows all puts
    case 'bull_put_spread':
      return step === 'leg1'; // leg1 shows all puts (buy lower strike)
    case 'bear_call_spread':
      return step === 'leg1'; // leg1 shows all calls (buy higher strike)
    case 'long_straddle':
      return step === 'leg1'; // leg1 shows all calls
    case 'iron_condor':
      return step === 'leg1' || step === 'leg3'; // leg1 shows all puts, leg3 shows all calls
    case 'covered_call':
      return true; // shows all calls
    default:
      return false;
  }
}

/**
 * Get the previous step when undoing a leg selection
 */
export function getPreviousStep(
  strategyType: StrategyType,
  currentStep: string,
  selectedLegsCount: number
): string | null {
  // If no legs selected yet, can't go back
  if (selectedLegsCount === 0) {
    return null;
  }

  // For bull_call_spread (uses 'long'/'short' instead of leg1/leg2)
  if (strategyType === 'bull_call_spread') {
    if (currentStep === 'short') return 'long';
    return null; // Can't go back from 'long'
  }

  // For other strategies using leg1, leg2, leg3, leg4
  const legMatch = currentStep.match(/leg(\d+)/);
  if (legMatch && legMatch[1]) {
    const currentLegNum = parseInt(legMatch[1], 10);
    if (currentLegNum > 1) {
      return `leg${currentLegNum - 1}`;
    }
  }

  return null; // Can't go back from leg1
}

/**
 * Get available options for the current step based on strategy type
 *
 * For diagonal spreads, this function needs access to state to get leg-specific option chains
 */
export function getAvailableOptionsForStep(
  strategyType: StrategyType,
  step: string,
  calls: OptionContract[],
  puts: OptionContract[],
  selectedLongCall: OptionContract | null,
  selectedLegs: OptionContract[],
  leg1OptionChain?: { calls: OptionContract[]; puts: OptionContract[] } | null,
  leg2OptionChain?: { calls: OptionContract[]; puts: OptionContract[] } | null
): OptionContract[] {
  switch (strategyType) {
    case 'bull_call_spread':
      // Step 1 (long): All calls | Step 2 (short): Higher strike calls
      return step === 'long'
        ? calls
        : calls.filter(c => selectedLongCall ? c.strikePrice > selectedLongCall.strikePrice : true);

    case 'diagonal_call_spread':
      // Use leg-specific option chains for diagonal spreads
      if (step === 'leg1') {
        // Leg 1: Use leg1OptionChain (longer expiration)
        return leg1OptionChain?.calls || [];
      } else if (step === 'leg2') {
        // Leg 2: Use leg2OptionChain (shorter expiration), filter for higher strikes
        const leg2Calls = leg2OptionChain?.calls || [];
        const leg1 = selectedLegs[0];
        return leg1
          ? leg2Calls.filter((c: OptionContract) => c.strikePrice > leg1.strikePrice)
          : leg2Calls;
      }
      return [];

    case 'bear_put_spread':
      // Step 1 (leg1): All puts | Step 2 (leg2): Lower strike puts
      return step === 'leg1'
        ? puts
        : puts.filter(p => selectedLegs[0] ? p.strikePrice < selectedLegs[0].strikePrice : true);

    case 'bull_put_spread':
      // Credit spread: Step 1 (leg1): All puts (buy lower) | Step 2 (leg2): Higher strike puts (sell)
      return step === 'leg1'
        ? puts
        : puts.filter(p => selectedLegs[0] ? p.strikePrice > selectedLegs[0].strikePrice : true);

    case 'bear_call_spread':
      // Credit spread: Step 1 (leg1): All calls (buy higher) | Step 2 (leg2): Lower strike calls (sell)
      return step === 'leg1'
        ? calls
        : calls.filter(c => selectedLegs[0] ? c.strikePrice < selectedLegs[0].strikePrice : true);

    case 'long_straddle':
      // Step 1 (leg1): All calls | Step 2 (leg2): Puts with same strike as selected call
      if (step === 'leg1') {
        return calls;
      } else {
        const selectedCall = selectedLegs.find(leg => leg.optionType === 'call');
        return selectedCall
          ? puts.filter(p => p.strikePrice === selectedCall.strikePrice)
          : puts;
      }

    case 'iron_condor':
      // 4 legs: Buy low put, Sell higher put, Sell lower call, Buy high call
      // Note: Puts and calls are on opposite sides of stock price, so we can't compare put strikes to call strikes
      if (step === 'leg1') return puts; // Buy OTM put (lowest)
      if (step === 'leg2') {
        // Sell put: must be higher strike than leg 1 (the long put)
        return puts.filter(p => selectedLegs[0] ? p.strikePrice > selectedLegs[0].strikePrice : true);
      }
      if (step === 'leg3') {
        // Sell call: just show all calls (user will choose OTM call above stock price)
        // Can't compare to put strikes from legs 1-2
        return calls;
      }
      if (step === 'leg4') {
        // Buy call: must be higher strike than leg 3 (the short call)
        const shortCall = selectedLegs[2];
        return shortCall ? calls.filter(c => c.strikePrice > shortCall.strikePrice) : calls;
      }
      return [];

    case 'covered_call':
      // Just need to select one OTM call
      return calls;

    default:
      return calls;
  }
}

/**
 * Check if strategy is complete and ready to save
 */
export function isStrategyComplete(
  strategyType: StrategyType,
  selectedLongCall: OptionContract | null,
  selectedShortCall: OptionContract | null,
  selectedLegs: OptionContract[]
): boolean {
  switch (strategyType) {
    case 'bull_call_spread':
      return selectedLongCall !== null && selectedShortCall !== null;

    case 'diagonal_call_spread':
      return selectedLegs.length === 2;

    case 'bear_put_spread':
      return selectedLegs.length === 2;

    case 'bull_put_spread':
      return selectedLegs.length === 2;

    case 'bear_call_spread':
      return selectedLegs.length === 2;

    case 'long_straddle':
      return selectedLegs.length === 2;

    case 'iron_condor':
      return selectedLegs.length === 4;

    case 'covered_call':
      return selectedLegs.length === 1 || selectedLongCall !== null;

    default:
      return false;
  }
}

/**
 * Create strategy using the appropriate create function
 */
export function createStrategyByType(
  strategyType: StrategyType,
  symbol: string,
  selectedLongCall: OptionContract | null,
  selectedShortCall: OptionContract | null,
  selectedLegs: OptionContract[],
  stockPrice: number
): OptionStrategy | null {
  switch (strategyType) {
    case 'bull_call_spread':
      return selectedLongCall && selectedShortCall
        ? createBullCallSpread(symbol, selectedLongCall, selectedShortCall, 1)
        : null;

    case 'diagonal_call_spread': {
      const [longCall, shortCall] = selectedLegs;
      return longCall && shortCall
        ? createDiagonalCallSpread(symbol, longCall, shortCall, 1)
        : null;
    }

    case 'bear_put_spread': {
      const [longPut, shortPut] = selectedLegs;
      return longPut && shortPut
        ? createBearPutSpread(symbol, longPut, shortPut, 1)
        : null;
    }

    case 'bull_put_spread': {
      const [longPut, shortPut] = selectedLegs;
      return longPut && shortPut
        ? createBullPutSpread(symbol, longPut, shortPut, 1)
        : null;
    }

    case 'bear_call_spread': {
      const [longCall, shortCall] = selectedLegs;
      return longCall && shortCall
        ? createBearCallSpread(symbol, longCall, shortCall, 1)
        : null;
    }

    case 'long_straddle': {
      const call = selectedLegs.find(leg => leg.optionType === 'call');
      const put = selectedLegs.find(leg => leg.optionType === 'put');
      return call && put
        ? createLongStraddle(symbol, call, put, 1)
        : null;
    }

    case 'iron_condor': {
      const [leg1, leg2, leg3, leg4] = selectedLegs;
      // AIDEV-NOTE: selectedLegs order: [longPut, shortPut, shortCall, longCall]
      // createIronCondor expects: (symbol, longCall, shortCall, shortPut, longPut, quantity)
      return leg1 && leg2 && leg3 && leg4
        ? createIronCondor(symbol, leg4, leg3, leg2, leg1, 1)  // Reorder parameters
        : null;
    }

    case 'covered_call': {
      const call = selectedLegs[0] || selectedLongCall;
      return call
        ? createCoveredCall(symbol, call, stockPrice, 1)
        : null;
    }

    default:
      return null;
  }
}

/**
 * Get initial instruction message when strategy builder opens
 */
export function getInitialStrategyMessage(strategyType: StrategyType): string {
  switch (strategyType) {
    case 'bull_call_spread':
      return 'Select LONG CALL (Buy) - Choose ATM or slightly OTM strike';

    case 'diagonal_call_spread':
      return 'Step 1: Select LONGER expiration for leg 1 (long call)';

    case 'bear_put_spread':
      return 'Select LONG PUT (Buy) - Choose higher strike put';

    case 'bull_put_spread':
      return 'Select LONG PUT (Buy) - Choose lower strike put for protection';

    case 'bear_call_spread':
      return 'Select LONG CALL (Buy) - Choose higher strike call for protection';

    case 'long_straddle':
      return 'Select ATM CALL (Buy) - Choose at-the-money strike';

    case 'iron_condor':
      return 'Select leg 1: BUY OTM PUT (lowest strike) - Start with furthest OTM put';

    case 'covered_call':
      return 'Select OTM CALL (Sell) - Assumes you own 100 shares. Choose higher strike to cap gains';

    default:
      return 'Select first option for this strategy';
  }
}

/**
 * Get strategy-specific status message for leg selection
 */
export function getSelectionStatusMessage(
  strategyType: StrategyType,
  legNumber: number,
  strikePrice: number,
  isComplete: boolean
): string {
  const strike = `$${strikePrice.toFixed(2)}`;

  if (isComplete) {
    return 'All legs selected. Press Enter to SAVE strategy';
  }

  switch (strategyType) {
    case 'bear_put_spread':
      if (legNumber === 1) {
        return `✓ LONG PUT (Buy) at ${strike} selected. Now select SHORT PUT (Sell - lower strike)`;
      }
      return `✓ SHORT PUT (Sell) at ${strike} selected. Press Enter to SAVE strategy`;

    case 'bull_put_spread':
      if (legNumber === 1) {
        return `✓ LONG PUT (Buy) at ${strike} selected. Now select SHORT PUT (Sell - higher strike for credit)`;
      }
      return `✓ SHORT PUT (Sell) at ${strike} selected. Press Enter to SAVE strategy`;

    case 'bear_call_spread':
      if (legNumber === 1) {
        return `✓ LONG CALL (Buy) at ${strike} selected. Now select SHORT CALL (Sell - lower strike for credit)`;
      }
      return `✓ SHORT CALL (Sell) at ${strike} selected. Press Enter to SAVE strategy`;

    case 'long_straddle':
      if (legNumber === 1) {
        return `✓ ATM CALL at ${strike} selected. Now select ATM PUT (same strike: ${strike})`;
      }
      return `✓ ATM PUT at ${strike} selected. Press Enter to SAVE strategy`;

    case 'iron_condor':
      if (legNumber === 1) {
        return `✓ BUY OTM PUT (lowest) at ${strike}. Select leg 2: SELL PUT (higher strike than ${strike})`;
      } else if (legNumber === 2) {
        return `✓ SELL PUT at ${strike}. Select leg 3: SELL CALL (choose OTM call above stock price)`;
      } else if (legNumber === 3) {
        return `✓ SELL CALL at ${strike}. Select leg 4: BUY OTM CALL (higher strike than ${strike})`;
      }
      return `✓ BUY OTM CALL at ${strike} selected. Press Enter to SAVE strategy`;

    case 'covered_call':
      return `✓ OTM CALL at ${strike} selected. Press Enter to SAVE (assumes you own 100 shares)`;

    default:
      return `Leg ${legNumber} selected. Select leg ${legNumber + 1}`;
  }
}

/**
 * Handle option selection and update state accordingly
 */
export function handleOptionSelection(
  strategyType: StrategyType,
  step: string,
  selectedOption: OptionContract,
  dispatch: React.Dispatch<AppAction>,
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void,
  optionChain?: { calls: OptionContract[]; puts: OptionContract[]; underlyingPrice: number } | null,
  displayLimit?: number
): void {
  // Defensive validation - ensure selectedOption is a valid OptionContract
  if (!selectedOption || typeof selectedOption.strikePrice !== 'number') {
    logger.error(`❌ Invalid OptionContract in handleOptionSelection: ${JSON.stringify(selectedOption)}`);
    logger.error(`   strategyType=${strategyType}, step=${step}`);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Error: Invalid option contract', type: 'error' } });
    return;
  }

  // Bull Call Spread uses legacy longCall/shortCall state
  if (strategyType === 'bull_call_spread') {
    if (step === 'long') {
      dispatch({ type: 'SET_LONG_CALL', payload: selectedOption });
      dispatch({ type: 'SET_BUILDER_STEP', payload: 'short' });
      setHighlightedIndex(0);
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ LONG CALL (Buy) at $${selectedOption.strikePrice.toFixed(2)} selected. Now select SHORT CALL (Sell - higher strike)`, type: 'success' } });
    } else if (step === 'short') {
      dispatch({ type: 'SET_SHORT_CALL', payload: selectedOption });
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ SHORT CALL (Sell) at $${selectedOption.strikePrice.toFixed(2)} selected. Press Enter to SAVE strategy`, type: 'success' } });
    }
    return;
  }

  // All other strategies use selectedLegs array
  dispatch({ type: 'ADD_LEG', payload: selectedOption });

  // Special handling for diagonal spreads
  if (strategyType === 'diagonal_call_spread') {
    if (step === 'leg1') {
      // After selecting leg 1, go to expiration selection for leg 2
      dispatch({ type: 'SET_BUILDER_STEP', payload: 'expiration2' });
      setHighlightedIndex(0);
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 1 (Long Call) at $${selectedOption.strikePrice.toFixed(2)} selected. Now select SHORTER expiration for leg 2`, type: 'success' } });
      return;
    } else if (step === 'leg2') {
      // Leg 2 selected, strategy is complete
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 2 (Short Call) at $${selectedOption.strikePrice.toFixed(2)} selected. Press Enter to SAVE strategy`, type: 'success' } });
      return;
    }
  }

  // Determine next step
  const legNumber = parseInt(step.replace('leg', ''));
  const totalLegs = getLegCountForStrategy(strategyType);
  const isComplete = legNumber >= totalLegs;

  if (!isComplete) {
    const nextStep = `leg${legNumber + 1}` as 'leg1' | 'leg2' | 'leg3' | 'leg4';
    dispatch({ type: 'SET_BUILDER_STEP', payload: nextStep });

    // Center on ATM if next leg shows all options
    if (shouldCenterOnATM(strategyType, nextStep) && optionChain && displayLimit !== undefined) {
      const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
      setHighlightedIndex(atmIndex);
    } else {
      setHighlightedIndex(0);
    }
  }

  // Set strategy-specific status message
  const message = getSelectionStatusMessage(strategyType, legNumber, selectedOption.strikePrice, isComplete);
  dispatch({ type: 'SET_STATUS', payload: { message, type: 'success' } });
}

/**
 * Handle expiration selection for diagonal spreads
 * Loads option chain for the selected expiration and transitions to next step
 */
export async function handleExpirationSelectionForDiagonal(
  selectedExpiration: string,
  currentStep: 'expiration1' | 'expiration2',
  currentSymbol: string,
  dispatch: React.Dispatch<AppAction>,
  setHighlightedIndex: (index: number) => void
): Promise<void> {

  try {
    dispatch({ type: 'SET_LOADING', payload: true });

    // Fetch option chain for the selected expiration
    const client = getAlpacaClient();
    const chain = await client.getOptionChain(currentSymbol, selectedExpiration);

    if (chain) {
      if (currentStep === 'expiration1') {
        // Save leg 1 expiration and option chain
        dispatch({ type: 'SET_LEG1_EXPIRATION', payload: selectedExpiration });
        dispatch({ type: 'SET_LEG1_OPTION_CHAIN', payload: chain });
        dispatch({ type: 'SET_BUILDER_STEP', payload: 'leg1' });
        dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 1 expiration: ${selectedExpiration}. Select LONG CALL (lower strike)`, type: 'success' } });
        logger.info(`📅 Leg 1 expiration selected: ${selectedExpiration}`);
      } else {
        // Save leg 2 expiration and option chain
        dispatch({ type: 'SET_LEG2_EXPIRATION', payload: selectedExpiration });
        dispatch({ type: 'SET_LEG2_OPTION_CHAIN', payload: chain });
        dispatch({ type: 'SET_BUILDER_STEP', payload: 'leg2' });
        dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 2 expiration: ${selectedExpiration}. Select SHORT CALL (higher strike)`, type: 'success' } });
        logger.info(`📅 Leg 2 expiration selected: ${selectedExpiration}`);
      }

      setHighlightedIndex(0);
    } else {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Failed to load option chain', type: 'error' } });
    }
  } catch (error) {
    logger.error('Error loading option chain for diagonal spread:', error);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Error loading option chain', type: 'error' } });
  } finally {
    dispatch({ type: 'SET_LOADING', payload: false });
  }
}

/**
 * Get total number of legs for a strategy type
 */
export function getLegCountForStrategy(strategyType: StrategyType): number {
  switch (strategyType) {
    case 'bull_call_spread':
    case 'diagonal_call_spread':
    case 'bear_put_spread':
    case 'bull_put_spread':
    case 'bear_call_spread':
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
