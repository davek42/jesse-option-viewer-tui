// AIDEV-NOTE: Saved Strategies screen handler (Refactored from App.tsx)

import type { InputHandler, KeyPress, HandlerContext } from './types.js';

/**
 * Handle saved strategies screen input
 *
 * Keys:
 * - ↑/k: Move selection up
 * - ↓/j: Move selection down
 * - x: Delete selected strategy
 * - q: Go back to previous screen
 */
export const handleSavedStrategiesScreen: InputHandler = (
  input: string,
  key: KeyPress,
  context: HandlerContext
) => {
  const { state, dispatch, highlightedIndex, setHighlightedIndex } = context;

  // Only handle if we're on the saved strategies screen
  if (state.currentScreen !== 'savedStrategies') {
    return { handled: false };
  }

  // Navigate up
  if (key.upArrow || input === 'k') {
    setHighlightedIndex((prev) => Math.max(0, prev - 1));
    return { handled: true };
  }

  // Navigate down
  if (key.downArrow || input === 'j') {
    const maxIndex = state.savedStrategies.length - 1;
    setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
    return { handled: true };
  }

  // Delete strategy
  if (input === 'x') {
    const strategy = state.savedStrategies[highlightedIndex];
    if (strategy) {
      dispatch({ type: 'REMOVE_STRATEGY', payload: strategy.id });
      dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy removed', type: 'success' } });

      // Adjust highlighted index if needed
      if (highlightedIndex >= state.savedStrategies.length - 1) {
        setHighlightedIndex(Math.max(0, state.savedStrategies.length - 2));
      }
    }
    return { handled: true };
  }

  // Go back
  if (input === 'q') {
    // Clear screen before going back
    process.stdout.write('\x1Bc');
    dispatch({ type: 'GO_BACK' });
    setHighlightedIndex(0);
    return { handled: true };
  }

  return { handled: false };
};
