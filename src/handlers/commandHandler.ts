// AIDEV-NOTE: Command mode handler - processes slash commands (Refactored from App.tsx)

import type { InputHandler, KeyPress, HandlerContext } from './types.js';
import { logger } from '../utils/logger.js';
import { getATMIndex } from '../components/OptionChain.js';

/**
 * Handle command mode input (slash commands like /help, /atm, etc.)
 *
 * Global Commands (work on every screen):
 * - /exit: Exit the application
 * - /back: Go back to previous screen (same as 'q')
 * - /refresh: Refresh/redraw the current screen
 * - /help, /h, /?: Show help screen
 * - /settings, /config: Show settings screen
 * - /paper: Switch to paper trading mode
 * - /live: Switch to live trading mode
 * - /mode: Toggle between paper and live
 *
 * Option Chain View Commands:
 * - /scroll up, /up: Scroll up 10 strikes
 * - /scroll down, /down: Scroll down 10 strikes
 * - /atm, /a: Jump to ATM strike
 * - /top, /t: Jump to top strike
 * - /bottom, /b: Jump to bottom strike
 */
export const handleCommandMode: InputHandler = (
  input: string,
  key: KeyPress,
  context: HandlerContext
) => {
  const { state, dispatch } = context;

  // Only handle if we're in command mode
  if (state.mode !== 'command') {
    return { handled: false };
  }

  // Escape: Cancel command
  if (key.escape) {
    dispatch({ type: 'CLEAR_INPUT' });
    dispatch({ type: 'SET_MODE', payload: 'navigation' });
    return { handled: true };
  }

  // Backspace/Delete: Delete last character
  if (key.backspace || key.delete) {
    dispatch({ type: 'DELETE_LAST_CHAR' });
    return { handled: true };
  }

  // Enter: Execute command
  if (key.return) {
    const command = state.commandBuffer.toLowerCase().trim();
    logger.debug('Command entered:', command);

    executeCommand(command, context);

    dispatch({ type: 'CLEAR_INPUT' });
    dispatch({ type: 'SET_MODE', payload: 'navigation' });
    return { handled: true };
  }

  // Regular character: Append to command buffer
  if (input && !key.ctrl && !key.meta) {
    dispatch({ type: 'APPEND_INPUT', payload: input });
    return { handled: true };
  }

  return { handled: true };
};

/**
 * Execute a slash command
 */
function executeCommand(command: string, context: HandlerContext): void {
  const { state, dispatch, exit, setHighlightedIndex } = context;
  const { currentScreen, optionChain, displayLimit } = state;

  // Global commands (work on every screen)
  if (command === '/exit') {
    logger.info('👋 Exiting application via /exit command...');
    dispatch({ type: 'SET_STATUS', payload: { message: 'Exiting application...', type: 'info' } });
    exit();
    return;
  }

  if (command === '/back') {
    // Go back to previous screen (same as 'q')
    if (currentScreen === 'home') {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Already on home screen', type: 'info' } });
    } else {
      // Clear screen before going back (same behavior as 'q')
      process.stdout.write('\x1Bc');
      dispatch({ type: 'GO_BACK' });
      setHighlightedIndex(0);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Going back...', type: 'info' } });
      logger.info('📍 Going back to previous screen via /back command');
    }
    return;
  }

  if (command === '/refresh') {
    // Refresh/redraw the current screen (no data reload)
    process.stdout.write('\x1Bc');
    dispatch({ type: 'SET_STATUS', payload: { message: '🔄 Screen refreshed', type: 'success' } });
    logger.info('🔄 Refreshing screen via /refresh command');
    return;
  }

  // Navigation commands (Option Chain View specific)
  if (command === '/scroll up' || command === '/up') {
    if (currentScreen === 'optionChainView' && optionChain) {
      setHighlightedIndex((prev) => Math.max(0, prev - 10));
      dispatch({ type: 'SET_STATUS', payload: { message: 'Scrolled up 10 strikes', type: 'info' } });
    } else {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
    }
    return;
  }

  if (command === '/scroll down' || command === '/down') {
    if (currentScreen === 'optionChainView' && optionChain) {
      setHighlightedIndex((prev) => prev + 10);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Scrolled down 10 strikes', type: 'info' } });
    } else {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
    }
    return;
  }

  if (command === '/atm' || command === '/a') {
    if (currentScreen === 'optionChainView' && optionChain) {
      const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
      setHighlightedIndex(atmIndex);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to ATM strike', type: 'success' } });
    } else {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
    }
    return;
  }

  if (command === '/top' || command === '/t') {
    if (currentScreen === 'optionChainView') {
      setHighlightedIndex(0);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to top', type: 'info' } });
    } else {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
    }
    return;
  }

  if (command === '/bottom' || command === '/b') {
    if (currentScreen === 'optionChainView' && optionChain) {
      const displayStrikes = optionChain.calls.length > 0 ? optionChain.calls.length : 40;
      setHighlightedIndex(displayStrikes - 1);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to bottom', type: 'info' } });
    } else {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
    }
    return;
  }

  // Global commands
  if (command === '/help' || command === '/h' || command === '/?') {
    dispatch({ type: 'SET_SCREEN', payload: 'help' });
    dispatch({ type: 'SET_STATUS', payload: { message: 'Showing help screen', type: 'info' } });
    return;
  }

  if (command === '/settings' || command === '/config') {
    dispatch({ type: 'SET_SCREEN', payload: 'settings' });
    dispatch({ type: 'SET_STATUS', payload: { message: 'Showing settings screen', type: 'info' } });
    return;
  }

  // Trading mode commands
  if (command === '/paper') {
    if (state.tradingMode === 'paper') {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Already in PAPER mode', type: 'info' } });
    } else {
      dispatch({ type: 'REQUEST_MODE_SWITCH', payload: 'paper' });
    }
    return;
  }

  if (command === '/live') {
    if (!state.liveCredentialsConfigured) {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Live credentials not configured', type: 'error' } });
    } else if (state.tradingMode === 'live') {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Already in LIVE mode', type: 'info' } });
    } else {
      dispatch({ type: 'REQUEST_MODE_SWITCH', payload: 'live' });
    }
    return;
  }

  if (command === '/mode') {
    const targetMode = state.tradingMode === 'paper' ? 'live' : 'paper';
    if (targetMode === 'live' && !state.liveCredentialsConfigured) {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Live credentials not configured', type: 'error' } });
    } else {
      dispatch({ type: 'REQUEST_MODE_SWITCH', payload: targetMode });
    }
    return;
  }

  // Unknown command
  if (command.startsWith('/')) {
    dispatch({ type: 'SET_STATUS', payload: { message: `Unknown command: ${command}`, type: 'error' } });
  }
}
