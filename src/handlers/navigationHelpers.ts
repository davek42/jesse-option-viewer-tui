// AIDEV-NOTE: Reusable navigation helpers for input handlers

import type { AppAction } from '../types/index.js';

export interface NavigationHelpers {
  handleUpDown: (
    input: string,
    key: any,
    highlightedIndex: number,
    maxIndex: number,
    setHighlightedIndex: (index: number | ((prev: number) => number)) => void
  ) => boolean;

  handleJumps: (
    input: string,
    maxIndex: number,
    setHighlightedIndex: (index: number | ((prev: number) => number)) => void,
    dispatch: React.Dispatch<AppAction>
  ) => boolean;
}

/**
 * Handle up/down arrow or j/k navigation
 * Returns true if handled, false otherwise
 */
export function handleUpDownNavigation(
  input: string,
  key: any,
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void,
  maxIndex: number
): boolean {
  if (key.upArrow || input === 'k') {
    setHighlightedIndex((prev) => Math.max(0, prev - 1));
    return true;
  } else if (key.downArrow || input === 'j') {
    setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
    return true;
  }
  return false;
}

/**
 * Handle J/K large jumps (10 items)
 * Returns true if handled, false otherwise
 */
export function handleJumpNavigation(
  input: string,
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void,
  maxIndex: number,
  dispatch: React.Dispatch<AppAction>
): boolean {
  if (input === 'K') {
    setHighlightedIndex((prev) => Math.max(0, prev - 10));
    dispatch({ type: 'SET_STATUS', payload: { message: '⬆️  Jumped up 10 items', type: 'info' } });
    return true;
  } else if (input === 'J') {
    setHighlightedIndex((prev) => Math.min(maxIndex, prev + 10));
    dispatch({ type: 'SET_STATUS', payload: { message: '⬇️  Jumped down 10 items', type: 'info' } });
    return true;
  }
  return false;
}

/**
 * Handle all navigation (up/down + jumps) in one call
 * Returns true if handled, false otherwise
 */
export function handleAllNavigation(
  input: string,
  key: any,
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void,
  maxIndex: number,
  dispatch: React.Dispatch<AppAction>
): boolean {
  return (
    handleUpDownNavigation(input, key, setHighlightedIndex, maxIndex) ||
    handleJumpNavigation(input, setHighlightedIndex, maxIndex, dispatch)
  );
}
