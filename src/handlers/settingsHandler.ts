// AIDEV-NOTE: Settings screen handler (Refactored from App.tsx)

import type { InputHandler, KeyPress, HandlerContext } from './types.js';

/**
 * Handle settings screen input
 *
 * Keys:
 * - q: Go back to previous screen
 * - m/M: Toggle trading mode (paper <-> live)
 */
export const handleSettingsScreen: InputHandler = (
  input: string,
  _key: KeyPress,
  context: HandlerContext
) => {
  const { state, dispatch } = context;

  // Only handle if we're on the settings screen
  if (state.currentScreen !== 'settings') {
    return { handled: false };
  }

  // Go back
  if (input === 'q') {
    dispatch({ type: 'GO_BACK' });
    return { handled: true };
  }

  // Switch mode
  if (input === 'm' || input === 'M') {
    const targetMode = state.tradingMode === 'paper' ? 'live' : 'paper';

    // Check if switching to live but credentials not configured
    if (targetMode === 'live' && !state.liveCredentialsConfigured) {
      dispatch({
        type: 'SET_STATUS',
        payload: {
          message: 'Live credentials not configured. Check .env.local file.',
          type: 'error',
        },
      });
    } else {
      // Request mode switch (triggers confirmation dialog)
      dispatch({ type: 'REQUEST_MODE_SWITCH', payload: targetMode });
    }
    return { handled: true };
  }

  return { handled: false };
};
