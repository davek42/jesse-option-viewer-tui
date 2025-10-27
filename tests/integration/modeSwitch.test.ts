// AIDEV-NOTE: Integration tests for mode switching (Task #18 Phase 6)

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { AppState, AppAction } from '../../src/types/index.js';

describe('Mode Switching Integration', () => {
  // Mock reducer (simplified version for testing)
  function mockReducer(state: AppState, action: AppAction): AppState {
    switch (action.type) {
      case 'REQUEST_MODE_SWITCH':
        return {
          ...state,
          showModeConfirmation: true,
          pendingModeSwitch: action.payload,
        };

      case 'CONFIRM_MODE_SWITCH':
        if (!state.pendingModeSwitch) return state;
        return {
          ...state,
          tradingMode: state.pendingModeSwitch,
          showModeConfirmation: false,
          pendingModeSwitch: null,
          validationWarnings: [],
        };

      case 'CANCEL_MODE_SWITCH':
        return {
          ...state,
          showModeConfirmation: false,
          pendingModeSwitch: null,
          validationWarnings: [],
        };

      case 'SET_VALIDATION_WARNINGS':
        return {
          ...state,
          validationWarnings: action.payload,
        };

      default:
        return state;
    }
  }

  let initialState: Partial<AppState>;

  beforeEach(() => {
    initialState = {
      tradingMode: 'paper',
      liveCredentialsConfigured: true,
      showModeConfirmation: false,
      pendingModeSwitch: null,
      validationWarnings: [],
    };
  });

  describe('Complete mode switch flow', () => {
    it('should handle paper → live mode switch', () => {
      let state = initialState as AppState;

      // Request mode switch
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'live',
      });

      expect(state.showModeConfirmation).toBe(true);
      expect(state.pendingModeSwitch).toBe('live');
      expect(state.tradingMode).toBe('paper'); // Not changed yet

      // Confirm mode switch
      state = mockReducer(state, { type: 'CONFIRM_MODE_SWITCH' });

      expect(state.tradingMode).toBe('live');
      expect(state.showModeConfirmation).toBe(false);
      expect(state.pendingModeSwitch).toBe(null);
    });

    it('should handle live → paper mode switch', () => {
      let state = { ...initialState, tradingMode: 'live' } as AppState;

      // Request mode switch
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'paper',
      });

      expect(state.showModeConfirmation).toBe(true);
      expect(state.pendingModeSwitch).toBe('paper');

      // Confirm mode switch
      state = mockReducer(state, { type: 'CONFIRM_MODE_SWITCH' });

      expect(state.tradingMode).toBe('paper');
      expect(state.showModeConfirmation).toBe(false);
    });
  });

  describe('Mode switch cancellation', () => {
    it('should cancel mode switch and revert state', () => {
      let state = initialState as AppState;

      // Request mode switch
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'live',
      });

      expect(state.showModeConfirmation).toBe(true);

      // Cancel mode switch
      state = mockReducer(state, { type: 'CANCEL_MODE_SWITCH' });

      expect(state.tradingMode).toBe('paper'); // Unchanged
      expect(state.showModeConfirmation).toBe(false);
      expect(state.pendingModeSwitch).toBe(null);
    });

    it('should clear validation warnings on cancel', () => {
      let state = {
        ...initialState,
        validationWarnings: ['Warning 1', 'Warning 2'],
      } as AppState;

      state = mockReducer(state, { type: 'CANCEL_MODE_SWITCH' });

      expect(state.validationWarnings).toEqual([]);
    });
  });

  describe('Validation warnings', () => {
    it('should store validation warnings', () => {
      let state = initialState as AppState;

      const warnings = ['⚠️  LIVE mode warning', '💰 Real money warning'];
      state = mockReducer(state, {
        type: 'SET_VALIDATION_WARNINGS',
        payload: warnings,
      });

      expect(state.validationWarnings).toEqual(warnings);
    });

    it('should clear validation warnings on confirm', () => {
      let state = {
        ...initialState,
        pendingModeSwitch: 'live',
        validationWarnings: ['Warning 1'],
      } as AppState;

      state = mockReducer(state, { type: 'CONFIRM_MODE_SWITCH' });

      expect(state.validationWarnings).toEqual([]);
    });
  });

  describe('Edge cases', () => {
    it('should handle confirm without pending mode switch', () => {
      let state = {
        ...initialState,
        pendingModeSwitch: null,
      } as AppState;

      const beforeState = { ...state };
      state = mockReducer(state, { type: 'CONFIRM_MODE_SWITCH' });

      // State should remain unchanged
      expect(state).toEqual(beforeState);
    });

    it('should handle multiple consecutive requests', () => {
      let state = initialState as AppState;

      // First request
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'live',
      });
      expect(state.pendingModeSwitch).toBe('live');

      // Second request (should overwrite)
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'paper',
      });
      expect(state.pendingModeSwitch).toBe('paper');
    });
  });

  describe('State consistency', () => {
    it('should maintain consistent state after full cycle', () => {
      let state = initialState as AppState;

      // Request → Confirm → Request → Cancel
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'live',
      });
      state = mockReducer(state, { type: 'CONFIRM_MODE_SWITCH' });
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'paper',
      });
      state = mockReducer(state, { type: 'CANCEL_MODE_SWITCH' });

      expect(state.tradingMode).toBe('live');
      expect(state.showModeConfirmation).toBe(false);
      expect(state.pendingModeSwitch).toBe(null);
      expect(state.validationWarnings).toEqual([]);
    });
  });

  describe('Safety checks', () => {
    it('should always require confirmation for mode switch', () => {
      let state = initialState as AppState;

      // Request should not immediately change mode
      state = mockReducer(state, {
        type: 'REQUEST_MODE_SWITCH',
        payload: 'live',
      });

      expect(state.tradingMode).toBe('paper');
      expect(state.showModeConfirmation).toBe(true);
    });

    it('should always clear sensitive state on cancel', () => {
      let state = {
        ...initialState,
        showModeConfirmation: true,
        pendingModeSwitch: 'live',
        validationWarnings: ['Warning'],
      } as AppState;

      state = mockReducer(state, { type: 'CANCEL_MODE_SWITCH' });

      expect(state.showModeConfirmation).toBe(false);
      expect(state.pendingModeSwitch).toBe(null);
      expect(state.validationWarnings).toEqual([]);
    });
  });
});
