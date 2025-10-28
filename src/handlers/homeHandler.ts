// AIDEV-NOTE: Home screen handler (Refactored from App.tsx)

import type { InputHandler, KeyPress, HandlerContext } from './types.js';
import { logger } from '../utils/logger.js';

/**
 * Handle home screen input
 *
 * Keys:
 * - s: Enter symbol (switch to input mode)
 * - c: Open settings screen
 * - q: Quit application
 */
export const handleHomeScreen: InputHandler = (
  input: string,
  _key: KeyPress,
  context: HandlerContext
) => {
  const { state, dispatch, exit } = context;

  // Only handle if we're on the home screen
  if (state.currentScreen !== 'home') {
    return { handled: false };
  }

  // Enter symbol
  if (input === 's') {
    dispatch({ type: 'SET_MODE', payload: 'input' });
    dispatch({ type: 'SET_STATUS', payload: { message: 'Enter stock symbol', type: 'info' } });
    return { handled: true };
  }

  // Settings
  if (input === 'c') {
    dispatch({ type: 'SET_SCREEN', payload: 'settings' });
    return { handled: true };
  }

  // Quit
  if (input === 'q') {
    logger.info('👋 Exiting application...');
    exit();
    return { handled: true };
  }

  return { handled: false };
};
