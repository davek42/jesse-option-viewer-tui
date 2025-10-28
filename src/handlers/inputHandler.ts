// AIDEV-NOTE: Input mode handler - processes text entry (Refactored from App.tsx)

import type { InputHandler, KeyPress, HandlerContext } from './types.js';

/**
 * Extended context for input handler with symbol entry callback
 */
export interface InputHandlerContext extends HandlerContext {
  /** Callback to handle symbol entry (async operation in App.tsx) */
  onSymbolEntry?: (symbol: string) => void | Promise<void>;
}

/**
 * Handle input mode (text entry for stock symbol)
 *
 * Keys:
 * - Escape: Cancel input
 * - Enter: Submit symbol
 * - Backspace/Delete: Delete last character
 * - Regular chars: Append to input buffer
 */
export const handleInputMode: InputHandler = (
  input: string,
  key: KeyPress,
  context: InputHandlerContext
) => {
  const { state, dispatch } = context;

  // Only handle if we're in input mode
  if (state.mode !== 'input') {
    return { handled: false };
  }

  // Escape: Cancel input
  if (key.escape) {
    dispatch({ type: 'CLEAR_INPUT' });
    dispatch({ type: 'SET_MODE', payload: 'navigation' });
    dispatch({ type: 'SET_STATUS', payload: { message: 'Cancelled', type: 'info' } });
    return { handled: true };
  }

  // Enter: Submit symbol
  if (key.return) {
    const symbol = state.inputBuffer.trim().toUpperCase();
    if (symbol && context.onSymbolEntry) {
      context.onSymbolEntry(symbol);
    }
    dispatch({ type: 'CLEAR_INPUT' });
    dispatch({ type: 'SET_MODE', payload: 'navigation' });
    return { handled: true };
  }

  // Backspace/Delete: Delete last character
  if (key.backspace || key.delete) {
    dispatch({ type: 'DELETE_LAST_CHAR' });
    return { handled: true };
  }

  // Regular character: Append to input buffer
  if (input && !key.ctrl && !key.meta) {
    dispatch({ type: 'APPEND_INPUT', payload: input });
    return { handled: true };
  }

  return { handled: true };
};
