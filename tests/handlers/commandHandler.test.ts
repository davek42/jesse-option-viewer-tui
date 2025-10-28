// AIDEV-NOTE: Tests for command mode handler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleCommandMode } from '../../src/handlers/commandHandler.js';
import type { HandlerContext } from '../../src/handlers/types.js';
import type { AppState } from '../../src/types/index.js';

describe('commandHandler', () => {
  let mockContext: HandlerContext;
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockSetHighlightedIndex: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockSetHighlightedIndex = vi.fn();

    mockContext = {
      state: {
        mode: 'command',
        commandBuffer: '',
        currentScreen: 'home',
        tradingMode: 'paper',
        liveCredentialsConfigured: true,
      } as AppState,
      dispatch: mockDispatch,
      exit: vi.fn(),
      highlightedIndex: 0,
      setHighlightedIndex: mockSetHighlightedIndex,
      showGreeks: true,
      setShowGreeks: vi.fn(),
    };
  });

  describe('when not in command mode', () => {
    it('should not handle input', () => {
      mockContext.state.mode = 'navigation';
      const result = handleCommandMode('/', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });

  describe('escape key', () => {
    it('should clear input and exit command mode', () => {
      const result = handleCommandMode('', { escape: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_INPUT' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODE', payload: 'navigation' });
    });
  });

  describe('backspace/delete key', () => {
    it('should delete last character', () => {
      const result = handleCommandMode('', { backspace: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'DELETE_LAST_CHAR' });
    });

    it('should handle delete key', () => {
      const result = handleCommandMode('', { delete: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'DELETE_LAST_CHAR' });
    });
  });

  describe('regular character input', () => {
    it('should append character to command buffer', () => {
      const result = handleCommandMode('a', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'APPEND_INPUT', payload: 'a' });
    });

    it('should not append if ctrl key is pressed', () => {
      const result = handleCommandMode('c', { ctrl: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'APPEND_INPUT' }));
    });

    it('should not append if meta key is pressed', () => {
      const result = handleCommandMode('c', { meta: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'APPEND_INPUT' }));
    });
  });

  describe('/help command', () => {
    it('should show help screen', () => {
      mockContext.state.commandBuffer = '/help';
      const result = handleCommandMode('', { return: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', payload: 'help' });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Showing help screen', type: 'info' }
      });
    });

    it('should handle /h alias', () => {
      mockContext.state.commandBuffer = '/h';
      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', payload: 'help' });
    });

    it('should handle /? alias', () => {
      mockContext.state.commandBuffer = '/?';
      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', payload: 'help' });
    });
  });

  describe('/settings command', () => {
    it('should show settings screen', () => {
      mockContext.state.commandBuffer = '/settings';
      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', payload: 'settings' });
    });

    it('should handle /config alias', () => {
      mockContext.state.commandBuffer = '/config';
      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_SCREEN', payload: 'settings' });
    });
  });

  describe('/paper command', () => {
    it('should request switch to paper mode', () => {
      mockContext.state.tradingMode = 'live';
      mockContext.state.commandBuffer = '/paper';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REQUEST_MODE_SWITCH', payload: 'paper' });
    });

    it('should show message if already in paper mode', () => {
      mockContext.state.tradingMode = 'paper';
      mockContext.state.commandBuffer = '/paper';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Already in PAPER mode', type: 'info' }
      });
    });
  });

  describe('/live command', () => {
    it('should request switch to live mode', () => {
      mockContext.state.tradingMode = 'paper';
      mockContext.state.liveCredentialsConfigured = true;
      mockContext.state.commandBuffer = '/live';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REQUEST_MODE_SWITCH', payload: 'live' });
    });

    it('should show error if live credentials not configured', () => {
      mockContext.state.liveCredentialsConfigured = false;
      mockContext.state.commandBuffer = '/live';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Live credentials not configured', type: 'error' }
      });
    });

    it('should show message if already in live mode', () => {
      mockContext.state.tradingMode = 'live';
      mockContext.state.liveCredentialsConfigured = true;
      mockContext.state.commandBuffer = '/live';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Already in LIVE mode', type: 'info' }
      });
    });
  });

  describe('/mode command', () => {
    it('should toggle from paper to live', () => {
      mockContext.state.tradingMode = 'paper';
      mockContext.state.liveCredentialsConfigured = true;
      mockContext.state.commandBuffer = '/mode';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REQUEST_MODE_SWITCH', payload: 'live' });
    });

    it('should toggle from live to paper', () => {
      mockContext.state.tradingMode = 'live';
      mockContext.state.commandBuffer = '/mode';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'REQUEST_MODE_SWITCH', payload: 'paper' });
    });

    it('should show error if trying to toggle to live without credentials', () => {
      mockContext.state.tradingMode = 'paper';
      mockContext.state.liveCredentialsConfigured = false;
      mockContext.state.commandBuffer = '/mode';

      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Live credentials not configured', type: 'error' }
      });
    });
  });

  describe('option chain navigation commands', () => {
    beforeEach(() => {
      mockContext.state.currentScreen = 'optionChainView';
      mockContext.state.optionChain = {
        calls: Array(50).fill({}),
        puts: Array(50).fill({}),
        underlyingPrice: 100,
      } as any;
      mockContext.state.displayLimit = -1;
      mockContext.highlightedIndex = 25;
    });

    describe('/scroll up', () => {
      it('should scroll up 10 strikes', () => {
        mockContext.state.commandBuffer = '/scroll up';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });

      it('should handle /up alias', () => {
        mockContext.state.commandBuffer = '/up';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });

      it('should show warning if not in option chain view', () => {
        mockContext.state.currentScreen = 'home';
        mockContext.state.commandBuffer = '/scroll up';

        handleCommandMode('', { return: true }, mockContext);

        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SET_STATUS',
          payload: { message: 'Command only works in Option Chain View', type: 'warning' }
        });
      });
    });

    describe('/scroll down', () => {
      it('should scroll down 10 strikes', () => {
        mockContext.state.commandBuffer = '/scroll down';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });

      it('should handle /down alias', () => {
        mockContext.state.commandBuffer = '/down';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });
    });

    describe('/atm', () => {
      it('should jump to ATM strike', () => {
        mockContext.state.commandBuffer = '/atm';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalled();
        expect(mockDispatch).toHaveBeenCalledWith({
          type: 'SET_STATUS',
          payload: { message: 'Jumped to ATM strike', type: 'success' }
        });
      });

      it('should handle /a alias', () => {
        mockContext.state.commandBuffer = '/a';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });
    });

    describe('/top', () => {
      it('should jump to top strike', () => {
        mockContext.state.commandBuffer = '/top';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalledWith(0);
      });

      it('should handle /t alias', () => {
        mockContext.state.commandBuffer = '/t';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalledWith(0);
      });
    });

    describe('/bottom', () => {
      it('should jump to bottom strike', () => {
        mockContext.state.commandBuffer = '/bottom';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalledWith(49);
      });

      it('should handle /b alias', () => {
        mockContext.state.commandBuffer = '/b';
        handleCommandMode('', { return: true }, mockContext);

        expect(mockSetHighlightedIndex).toHaveBeenCalledWith(49);
      });
    });
  });

  describe('unknown command', () => {
    it('should show error message', () => {
      mockContext.state.commandBuffer = '/invalid';
      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Unknown command: /invalid', type: 'error' }
      });
    });
  });

  describe('after executing command', () => {
    it('should clear input and return to navigation mode', () => {
      mockContext.state.commandBuffer = '/help';
      handleCommandMode('', { return: true }, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_INPUT' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODE', payload: 'navigation' });
    });
  });
});
