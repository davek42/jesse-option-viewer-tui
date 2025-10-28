// AIDEV-NOTE: Tests for help screen handler

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleHelpScreen } from '../../src/handlers/helpHandler.js';
import type { HandlerContext } from '../../src/handlers/types.js';
import type { AppState } from '../../src/types/index.js';

describe('helpHandler', () => {
  let mockContext: HandlerContext;
  let mockDispatch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockDispatch = vi.fn();

    mockContext = {
      state: {
        currentScreen: 'help',
      } as AppState,
      dispatch: mockDispatch,
      exit: vi.fn(),
      highlightedIndex: 0,
      setHighlightedIndex: vi.fn(),
      showGreeks: true,
      setShowGreeks: vi.fn(),
    };
  });

  describe('when not on help screen', () => {
    it('should not handle input', () => {
      mockContext.state.currentScreen = 'home';
      const result = handleHelpScreen('q', {}, mockContext);
      expect(result.handled).toBe(false);
    });
  });

  describe('q key', () => {
    it('should go back to previous screen', () => {
      const result = handleHelpScreen('q', {}, mockContext);

      expect(result.handled).toBe(true);
      expect(mockDispatch).toHaveBeenCalledWith({ type: 'GO_BACK' });
    });
  });

  describe('other keys', () => {
    it('should not handle other inputs', () => {
      const result = handleHelpScreen('h', {}, mockContext);
      expect(result.handled).toBe(false);
    });

    it('should not handle arrow keys', () => {
      const result = handleHelpScreen('', { upArrow: true }, mockContext);
      expect(result.handled).toBe(false);
    });
  });
});
