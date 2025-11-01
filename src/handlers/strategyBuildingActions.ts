// AIDEV-NOTE: Handle actions within strategy builder (select, undo, cancel, save)
// Extracted from App.tsx strategy building section

import type { HandlerContext, HandlerResult } from './types.js';
import {
  getAvailableOptionsForStep,
  isStrategyComplete,
  createStrategyByType,
  getPreviousStep,
  handleOptionSelection,
  handleExpirationSelectionForDiagonal
} from './strategyHelpers.js';
import { logger } from '../utils/logger.js';

/**
 * Handle actions within strategy building mode
 */
export function handleStrategyActions(
  input: string,
  key: any,
  context: HandlerContext
): HandlerResult {
  const { state } = context;

  if (!state.selectedStrategyType) {
    return { handled: false };
  }

  // Undo last leg selection with 'x' or 'd'
  if (input === 'x' || input === 'd') {
    return handleUndoLeg(context);
  }

  // Select option or save strategy
  if (key.return) {
    return handleEnterKey(context);
  }

  // Cancel builder
  if (key.escape || input === 'q') {
    return handleCancelBuilder(context);
  }

  return { handled: false };
}

/**
 * Handle undo last leg selection
 */
function handleUndoLeg(context: HandlerContext): HandlerResult {
  const { state, dispatch, setHighlightedIndex } = context;
  const { selectedStrategyType, builderStep, selectedLegs } = state;

  if (!selectedStrategyType) {
    return { handled: false };
  }

  const previousStep = getPreviousStep(selectedStrategyType, builderStep, selectedLegs.length);

  if (previousStep) {
    // Remove the last leg
    dispatch({ type: 'REMOVE_LAST_LEG' });

    // Also clear longCall/shortCall if using bull_call_spread
    if (selectedStrategyType === 'bull_call_spread' && builderStep === 'short') {
      dispatch({ type: 'SET_SHORT_CALL', payload: null });
    }

    // Go back to previous step
    dispatch({ type: 'SET_BUILDER_STEP', payload: previousStep as 'long' | 'short' | 'leg1' | 'leg2' | 'leg3' | 'leg4' | 'expiration1' | 'expiration2' });
    setHighlightedIndex(0);
    dispatch({ type: 'SET_STATUS', payload: { message: `Undid leg selection, back to ${previousStep}`, type: 'info' } });
    logger.info(`🔙 Undid leg selection, back to ${previousStep}`);
    return { handled: true };
  } else {
    dispatch({ type: 'SET_STATUS', payload: { message: 'No leg to undo', type: 'warning' } });
    return { handled: true };
  }
}

/**
 * Handle Enter key - Select option or save strategy
 */
function handleEnterKey(context: HandlerContext): HandlerResult {
  const { state, dispatch, highlightedIndex, setHighlightedIndex } = context;
  const {
    selectedStrategyType,
    builderStep,
    availableExpirations,
    currentSymbol,
    selectedLongCall,
    selectedShortCall,
    selectedLegs
  } = state;

  if (!selectedStrategyType) {
    return { handled: false };
  }

  // Handle expiration selection for diagonal spreads
  if (builderStep === 'expiration1' || builderStep === 'expiration2') {
    const selectedExpiration = availableExpirations[highlightedIndex];
    logger.debug(`📅 Expiration selection: step=${builderStep}, selectedExpiration=${selectedExpiration}, highlightedIndex=${highlightedIndex}`);
    if (selectedExpiration && currentSymbol) {
      // Load option chain for the selected expiration
      handleExpirationSelectionForDiagonal(selectedExpiration, builderStep, currentSymbol, dispatch, setHighlightedIndex);
    } else {
      logger.warning(`❌ Cannot select expiration: selectedExpiration=${selectedExpiration}, currentSymbol=${currentSymbol}`);
    }
    return { handled: true };
  }

  // Check if strategy is complete and ready to save
  const isComplete = isStrategyComplete(selectedStrategyType, selectedLongCall, selectedShortCall, selectedLegs);

  if (isComplete && currentSymbol) {
    return handleSaveStrategy(context);
  }

  // Select option for current step
  return handleSelectOption(context);
}

/**
 * Handle saving a completed strategy
 */
function handleSaveStrategy(context: HandlerContext): HandlerResult {
  const { state, dispatch } = context;
  const { selectedStrategyType, currentSymbol, selectedLongCall, selectedShortCall, selectedLegs, stockQuote } = state;

  if (!selectedStrategyType || !currentSymbol) {
    return { handled: false };
  }

  // Save the strategy
  const strategy = createStrategyByType(
    selectedStrategyType,
    currentSymbol,
    selectedLongCall,
    selectedShortCall,
    selectedLegs,
    stockQuote?.price || 0
  );

  if (strategy) {
    // Show confirmation prompt instead of saving directly
    dispatch({ type: 'SHOW_SAVE_CONFIRMATION', payload: strategy });
    dispatch({ type: 'SET_STATUS', payload: { message: 'Review strategy and press Enter to save, or Esc to cancel', type: 'info' } });
    logger.info(`📋 Showing save confirmation for ${strategy.type}`);
  } else {
    dispatch({ type: 'SET_STATUS', payload: { message: 'Invalid strategy configuration', type: 'error' } });
  }

  return { handled: true };
}

/**
 * Handle selecting an option for the current step
 */
function handleSelectOption(context: HandlerContext): HandlerResult {
  const { state, dispatch, highlightedIndex, setHighlightedIndex } = context;
  const { selectedStrategyType, builderStep, optionChain, selectedLongCall, selectedLegs, leg1OptionChain, leg2OptionChain, displayLimit } = state;

  if (!selectedStrategyType) {
    return { handled: false };
  }

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
  const selectedOption = availableOptions[highlightedIndex];

  logger.debug(`🎯 Option selection: step=${builderStep}, highlightedIndex=${highlightedIndex}, availableOptions=${availableOptions.length}, selectedOption=${selectedOption ? 'valid' : 'undefined'}`);

  if (selectedOption) {
    // Validate that selectedOption is an OptionContract
    if (!selectedOption.strikePrice || typeof selectedOption.strikePrice !== 'number') {
      logger.error(`❌ Invalid selectedOption: ${JSON.stringify(selectedOption)}`);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Error: Invalid option selected', type: 'error' } });
      return { handled: true };
    }

    // Handle selection based on strategy type
    handleOptionSelection(
      selectedStrategyType,
      builderStep,
      selectedOption,
      dispatch,
      setHighlightedIndex,
      optionChain,
      displayLimit
    );
  }

  return { handled: true };
}

/**
 * Handle canceling the strategy builder
 */
function handleCancelBuilder(context: HandlerContext): HandlerResult {
  const { dispatch, setHighlightedIndex } = context;

  dispatch({ type: 'DEACTIVATE_STRATEGY_BUILDER' });
  setHighlightedIndex(0);
  dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy builder cancelled', type: 'info' } });

  return { handled: true };
}
