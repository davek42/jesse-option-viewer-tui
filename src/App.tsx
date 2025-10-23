// AIDEV-NOTE: Main application component with routing and layout

import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { AppProvider, useAppContext } from './context/AppContext.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { OptionChainScreen } from './screens/OptionChainScreen.js';
import { getAlpacaClient } from './lib/alpaca.js';
import { logger } from './utils/logger.js';

// Navigation state context for option chain screen
interface NavigationState {
  optionChainFocus: 'expiration' | 'optionChain';
  highlightedIndex: number;
  showGreeks: boolean;
  setOptionChainFocus: (focus: 'expiration' | 'optionChain') => void;
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void;
  setShowGreeks: (show: boolean | ((prev: boolean) => boolean)) => void;
}

const NavigationContext = React.createContext<NavigationState | undefined>(undefined);

function useNavigation() {
  const context = React.useContext(NavigationContext);
  if (!context) {
    throw new Error('useNavigation must be used within NavigationProvider');
  }
  return context;
}

/**
 * Navigation provider for option chain screen
 */
function NavigationProvider({ children }: { children: React.ReactNode }) {
  const [optionChainFocus, setOptionChainFocus] = useState<'expiration' | 'optionChain'>('expiration');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [showGreeks, setShowGreeks] = useState(true);

  return (
    <NavigationContext.Provider
      value={{
        optionChainFocus,
        highlightedIndex,
        showGreeks,
        setOptionChainFocus,
        setHighlightedIndex,
        setShowGreeks,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
}

/**
 * Global input handler component
 */
function GlobalInputHandler() {
  const { exit } = useApp();
  const { state, dispatch } = useAppContext();
  const { currentScreen, mode, inputBuffer, availableExpirations, displayLimit } = state;

  // Get navigation state for option chain screen
  const {
    optionChainFocus,
    highlightedIndex,
    showGreeks,
    setOptionChainFocus,
    setHighlightedIndex,
    setShowGreeks,
  } = useNavigation();

  useInput((input: string, key: { ctrl?: boolean; meta?: boolean; escape?: boolean; return?: boolean; backspace?: boolean; delete?: boolean; upArrow?: boolean; downArrow?: boolean }) => {
    // Global: Ctrl+C to exit
    if (key.ctrl && input === 'c') {
      logger.info('👋 Exiting application...');
      exit();
      return;
    }

    // COMMAND MODE
    if (mode === 'command') {
      if (key.escape) {
        dispatch({ type: 'CLEAR_INPUT' });
        dispatch({ type: 'SET_MODE', payload: 'navigation' });
        return;
      }

      if (key.backspace || key.delete) {
        dispatch({ type: 'DELETE_LAST_CHAR' });
        return;
      }

      if (key.return) {
        // Execute command (to be implemented)
        logger.debug('Command entered:', state.commandBuffer);
        dispatch({ type: 'CLEAR_INPUT' });
        dispatch({ type: 'SET_MODE', payload: 'navigation' });
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        dispatch({ type: 'APPEND_INPUT', payload: input });
      }
      return;
    }

    // INPUT MODE
    if (mode === 'input') {
      if (key.escape) {
        dispatch({ type: 'CLEAR_INPUT' });
        dispatch({ type: 'SET_MODE', payload: 'navigation' });
        dispatch({ type: 'SET_STATUS', payload: { message: 'Cancelled', type: 'info' } });
        return;
      }

      if (key.return) {
        const symbol = inputBuffer.trim().toUpperCase();
        if (symbol) {
          handleSymbolEntry(symbol);
        }
        dispatch({ type: 'CLEAR_INPUT' });
        dispatch({ type: 'SET_MODE', payload: 'navigation' });
        return;
      }

      if (key.backspace || key.delete) {
        dispatch({ type: 'DELETE_LAST_CHAR' });
        return;
      }

      if (input && !key.ctrl && !key.meta) {
        dispatch({ type: 'APPEND_INPUT', payload: input });
      }
      return;
    }

    // NAVIGATION MODE
    // Slash command initiation
    if (input === '/') {
      dispatch({ type: 'SET_MODE', payload: 'command' });
      dispatch({ type: 'APPEND_INPUT', payload: '/' });
      return;
    }

    // Home screen navigation
    if (currentScreen === 'home') {
      if (input === 's') {
        dispatch({ type: 'SET_MODE', payload: 'input' });
        dispatch({ type: 'SET_STATUS', payload: { message: 'Enter stock symbol', type: 'info' } });
      } else if (input === 'h' || input === '?') {
        dispatch({ type: 'SET_SCREEN', payload: 'help' });
      } else if (input === 'q') {
        logger.info('👋 Exiting application...');
        exit();
      }
    }

    // Option chain screen navigation
    if (currentScreen === 'optionChain') {
      // Navigation keys
      if (key.upArrow || input === 'k') {
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        const maxIndex = optionChainFocus === 'expiration' ? availableExpirations.length - 1 : 40;
        setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
      }

      // Selection
      else if (key.return) {
        if (optionChainFocus === 'expiration' && availableExpirations[highlightedIndex]) {
          // Selection is handled by the OptionChainScreen component
        }
      }

      // Focus switching
      else if (input === 'e') {
        setOptionChainFocus('expiration');
        setHighlightedIndex(0);
        dispatch({ type: 'SET_STATUS', payload: { message: 'Focus: Expiration dates', type: 'info' } });
      } else if (input === 'o') {
        setOptionChainFocus('optionChain');
        setHighlightedIndex(0);
        dispatch({ type: 'SET_STATUS', payload: { message: 'Focus: Option chain', type: 'info' } });
      }

      // Display limit cycling
      else if (input === 'l') {
        const limits = [10, 40, -1]; // -1 means ALL
        const currentIndex = limits.indexOf(displayLimit);
        const nextIndex = (currentIndex + 1) % limits.length;
        const newLimit = limits[nextIndex]!;
        dispatch({ type: 'SET_DISPLAY_LIMIT', payload: newLimit });
        dispatch({
          type: 'SET_STATUS',
          payload: { message: `Display limit: ${newLimit === -1 ? 'ALL' : newLimit}`, type: 'success' },
        });
      }

      // Toggle Greeks
      else if (input === 'g') {
        setShowGreeks((prev) => !prev);
        dispatch({
          type: 'SET_STATUS',
          payload: { message: `Greeks ${showGreeks ? 'hidden' : 'visible'}`, type: 'info' },
        });
      }

      // Symbol entry
      else if (input === 's') {
        dispatch({ type: 'SET_MODE', payload: 'input' });
        dispatch({ type: 'SET_STATUS', payload: { message: 'Enter stock symbol', type: 'info' } });
      }

      // Go back
      else if (input === 'q') {
        dispatch({ type: 'GO_BACK' });
        setHighlightedIndex(0);
        setOptionChainFocus('expiration');
      }
    }
  });

  // Symbol entry handler
  async function handleSymbolEntry(symbol: string) {
    dispatch({ type: 'SET_LOADING', payload: true });
    dispatch({ type: 'SET_STATUS', payload: { message: `Fetching quote for ${symbol}...`, type: 'info' } });

    try {
      const client = getAlpacaClient();
      const quote = await client.getStockQuote(symbol);

      if (quote) {
        dispatch({ type: 'SET_SYMBOL', payload: symbol });
        dispatch({ type: 'SET_STOCK_QUOTE', payload: quote });
        dispatch({ type: 'SET_STATUS', payload: { message: `✓ Quote loaded for ${symbol}`, type: 'success' } });

        // Fetch expiration dates
        const expirations = await client.getExpirationDates(symbol);
        if (expirations) {
          dispatch({ type: 'SET_AVAILABLE_EXPIRATIONS', payload: expirations.dates });
          // Switch to option chain screen
          dispatch({ type: 'SET_SCREEN', payload: 'optionChain' });
        }
      } else {
        dispatch({ type: 'SET_STATUS', payload: { message: `Failed to fetch quote for ${symbol}`, type: 'error' } });
      }
    } catch (error) {
      logger.error('Error fetching quote:', error);
      dispatch({ type: 'SET_STATUS', payload: { message: 'Error fetching quote', type: 'error' } });
    } finally {
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  }

  return null;
}

/**
 * App content component (must be inside AppProvider)
 */
function AppContent() {
  const { state } = useAppContext();
  const { optionChainFocus, highlightedIndex, showGreeks } = useNavigation();

  // Test Alpaca connection on mount
  useEffect(() => {
    const testConnection = async () => {
      try {
        const client = getAlpacaClient();
        await client.testConnection();
      } catch (error) {
        logger.error('Failed to initialize Alpaca client:', error);
      }
    };

    testConnection();
  }, []);

  return (
    <Box flexDirection="column" minHeight={20}>
      <GlobalInputHandler />

      {/* Header */}
      <Header compact />

      {/* Main content area */}
      <Box flexGrow={1} flexDirection="column">
        {state.currentScreen === 'home' && <HomeScreen />}
        {state.currentScreen === 'optionChain' && (
          <OptionChainScreen
            currentFocus={optionChainFocus}
            highlightedIndex={highlightedIndex}
            showGreeks={showGreeks}
          />
        )}
        {/* Additional screens will be added here */}
      </Box>

      {/* Keyboard shortcuts help */}
      <Box paddingX={1} marginTop={1}>
        <Box marginRight={2}>
          <Text dimColor>
            <Text bold color="cyan">s</Text> Symbol{' '}
            <Text bold color="cyan">h/?</Text> Help{' '}
            <Text bold color="cyan">q</Text> Quit
          </Text>
        </Box>
      </Box>

      {/* Status bar */}
      <StatusBar />
    </Box>
  );
}

/**
 * Main App component with providers
 */
export function App() {
  return (
    <AppProvider>
      <NavigationProvider>
        <AppContent />
      </NavigationProvider>
    </AppProvider>
  );
}
