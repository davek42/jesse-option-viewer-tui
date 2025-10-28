// AIDEV-NOTE: Common types for input handlers (Refactored from App.tsx)

import type { AppState, AppAction } from '../types/index.js';

/**
 * Key object from Ink's useInput hook
 */
export interface KeyPress {
  ctrl?: boolean;
  meta?: boolean;
  escape?: boolean;
  return?: boolean;
  backspace?: boolean;
  delete?: boolean;
  upArrow?: boolean;
  downArrow?: boolean;
}

/**
 * Common context passed to all handlers
 */
export interface HandlerContext {
  /** Current application state */
  state: AppState;

  /** Dispatch function for state updates */
  dispatch: React.Dispatch<AppAction>;

  /** Exit function from Ink */
  exit: () => void;

  /** Highlighted index for navigation */
  highlightedIndex: number;

  /** Set highlighted index */
  setHighlightedIndex: React.Dispatch<React.SetStateAction<number>>;

  /** Show Greeks toggle */
  showGreeks: boolean;

  /** Set show Greeks */
  setShowGreeks: React.Dispatch<React.SetStateAction<boolean>>;
}

/**
 * Result of a handler function
 */
export interface HandlerResult {
  /** Whether the input was handled */
  handled: boolean;
}

/**
 * Input handler function signature
 */
export type InputHandler = (
  input: string,
  key: KeyPress,
  context: HandlerContext
) => HandlerResult;
