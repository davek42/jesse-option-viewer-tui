// AIDEV-NOTE: Help screen handler (Refactored from App.tsx)

import type { InputHandler, KeyPress, HandlerContext } from './types.js';

/**
 * Handle help screen input
 *
 * Keys:
 * - q: Go back to previous screen
 */
export const handleHelpScreen: InputHandler = (
  input: string,
  _key: KeyPress,
  context: HandlerContext
) => {
  const { state, dispatch } = context;

  // Only handle if we're on the help screen
  if (state.currentScreen !== 'help') {
    return { handled: false };
  }

  // Go back
  if (input === 'q') {
    dispatch({ type: 'GO_BACK' });
    return { handled: true };
  }

  return { handled: false };
};
