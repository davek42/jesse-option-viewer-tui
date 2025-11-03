// AIDEV-NOTE: Handler for Strategy Builder modal
// Extracted from App.tsx to reduce complexity in Symbol Detail screen

import type { HandlerContext, HandlerResult } from './types.js';
import { logger } from '../utils/logger.js';
import { getATMIndex } from '../components/OptionChain.js';
import { handleStrategyNavigation } from './strategyBuildingNavigation.js';
import { handleStrategyActions } from './strategyBuildingActions.js';

/**
 * Main handler for Strategy Builder modal
 * Delegates to sub-handlers based on current state
 */
export function handleStrategyBuilder(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  const { state } = context;

  // Save Confirmation Mode - Handle confirmation before saving
  if (state.showSaveConfirmation) {
    return handleSaveConfirmation(input, key, context);
  }

  // Strategy Selection Mode (no strategy type selected yet)
  if (!state.selectedStrategyType) {
    return handleStrategySelection(input, key, context);
  }

  // Strategy Building Mode (strategy type is selected)
  return handleStrategyBuilding(input, key, context);
}

/**
 * Handle save confirmation dialog
 */
function handleSaveConfirmation(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  const { dispatch, setHighlightedIndex } = context;

  if (key.return) {
    // Confirm and save strategy
    dispatch({ type: 'CONFIRM_SAVE_STRATEGY' });
    setHighlightedIndex(0);
    dispatch({ type: 'SET_STATUS', payload: { message: `✓ Strategy saved!`, type: 'success' } });
    logger.success(`💼 Strategy confirmed and saved`);
    return { handled: true };
  }

  if (key.escape || input === 'q') {
    // Cancel save
    dispatch({ type: 'HIDE_SAVE_CONFIRMATION' });
    dispatch({ type: 'SET_STATUS', payload: { message: 'Save cancelled', type: 'info' } });
    logger.info(`❌ Save cancelled by user`);
    return { handled: true };
  }

  return { handled: true }; // Don't process other inputs while in confirmation mode
}

/**
 * Handle strategy type selection (before building)
 */
function handleStrategySelection(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  const { dispatch, setHighlightedIndex } = context;

  // Navigate strategy selector
  if (key.upArrow || input === 'k') {
    setHighlightedIndex((prev) => Math.max(0, prev - 1));
    return { handled: true };
  }

  if (key.downArrow || input === 'j') {
    // 8 available strategies (0-7)
    setHighlightedIndex((prev) => Math.min(7, prev + 1));
    return { handled: true };
  }

  // Select strategy type
  if (key.return) {
    return handleStrategyTypeSelection(context);
  }

  // Cancel strategy selection
  if (key.escape || input === 'q') {
    dispatch({ type: 'DEACTIVATE_STRATEGY_BUILDER' });
    setHighlightedIndex(0);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy builder cancelled', type: 'info' } });
    return { handled: true };
  }

  return { handled: true }; // Don't process other inputs in strategy selection mode
}

/**
 * Handle the actual strategy type selection
 */
function handleStrategyTypeSelection(context: HandlerContext): HandlerResult {
  const {
    state,
    dispatch,
    highlightedIndex,
    setHighlightedIndex,
  } = context;

  const { optionChain, displayLimit } = state;

  const strategies = [
    'bull_call_spread',
    'bear_put_spread',
    'bull_put_spread',
    'bear_call_spread',
    'diagonal_call_spread',
    'iron_condor',
    'long_straddle',
    'covered_call',
  ] as const;

  const selectedType = strategies[highlightedIndex];
  if (!selectedType) {
    return { handled: true };
  }

  dispatch({ type: 'SET_STRATEGY_TYPE', payload: selectedType });

  // Set initial highlighted index
  if (selectedType === 'diagonal_call_spread') {
    // For diagonal spreads, start at first expiration
    setHighlightedIndex(0);
  } else {
    // Center on ATM for leg1 if showing all options
    const firstStep = selectedType === 'bull_call_spread' ? 'long' : 'leg1';
    if (shouldCenterOnATM(selectedType, firstStep) && optionChain) {
      const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
      setHighlightedIndex(atmIndex);
    } else {
      setHighlightedIndex(0);
    }
  }

  logger.info(`📋 Selected strategy type: ${selectedType}`);

  // Show initial instruction message
  const initialMessage = getInitialStrategyMessage(selectedType);
  dispatch({ type: 'SET_STATUS', payload: { message: initialMessage, type: 'info' } });

  return { handled: true };
}

/**
 * Handle strategy building (after strategy type is selected)
 * This is where the user navigates and selects options for each leg
 */
function handleStrategyBuilding(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  // Try navigation first
  const navResult = handleStrategyNavigation(input, key, context);
  if (navResult.handled) return navResult;

  // Then try actions (select, undo, cancel, etc.)
  const actionResult = handleStrategyActions(input, key, context);
  if (actionResult.handled) return actionResult;

  return { handled: true }; // Don't process other inputs in builder mode
}

/**
 * Check if a step shows all (unfiltered) options - should center on ATM
 */
function shouldCenterOnATM(strategyType: string, step: string): boolean {
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
 * Get initial instruction message when strategy builder opens
 */
function getInitialStrategyMessage(strategyType: string): string {
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
