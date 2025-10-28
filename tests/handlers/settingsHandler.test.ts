// AIDEV-NOTE: Tests for settings screen handler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSettingsScreen } from '../../src/handlers/settingsHandler.js';
import type { HandlerContext } from '../../src/handlers/types.js';
import type { AppState } from '../../src/types/index.js';

describe('settingsHandler', () => {
  let mockContext: HandlerContext;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();

    mockContext = {
      state: {
        currentScreen: 'settings',
        tradingMode: 'paper',
        liveCredentialsConfigured: true,
      } as AppState,
      dispatch: mockDispatch,
      exit: vi.fn(),
      highlightedIndex: 0,
      setHighlightedIndex: vi.fn(),
      showGreeks: true,
      setShowGreeks: vi.fn(),
    };
  });

  describe('when not on settings screen', () => {
    it('should not handle input', () => {
      mockContext.state.currentScreen = 'home';
      const result = handleSettingsScreen('q', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });

  describe('q key', () => {
    it('should go back to previous screen', () => {
      const result = handleSettingsScreen('q', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    });
  });

  describe('m key - mode switching', () => {
    it('should toggle from paper to live', () => {
      mockContext.state.tradingMode = 'paper';
      mockContext.state.liveCredentialsConfigured = true;

      const result = handleSettingsScreen('m', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'REQUEST_MODE_SWITCH',
        payload: 'live',
      });
    });

    it('should toggle from live to paper', () => {
      mockContext.state.tradingMode = 'live';

      const result = handleSettingsScreen('m', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'REQUEST_MODE_SWITCH',
        payload: 'paper',
      });
    });

    it('should handle uppercase M', () => {
      const result = handleSettingsScreen('M', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'REQUEST_MODE_SWITCH',
        payload: 'live',
      });
    });

    it('should show error if live credentials not configured', () => {
      mockContext.state.tradingMode = 'paper';
      mockContext.state.liveCredentialsConfigured = false;

      const result = handleSettingsScreen('m', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: {
          message: 'Live credentials not configured. Check .env.local file.',
          type: 'error',
        },
      });
      expect(mockDispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REQUEST_MODE_SWITCH' })
      );
    });
  });

  describe('other keys', () => {
    it('should not handle other inputs', () => {
      const result = handleSettingsScreen('h', {}, mockContext);
      expect(result.handled).toBe(false);
    });

    it('should not handle arrow keys', () => {
      const result = handleSettingsScreen('', { upArrow: true }, mockContext);
      expect(result.handled).toBe(false);
    });
  });
});
