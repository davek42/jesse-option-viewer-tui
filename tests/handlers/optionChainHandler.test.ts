// AIDEV-NOTE: Tests for option chain view handler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleOptionChainView } from '../../src/handlers/optionChainHandler.js';
import type { HandlerContext } from '../../src/handlers/types.js';
import type { AppState } from '../../src/types/index.js';

describe('optionChainHandler', () => {
  let mockContext: HandlerContext;
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockSetHighlightedIndex: ReturnType<typeof vi.fn>;
  let mockSetShowGreeks: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockSetHighlightedIndex = vi.fn();
    mockSetShowGreeks = vi.fn();

    mockContext = {
      state: {
        currentScreen: 'optionChainView',
        optionChain: {
          calls: Array(50).fill({ strikePrice: 100 }),
          puts: Array(50).fill({ strikePrice: 100 }),
          underlyingPrice: 100,
        },
        displayLimit: 40,
      } as AppState,
      dispatch: mockDispatch,
      exit: vi.fn(),
      highlightedIndex: 25,
      setHighlightedIndex: mockSetHighlightedIndex,
      showGreeks: true,
      setShowGreeks: mockSetShowGreeks,
    };
  });

  describe('when not on option chain view screen', () => {
    it('should not handle input', () => {
      mockContext.state.currentScreen = 'home';
      const result = handleOptionChainView('k', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });

  describe('navigation', () => {
    describe('up arrow / k', () => {
      it('should move selection up with arrow key', () => {
        const result = handleOptionChainView('', { upArrow: true }, mockContext);

        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();

        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(25)).toBe(24);
      });

      it('should move selection up with k key', () => {
        const result = handleOptionChainView('k', {}, mockContext);
        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });

      it('should not go below 0', () => {
        handleOptionChainView('k', {}, mockContext);
        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(0)).toBe(0);
      });
    });

    describe('down arrow / j', () => {
      it('should move selection down with arrow key', () => {
        const result = handleOptionChainView('', { downArrow: true }, mockContext);

        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();

        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(25)).toBe(26);
      });

      it('should move selection down with j key', () => {
        const result = handleOptionChainView('j', {}, mockContext);
        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });

      it('should not go beyond total strikes', () => {
        handleOptionChainView('j', {}, mockContext);
        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(49)).toBe(49);
      });
    });
  });

  describe('a key - jump to ATM', () => {
    it('should jump to ATM strike', () => {
      const result = handleOptionChainView('a', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetHighlightedIndex).toHaveBeenCalled();
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Jumped to ATM strike', type: 'success' },
      });
    });

    it('should handle missing option chain gracefully', () => {
      mockContext.state.optionChain = null;

      const result = handleOptionChainView('a', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetHighlightedIndex).not.toHaveBeenCalled();
    });
  });

  describe('Ctrl+↑ - jump to top', () => {
    it('should jump to top strike', () => {
      const result = handleOptionChainView('', { ctrl: true, upArrow: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetHighlightedIndex).toHaveBeenCalledWith(0);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Jumped to top', type: 'info' },
      });
    });
  });

  describe('Ctrl+↓ - jump to bottom', () => {
    it('should jump to bottom strike', () => {
      const result = handleOptionChainView('', { ctrl: true, downArrow: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetHighlightedIndex).toHaveBeenCalledWith(49);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Jumped to bottom', type: 'info' },
      });
    });

    it('should handle missing option chain', () => {
      mockContext.state.optionChain = null;

      const result = handleOptionChainView('', { ctrl: true, downArrow: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetHighlightedIndex).not.toHaveBeenCalled();
    });
  });

  describe('l key - cycle display limit', () => {
    it('should cycle from 10 to 40', () => {
      mockContext.state.displayLimit = 10;

      const result = handleOptionChainView('l', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_DISPLAY_LIMIT', payload: 40 });
    });

    it('should cycle from 40 to ALL (-1)', () => {
      mockContext.state.displayLimit = 40;

      const result = handleOptionChainView('l', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_DISPLAY_LIMIT', payload: -1 });
    });

    it('should cycle from ALL (-1) back to 10', () => {
      mockContext.state.displayLimit = -1;

      const result = handleOptionChainView('l', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_DISPLAY_LIMIT', payload: 10 });
    });

    it('should show appropriate status message', () => {
      mockContext.state.displayLimit = 40;

      handleOptionChainView('l', {}, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Display limit: ALL', type: 'success' },
      });
    });
  });

  describe('g key - toggle Greeks', () => {
    it('should toggle Greeks display', () => {
      const result = handleOptionChainView('g', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetShowGreeks).toHaveBeenCalled();
    });

    it('should show status message when hiding Greeks', () => {
      mockContext.showGreeks = true;

      handleOptionChainView('g', {}, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Greeks hidden', type: 'info' },
      });
    });

    it('should show status message when showing Greeks', () => {
      mockContext.showGreeks = false;

      handleOptionChainView('g', {}, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Greeks visible', type: 'info' },
      });
    });
  });

  describe('q key - go back', () => {
    it('should go back to previous screen', () => {
      const result = handleOptionChainView('q', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
      expect(mockSetHighlightedIndex).toHaveBeenCalledWith(0);
    });
  });

  describe('other keys', () => {
    it('should not handle other inputs', () => {
      const result = handleOptionChainView('h', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });
});
