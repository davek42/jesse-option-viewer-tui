// AIDEV-NOTE: Global application state management using React Context + useReducer

import React, { createContext, useContext, useReducer, type ReactNode } from 'react';
import type { AppState, AppAction } from '../types/index.js';

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
