// AIDEV-NOTE: Tests for saved strategies screen handler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleSavedStrategiesScreen } from '../../src/handlers/savedStrategiesHandler.js';
import type { HandlerContext } from '../../src/handlers/types.js';
import type { AppState } from '../../src/types/index.js';

describe('savedStrategiesHandler', () => {
  let mockContext: HandlerContext;
  let mockDispatch: ReturnType<typeof vi.fn>;
  let mockSetHighlightedIndex: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();
    mockSetHighlightedIndex = vi.fn();

    mockContext = {
      state: {
        currentScreen: 'savedStrategies',
        savedStrategies: [
          { id: '1', name: 'Strategy 1' },
          { id: '2', name: 'Strategy 2' },
          { id: '3', name: 'Strategy 3' },
        ],
      } as AppState,
      dispatch: mockDispatch,
      exit: vi.fn(),
      highlightedIndex: 1,
      setHighlightedIndex: mockSetHighlightedIndex,
      showGreeks: true,
      setShowGreeks: vi.fn(),
    };
  });

  describe('when not on saved strategies screen', () => {
    it('should not handle input', () => {
      mockContext.state.currentScreen = 'home';
      const result = handleSavedStrategiesScreen('k', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });

  describe('navigation', () => {
    describe('up arrow / k', () => {
      it('should move selection up with arrow key', () => {
        const result = handleSavedStrategiesScreen('', { upArrow: true }, mockContext);

        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();

        // Verify the callback moves index up
        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(1)).toBe(0); // 1 -> 0
      });

      it('should move selection up with k key', () => {
        const result = handleSavedStrategiesScreen('k', {}, mockContext);

        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });

      it('should not go below 0', () => {
        const result = handleSavedStrategiesScreen('k', {}, mockContext);

        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(0)).toBe(0); // Can't go below 0
      });
    });

    describe('down arrow / j', () => {
      it('should move selection down with arrow key', () => {
        const result = handleSavedStrategiesScreen('', { downArrow: true }, mockContext);

        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();

        // Verify the callback moves index down
        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(1)).toBe(2); // 1 -> 2
      });

      it('should move selection down with j key', () => {
        const result = handleSavedStrategiesScreen('j', {}, mockContext);

        expect(result.handled).toBe(true);
        expect(mockSetHighlightedIndex).toHaveBeenCalled();
      });

      it('should not go beyond max index', () => {
        const result = handleSavedStrategiesScreen('j', {}, mockContext);

        const callback = mockSetHighlightedIndex.mock.calls[0][0];
        expect(callback(2)).toBe(2); // Can't go beyond max (2)
      });
    });
  });

  describe('x key - delete strategy', () => {
    it('should delete the selected strategy', () => {
      mockContext.highlightedIndex = 1;

      const result = handleSavedStrategiesScreen('x', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'REMOVE_STRATEGY',
        payload: '2',
      });
      expect(mockDispatch).toHaveBeenCalledWith({
        type: 'SET_STATUS',
        payload: { message: 'Strategy removed', type: 'success' },
      });
    });

    it('should adjust highlighted index if deleting last item', () => {
      mockContext.highlightedIndex = 2; // Last item

      const result = handleSavedStrategiesScreen('x', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetHighlightedIndex).toHaveBeenCalledWith(1); // Move to previous item
    });

    it('should handle deleting when only one strategy exists', () => {
      mockContext.state.savedStrategies = [{ id: '1', name: 'Only Strategy' }] as any;
      mockContext.highlightedIndex = 0;

      const result = handleSavedStrategiesScreen('x', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockSetHighlightedIndex).toHaveBeenCalledWith(0);
    });

    it('should handle no strategy selected', () => {
      mockContext.highlightedIndex = 10; // Out of bounds
      mockContext.state.savedStrategies = [];

      const result = handleSavedStrategiesScreen('x', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).not.toHaveBeenCalledWith(
        expect.objectContaining({ type: 'REMOVE_STRATEGY' })
      );
    });
  });

  describe('q key - go back', () => {
    it('should go back to previous screen', () => {
      const result = handleSavedStrategiesScreen('q', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
      expect(mockSetHighlightedIndex).toHaveBeenCalledWith(0);
    });
  });

  describe('other keys', () => {
    it('should not handle other inputs', () => {
      const result = handleSavedStrategiesScreen('h', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });
});
