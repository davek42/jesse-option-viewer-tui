// AIDEV-NOTE: Option Chain View screen handler (Refactored from App.tsx)

import type { InputHandler, KeyPress, HandlerContext } from './types.js';
import { getATMIndex } from '../components/OptionChain.js';

/**
 * Handle option chain view screen input
 *
 * Keys:
 * - ↑/k: Move selection up
 * - ↓/j: Move selection down
 * - a: Jump to ATM strike
 * - Ctrl+↑: Jump to top
 * - Ctrl+↓: Jump to bottom
 * - l: Cycle display limit (10 / 40 / ALL)
 * - g: Toggle Greeks display
 * - q: Go back to previous screen
 */
export const handleOptionChainView: InputHandler = (
  input: string,
  key: KeyPress,
  context: HandlerContext
) => {
  const { state, dispatch, setHighlightedIndex, showGreeks, setShowGreeks } = context;

  // Only handle if we're on the option chain view screen
  if (state.currentScreen !== 'optionChainView') {
    return { handled: false };
  }

  // Calculate total strikes for boundary checking (use calls.length as proxy)
  const totalStrikes = state.optionChain && state.optionChain.calls.length > 0
    ? state.optionChain.calls.length
    : 0;

  // Jump to top (check BEFORE regular up arrow)
  if (key.ctrl && key.upArrow) {
    setHighlightedIndex(0);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to top', type: 'info' } });
    return { handled: true };
  }

  // Jump to bottom (check BEFORE regular down arrow)
  if (key.ctrl && key.downArrow) {
    if (state.optionChain) {
      const displayStrikes = state.optionChain.calls.length > 0 ? state.optionChain.calls.length : 40;
      setHighlightedIndex(displayStrikes - 1);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to bottom', type: 'info' } });
    }
    return { handled: true };
  }

  // Navigate up (AFTER ctrl+up check)
  if (key.upArrow || input === 'k') {
    setHighlightedIndex((prev) => Math.max(0, prev - 1));
    return { handled: true };
  }

  // Navigate down (AFTER ctrl+down check)
  if (key.downArrow || input === 'j') {
    setHighlightedIndex((prev) => Math.min(totalStrikes - 1, prev + 1));
    return { handled: true };
  }

  // Jump to ATM
  if (input === 'a') {
    if (state.optionChain) {
      const atmIndex = getATMIndex(
        state.optionChain.calls,
        state.optionChain.puts,
        state.optionChain.underlyingPrice,
        state.displayLimit
      );
      setHighlightedIndex(atmIndex);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to ATM strike', type: 'success' } });
    }
    return { handled: true };
  }

  // Cycle display limit
  if (input === 'l') {
    const limits = [10, 40, -1]; // -1 means ALL
    const currentIndex = limits.indexOf(state.displayLimit);
    const nextIndex = (currentIndex + 1) % limits.length;
    const newLimit = limits[nextIndex]!;
    dispatch({ type: 'SET_DISPLAY_LIMIT', payload: newLimit });
    dispatch({
      type: 'SET_STATUS',
      payload: { message: `Display limit: ${newLimit === -1 ? 'ALL' : newLimit}`, type: 'success' },
    });
    return { handled: true };
  }

  // Toggle Greeks
  if (input === 'g') {
    setShowGreeks((prev) => !prev);
    dispatch({
      type: 'SET_STATUS',
      payload: { message: `Greeks ${showGreeks ? 'hidden' : 'visible'}`, type: 'info' },
    });
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
