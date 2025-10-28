// AIDEV-NOTE: Tests for input mode handler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleInputMode } from '../../src/handlers/inputHandler.js';
import type { InputHandlerContext } from '../../src/handlers/inputHandler.js';
import type { AppState } from '../../src/types/index.js';

describe('inputHandler', () => {
  let mockContext: InputHandlerContext;
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockOnSymbolEntry: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockOnSymbolEntry = vi.fn();

    mockContext = {
      state: {
        mode: 'input',
        inputBuffer: '',
      } as AppState,
      dispatch: mockDispatch,
      exit: vi.fn(),
      highlightedIndex: 0,
      setHighlightedIndex: vi.fn(),
      showGreeks: true,
      setShowGreeks: vi.fn(),
      onSymbolEntry: mockOnSymbolEntry,
    };
  });

  describe('when not in input mode', () => {
    it('should not handle input', () => {
      mockContext.state.mode = 'navigation';
      const result = handleInputMode('s', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });

  describe('escape key', () => {
    it('should clear input and exit input mode', () => {
      const result = handleInputMode('', { escape: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_INPUT' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODE', payload: 'navigation' });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Cancelled', type: 'info' }
      });
    });
  });

  describe('enter key', () => {
    it('should submit symbol and clear input', () => {
      mockContext.state.inputBuffer = 'spy';
      const result = handleInputMode('', { return: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockOnSymbolEntry).toHaveBeenCalledWith('SPY');
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'CLEAR_INPUT' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'SET_MODE', payload: 'navigation' });
    });

    it('should trim whitespace from symbol', () => {
      mockContext.state.inputBuffer = '  aapl  ';
      handleInputMode('', { return: true }, mockContext);

      expect(mockOnSymbolEntry).toHaveBeenCalledWith('AAPL');
    });

    it('should uppercase symbol', () => {
      mockContext.state.inputBuffer = 'tsla';
      handleInputMode('', { return: true }, mockContext);

      expect(mockOnSymbolEntry).toHaveBeenCalledWith('TSLA');
    });

    it('should not call onSymbolEntry if buffer is empty', () => {
      mockContext.state.inputBuffer = '';
      handleInputMode('', { return: true }, mockContext);

      expect(mockOnSymbolEntry).not.toHaveBeenCalled();
    });

    it('should not call onSymbolEntry if buffer is whitespace only', () => {
      mockContext.state.inputBuffer = '   ';
      handleInputMode('', { return: true }, mockContext);

      expect(mockOnSymbolEntry).not.toHaveBeenCalled();
    });

    it('should handle missing onSymbolEntry callback gracefully', () => {
      mockContext.onSymbolEntry = undefined;
      mockContext.state.inputBuffer = 'spy';

      expect(() => {
        handleInputMode('', { return: true }, mockContext);
      }).not.toThrow();
    });
  });

  describe('backspace/delete key', () => {
    it('should delete last character with backspace', () => {
      const result = handleInputMode('', { backspace: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'DELETE_LAST_CHAR' });
    });

    it('should delete last character with delete', () => {
      const result = handleInputMode('', { delete: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'DELETE_LAST_CHAR' });
    });
  });

  describe('regular character input', () => {
    it('should append character to input buffer', () => {
      const result = handleInputMode('s', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'APPEND_INPUT', payload: 's' });
    });

    it('should handle multiple characters', () => {
      handleInputMode('s', {}, mockContext);
      handleInputMode('p', {}, mockContext);
      handleInputMode('y', {}, mockContext);

      expect(mockDispatch).toHaveBeenCalledWith({ type: 'APPEND_INPUT', payload: 's' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'APPEND_INPUT', payload: 'p' });
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'APPEND_INPUT', payload: 'y' });
    });

    it('should not append if ctrl key is pressed', () => {
      const result = handleInputMode('c', { ctrl: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'APPEND_INPUT' }));
    });

    it('should not append if meta key is pressed', () => {
      const result = handleInputMode('c', { meta: true }, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'APPEND_INPUT' }));
    });
  });
});
