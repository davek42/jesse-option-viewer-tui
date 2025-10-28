// AIDEV-NOTE: Tests for home screen handler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHomeScreen } from '../../src/handlers/homeHandler.js';
import type { HandlerContext } from '../../src/handlers/types.js';
import type { AppState } from '../../src/types/index.js';

describe('homeHandler', () => {
  let mockContext: HandlerContext;
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockExit: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockExit = vi.fn();

    mockContext = {
      state: {
        currentScreen: 'home',
      } as AppState,
      dispatch: mockDispatch,
      exit: mockExit,
      highlightedIndex: 0,
      setHighlightedIndex: vi.fn(),
      showGreeks: true,
      setShowGreeks: vi.fn(),
    };
  });

  describe('when not on home screen', () => {
    it('should not handle input', () => {
      mockContext.state.currentScreen = 'symbolDetail';
      const result = handleHomeScreen('s', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });

  describe('s key - enter symbol', () => {
    it('should switch to input mode', () => {
      const result = handleHomeScreen('s', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODE', payload: 'input' });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Enter stock symbol', type: 'info' },
      });
    });
  });

  describe('c key - settings', () => {
    it('should navigate to settings screen', () => {
      const result = handleHomeScreen('c', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', payload: 'settings' });
    });
  });

  describe('q key - quit', () => {
    it('should exit the application', () => {
      const result = handleHomeScreen('q', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockExit).toHaveBeenCalled();
    });
  });

  describe('other keys', () => {
    it('should not handle other inputs', () => {
      const result = handleHomeScreen('h', {}, mockContext);
      expect(result.handled).toBe(false);
    });

    it('should not handle arrow keys', () => {
      const result = handleHomeScreen('', { upArrow: true }, mockContext);
      expect(result.handled).toBe(false);
    });
  });
});
