// AIDEV-NOTE: Global application state management using React Context + useReducer

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { AppState, AppAction } from '../types/index.js';
import { loadStrategies, saveStrategies } from '../utils/storage.js';
import { logger } from '../utils/logger.js';
// Task #18: Import config functions for trading mode
import { loadConfig, isLiveTradingAvailable, updateTradingMode } from '../config/index.js';
// Task #18 Phase 5: Import audit logger
import {
  auditModeSwitchRequest,
  auditModeSwitchConfirmed,
  auditModeSwitchCancelled,
  auditAppStartup,
} from '../utils/auditLogger.js';

/**
 * Initial application state
 */
const initialState: AppState = {
  // Screen management
  currentScreen: 'home',
  screenHistory: ['home'],

  // Mode management
  mode: 'navigation',

  // Input state
  inputBuffer: '',
  commandBuffer: '',

  // Navigation state
  selectedIndex: {},

  // Status
  statusMessage: '',
  statusType: 'info',

  // Data state
  currentSymbol: null,
  stockQuote: null,
  optionChain: null,
  selectedExpiration: null,
  availableExpirations: [],
  savedStrategies: [],

  // Display preferences
  displayLimit: 40, // Default to 40 lines
  loading: false,
  error: null,

  // Strategy builder state (Task #9 - Multi-strategy support)
  strategyBuilderActive: false,
  selectedStrategyType: null,
  builderStep: 'long',
  selectedLongCall: null,
  selectedShortCall: null,
  selectedLegs: [],

  // Dual-expiration support (for diagonal spreads)
  leg1Expiration: null,
  leg2Expiration: null,
  leg1OptionChain: null,
  leg2OptionChain: null,

  // Save confirmation state
  showSaveConfirmation: false,
  strategyToSave: null,

  // Trading mode state (Task #18 Phase 3)
  // Initialize with defaults - will be set properly in useEffect
  tradingMode: 'paper', // Always starts in paper mode for safety
  liveCredentialsConfigured: false, // Will be set in useEffect
  showModeConfirmation: false,
  pendingModeSwitch: null,

  // Validation state (Task #18 Phase 5)
  validationWarnings: [],
};

/**
 * Application state reducer
 */
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    // Screen navigation
    case 'SET_SCREEN':
      return {
        ...state,
        screenHistory: [...state.screenHistory, action.payload],
        currentScreen: action.payload,
        mode: 'navigation',
        inputBuffer: '',
        commandBuffer: '',
      };

    case 'GO_BACK':
      if (state.screenHistory.length <= 1) return state;
      const newHistory = state.screenHistory.slice(0, -1);
      return {
        ...state,
        screenHistory: newHistory,
        currentScreen: newHistory[newHistory.length - 1]!,
        mode: 'navigation',
        inputBuffer: '',
        commandBuffer: '',
      };

    // Mode management
    case 'SET_MODE':
      return {
        ...state,
        mode: action.payload,
        inputBuffer: action.payload === 'navigation' ? '' : state.inputBuffer,
        commandBuffer: action.payload === 'navigation' ? '' : state.commandBuffer,
      };

    // Input handling
    case 'APPEND_INPUT':
      return {
        ...state,
        [state.mode === 'command' ? 'commandBuffer' : 'inputBuffer']:
          state.mode === 'command'
            ? state.commandBuffer + action.payload
            : state.inputBuffer + action.payload,
      };

    case 'DELETE_LAST_CHAR':
      if (state.mode === 'command') {
        const newBuffer = state.commandBuffer.slice(0, -1);
        return {
          ...state,
          commandBuffer: newBuffer,
          mode: newBuffer === '' ? 'navigation' : state.mode,
        };
      }
      return {
        ...state,
        inputBuffer: state.inputBuffer.slice(0, -1),
      };

    case 'CLEAR_INPUT':
      return {
        ...state,
        inputBuffer: '',
        commandBuffer: '',
      };

    // Navigation within screens
    case 'MOVE_SELECTION': {
      const { screen, direction, max } = action.payload;
      const current = state.selectedIndex[screen] || 0;
      const newIndex =
        direction === 'up'
          ? Math.max(0, current - 1)
          : Math.min(max, current + 1);
      return {
        ...state,
        selectedIndex: {
          ...state.selectedIndex,
          [screen]: newIndex,
        },
      };
    }

    case 'RESET_SELECTION':
      return {
        ...state,
        selectedIndex: {
          ...state.selectedIndex,
          [action.payload]: 0,
        },
      };

    // Status messages
    case 'SET_STATUS':
      return {
        ...state,
        statusMessage: action.payload.message,
        statusType: action.payload.type,
      };

    case 'CLEAR_STATUS':
      return {
        ...state,
        statusMessage: '',
      };

    // Data operations
    case 'SET_SYMBOL':
      return {
        ...state,
        currentSymbol: action.payload.toUpperCase(),
      };

    case 'SET_STOCK_QUOTE':
      return {
        ...state,
        stockQuote: action.payload,
      };

    case 'SET_OPTION_CHAIN':
      return {
        ...state,
        optionChain: action.payload,
      };

    case 'SET_EXPIRATION':
      return {
        ...state,
        selectedExpiration: action.payload,
      };

    case 'SET_AVAILABLE_EXPIRATIONS':
      logger.debug(`📅 Reducer: Setting availableExpirations to: ${action.payload.join(', ')}`);
      return {
        ...state,
        availableExpirations: action.payload,
      };

    case 'ADD_STRATEGY':
      return {
        ...state,
        savedStrategies: [...state.savedStrategies, action.payload],
      };

    case 'REMOVE_STRATEGY':
      return {
        ...state,
        savedStrategies: state.savedStrategies.filter(s => s.id !== action.payload),
      };

    case 'LOAD_STRATEGIES':
      return {
        ...state,
        savedStrategies: action.payload,
      };

    case 'SET_DISPLAY_LIMIT':
      return {
        ...state,
        displayLimit: action.payload,
      };

    case 'SET_LOADING':
      return {
        ...state,
        loading: action.payload,
      };

    case 'SET_ERROR':
      return {
        ...state,
        error: action.payload,
      };

    // Strategy builder actions (Task #9 - Multi-strategy support)
    case 'ACTIVATE_STRATEGY_BUILDER':
      return {
        ...state,
        strategyBuilderActive: true,
        selectedStrategyType: action.payload || null,
        builderStep: 'long',
        selectedLongCall: null,
        selectedShortCall: null,
        selectedLegs: [],
      };

    case 'DEACTIVATE_STRATEGY_BUILDER':
      return {
        ...state,
        strategyBuilderActive: false,
        selectedStrategyType: null,
        builderStep: 'long',
        selectedLongCall: null,
        selectedShortCall: null,
        selectedLegs: [],
        leg1Expiration: null,
        leg2Expiration: null,
        leg1OptionChain: null,
        leg2OptionChain: null,
      };

    case 'SET_STRATEGY_TYPE':
      // Determine initial builder step based on strategy type
      let initialStep: typeof state.builderStep;
      if (action.payload === 'bull_call_spread') {
        initialStep = 'long';
      } else if (action.payload === 'diagonal_call_spread') {
        initialStep = 'expiration1'; // Diagonal spreads start with expiration selection
      } else {
        initialStep = 'leg1';
      }

      return {
        ...state,
        selectedStrategyType: action.payload,
        selectedLegs: [], // Clear legs when changing strategy type
        builderStep: initialStep,
      };

    case 'SET_BUILDER_STEP':
      return {
        ...state,
        builderStep: action.payload,
      };

    case 'SET_LONG_CALL':
      return {
        ...state,
        selectedLongCall: action.payload,
      };

    case 'SET_SHORT_CALL':
      return {
        ...state,
        selectedShortCall: action.payload,
      };

    case 'ADD_LEG':
      return {
        ...state,
        selectedLegs: [...state.selectedLegs, action.payload],
      };

    case 'REMOVE_LAST_LEG':
      return {
        ...state,
        selectedLegs: state.selectedLegs.slice(0, -1),
      };

    case 'CLEAR_LEGS':
      return {
        ...state,
        selectedLegs: [],
      };

    case 'SET_LEG1_EXPIRATION':
      return {
        ...state,
        leg1Expiration: action.payload,
      };

    case 'SET_LEG2_EXPIRATION':
      return {
        ...state,
        leg2Expiration: action.payload,
      };

    case 'SET_LEG1_OPTION_CHAIN':
      return {
        ...state,
        leg1OptionChain: action.payload,
      };

    case 'SET_LEG2_OPTION_CHAIN':
      return {
        ...state,
        leg2OptionChain: action.payload,
      };

    case 'SHOW_SAVE_CONFIRMATION':
      return {
        ...state,
        showSaveConfirmation: true,
        strategyToSave: action.payload,
      };

    case 'HIDE_SAVE_CONFIRMATION':
      return {
        ...state,
        showSaveConfirmation: false,
        strategyToSave: null,
      };

    case 'CONFIRM_SAVE_STRATEGY':
      if (!state.strategyToSave) return state;
      return {
        ...state,
        savedStrategies: [...state.savedStrategies, state.strategyToSave],
        showSaveConfirmation: false,
        strategyToSave: null,
        strategyBuilderActive: false,
        selectedStrategyType: null,
        builderStep: 'long',
        selectedLongCall: null,
        selectedShortCall: null,
        selectedLegs: [],
        leg1Expiration: null,
        leg2Expiration: null,
        leg1OptionChain: null,
        leg2OptionChain: null,
      };

    // Trading mode actions (Task #18 Phase 3)
    case 'REQUEST_MODE_SWITCH':
      // Show confirmation dialog with pending mode
      logger.info(`🔄 Requesting mode switch to: ${action.payload.toUpperCase()}`);
      // Audit log (Phase 5)
      auditModeSwitchRequest(state.tradingMode, action.payload);
      return {
        ...state,
        showModeConfirmation: true,
        pendingModeSwitch: action.payload,
      };

    case 'CONFIRM_MODE_SWITCH':
      // Actually perform the mode switch
      if (!state.pendingModeSwitch) return state;

      logger.success(`✅ Confirmed mode switch to: ${state.pendingModeSwitch.toUpperCase()}`);
      // Audit log (Phase 5)
      auditModeSwitchConfirmed(state.tradingMode, state.pendingModeSwitch);
      return {
        ...state,
        tradingMode: state.pendingModeSwitch,
        showModeConfirmation: false,
        pendingModeSwitch: null,
        validationWarnings: [], // Clear warnings
      };

    case 'CANCEL_MODE_SWITCH':
      // Cancel the mode switch
      logger.info('❌ Cancelled mode switch');
      // Audit log (Phase 5)
      if (state.pendingModeSwitch) {
        auditModeSwitchCancelled(state.tradingMode, state.pendingModeSwitch);
      }
      return {
        ...state,
        showModeConfirmation: false,
        pendingModeSwitch: null,
        validationWarnings: [], // Clear warnings
      };

    case 'SET_TRADING_MODE':
      // Direct mode switch (used internally, bypasses confirmation)
      logger.info(`🔄 Setting trading mode to: ${action.payload.toUpperCase()}`);
      return {
        ...state,
        tradingMode: action.payload,
      };

    case 'SET_LIVE_CREDENTIALS_STATUS':
      // Update live credentials status (Task #18)
      return {
        ...state,
        liveCredentialsConfigured: action.payload,
      };

    case 'SET_VALIDATION_WARNINGS':
      // Set validation warnings (Task #18 Phase 5)
      return {
        ...state,
        validationWarnings: action.payload,
      };

    default:
      return state;
  }
}

/**
 * Context type
 */
interface AppContextType {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
}

/**
 * Create context
 */
const AppContext = createContext<AppContextType | undefined>(undefined);

/**
 * Provider component
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  // Load strategies from disk on mount (Task #8 Enhancement - Persistence)
  useEffect(() => {
    (async () => {
      const strategies = await loadStrategies();
      if (strategies.length > 0) {
        dispatch({ type: 'LOAD_STRATEGIES', payload: strategies });
        logger.success(`📂 Loaded ${strategies.length} saved strateg${strategies.length === 1 ? 'y' : 'ies'} from disk`);
      }
    })();
  }, []);

  // Initialize trading mode and credentials from config on mount (Task #18)
  useEffect(() => {
    const config = loadConfig();

    // Set trading mode (always starts in paper for safety)
    dispatch({ type: 'SET_TRADING_MODE', payload: config.tradingMode });

    // Check if live credentials are configured
    const liveAvailable = isLiveTradingAvailable(config);
    dispatch({ type: 'SET_LIVE_CREDENTIALS_STATUS', payload: liveAvailable });

    logger.info(`🔧 Initialized: Mode=${config.tradingMode.toUpperCase()}, Live=${liveAvailable ? 'Available' : 'Not Available'}`);

    // Audit log app startup (Phase 5)
    auditAppStartup(config.tradingMode, liveAvailable);
  }, []);

  // Auto-save strategies to disk whenever they change (Task #8 Enhancement - Persistence)
  useEffect(() => {
    // Skip save on initial mount (strategies are empty initially)
    if (state.savedStrategies.length === 0 && !initialState.savedStrategies.length) {
      return;
    }

    // Save strategies asynchronously
    (async () => {
      await saveStrategies(state.savedStrategies);
    })();
  }, [state.savedStrategies]);

  // Auto-save trading mode to config when it changes (Task #18 Phase 3)
  useEffect(() => {
    // Skip on initial mount
    if (state.tradingMode === initialState.tradingMode) {
      return;
    }

    // Update config file with new trading mode
    const config = loadConfig();
    updateTradingMode(state.tradingMode, config);
    logger.info(`💾 Saved trading mode preference: ${state.tradingMode.toUpperCase()}`);
  }, [state.tradingMode]);

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  );
}

/**
 * Hook to use app context
 */
export function useAppContext(): AppContextType {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppContext must be used within AppProvider');
  }
  return context;
}
