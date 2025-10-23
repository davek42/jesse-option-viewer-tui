// AIDEV-NOTE: Main application component with routing and layout

import React, { useEffect, useState } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { AppProvider, useAppContext } from './context/AppContext.js';
import { Header } from './components/Header.js';
import { StatusBar } from './components/StatusBar.js';
import { HomeScreen } from './screens/HomeScreen.js';
import { SymbolDetailScreen } from './screens/SymbolDetailScreen.js';
import { OptionChainViewScreen } from './screens/OptionChainViewScreen.js';
import { SavedStrategiesScreen } from './screens/SavedStrategiesScreen.js';
import { OptionChainScreen } from './screens/OptionChainScreen.js';
import { TerminalSizeWarning } from './components/TerminalSizeWarning.js';
import { getATMIndex } from './components/OptionChain.js';
import { getAlpacaClient } from './lib/alpaca.js';
import { logger } from './utils/logger.js';
import { useTerminalSize, calculateSafeDisplayLimit } from './hooks/useTerminalSize.js';

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
  const {
    currentScreen,
    mode,
    inputBuffer,
    currentSymbol,
    availableExpirations,
    displayLimit,
    optionChain,
  } = state;

  // Get navigation state for option chain screen
  const {
    highlightedIndex,
    showGreeks,
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
        // Execute command
        const command = state.commandBuffer.toLowerCase().trim();
        logger.debug('Command entered:', command);

        // Handle slash commands (Phase 3.3)
        if (command === '/scroll up' || command === '/up') {
          // Page up - jump 10 strikes
          if (currentScreen === 'optionChainView' && optionChain) {
            const newIndex = Math.max(0, highlightedIndex - 10);
            setHighlightedIndex(newIndex);
            dispatch({ type: 'SET_STATUS', payload: { message: 'Scrolled up 10 strikes', type: 'info' } });
          } else {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
          }
        } else if (command === '/scroll down' || command === '/down') {
          // Page down - jump 10 strikes
          if (currentScreen === 'optionChainView' && optionChain) {
            setHighlightedIndex((prev) => prev + 10);
            dispatch({ type: 'SET_STATUS', payload: { message: 'Scrolled down 10 strikes', type: 'info' } });
          } else {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
          }
        } else if (command === '/atm' || command === '/a') {
          // Jump to ATM
          if (currentScreen === 'optionChainView' && optionChain) {
            const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
            setHighlightedIndex(atmIndex);
            dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to ATM strike', type: 'success' } });
          } else {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
          }
        } else if (command === '/top' || command === '/t') {
          // Jump to top (first strike)
          if (currentScreen === 'optionChainView') {
            setHighlightedIndex(0);
            dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to top', type: 'info' } });
          } else {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
          }
        } else if (command === '/bottom' || command === '/b') {
          // Jump to bottom (last strike)
          if (currentScreen === 'optionChainView' && optionChain) {
            const displayStrikes = optionChain.calls.length > 0 ? optionChain.calls.length : 40;
            setHighlightedIndex(displayStrikes - 1);
            dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to bottom', type: 'info' } });
          } else {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Command only works in Option Chain View', type: 'warning' } });
          }
        } else if (command.startsWith('/')) {
          dispatch({ type: 'SET_STATUS', payload: { message: `Unknown command: ${command}`, type: 'error' } });
        }

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

    // Symbol Detail screen navigation
    if (currentScreen === 'symbolDetail') {
      // Navigation keys for expiration selector
      if (key.upArrow || input === 'k') {
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        const maxIndex = availableExpirations.length - 1;
        setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
      }

      // Select expiration and load option chain
      else if (key.return) {
        if (availableExpirations.length === 0) {
          dispatch({ type: 'SET_STATUS', payload: { message: 'No expirations available', type: 'warning' } });
          return;
        }

        const selectedExp = availableExpirations[highlightedIndex];
        if (!selectedExp) {
          dispatch({ type: 'SET_STATUS', payload: { message: 'Invalid expiration selection', type: 'error' } });
          return;
        }

        if (!currentSymbol) {
          dispatch({ type: 'SET_STATUS', payload: { message: 'No symbol selected', type: 'error' } });
          return;
        }

        // Set selected expiration
        dispatch({ type: 'SET_EXPIRATION', payload: selectedExp });
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({
          type: 'SET_STATUS',
          payload: { message: `Loading option chain for ${selectedExp}...`, type: 'info' },
        });

        // Load option chain asynchronously
        (async () => {
          try {
            logger.info(`📊 Loading option chain for ${currentSymbol} - ${selectedExp}`);
            const client = getAlpacaClient();
            const chain = await client.getOptionChain(currentSymbol, selectedExp);

            if (chain) {
              dispatch({ type: 'SET_OPTION_CHAIN', payload: chain });

              // Auto-center on ATM strike (Phase 3.1)
              const atmIndex = getATMIndex(chain.calls, chain.puts, chain.underlyingPrice, displayLimit);
              setHighlightedIndex(atmIndex);
              logger.info(`🎯 Auto-centered on ATM strike (index ${atmIndex})`);

              dispatch({
                type: 'SET_STATUS',
                payload: {
                  message: `✓ Loaded ${chain.calls.length} calls, ${chain.puts.length} puts`,
                  type: 'success',
                },
              });
              logger.info(`✅ Option chain loaded: ${chain.calls.length} calls, ${chain.puts.length} puts`);
            } else {
              dispatch({
                type: 'SET_STATUS',
                payload: { message: 'Failed to load option chain', type: 'error' },
              });
              logger.error('❌ Failed to load option chain: No data returned');
            }
          } catch (error) {
            logger.error('❌ Error loading option chain:', error);
            dispatch({
              type: 'SET_STATUS',
              payload: { message: 'Error loading option chain', type: 'error' },
            });
          } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
          }
        })();
      }

      // View full option chain
      else if (input === 'o') {
        if (optionChain) {
          dispatch({ type: 'SET_SCREEN', payload: 'optionChainView' });

          // Auto-center on ATM strike (Phase 3.1)
          const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
          setHighlightedIndex(atmIndex);

          dispatch({ type: 'SET_STATUS', payload: { message: 'Option Chain View', type: 'info' } });
        } else {
          dispatch({ type: 'SET_STATUS', payload: { message: 'Select an expiration date first', type: 'warning' } });
        }
      }

      // Activate strategy builder
      else if (input === 'b') {
        if (optionChain && optionChain.calls.length > 0) {
          logger.info('🏗️ Activating Bull Call Spread Builder');
          dispatch({ type: 'ACTIVATE_STRATEGY_BUILDER' });
          setHighlightedIndex(0);
          dispatch({ type: 'SET_STATUS', payload: { message: 'Bull Call Spread Builder: Select LONG call (buy)', type: 'info' } });
        } else {
          dispatch({ type: 'SET_STATUS', payload: { message: 'Load option chain first (select expiration)', type: 'warning' } });
        }
      }

      // View saved strategies
      else if (input === 'v') {
        dispatch({ type: 'SET_SCREEN', payload: 'savedStrategies' });
        setHighlightedIndex(0);
        dispatch({ type: 'SET_STATUS', payload: { message: 'Saved Strategies', type: 'info' } });
      }

      // Symbol entry
      else if (input === 's') {
        dispatch({ type: 'SET_MODE', payload: 'input' });
        dispatch({ type: 'SET_STATUS', payload: { message: 'Enter stock symbol', type: 'info' } });
      }

      // Go back to home
      else if (input === 'q') {
        // Clear screen before going back (Phase 3.3 - Fix screen overlap)
        process.stdout.write('\x1Bc');
        dispatch({ type: 'GO_BACK' });
        setHighlightedIndex(0);
      }
    }

    // Option Chain View screen navigation
    if (currentScreen === 'optionChainView') {
      // Single-line navigation
      if (key.upArrow || input === 'k') {
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        setHighlightedIndex((prev) => prev + 1);
      }

      // Jump to ATM (Phase 3.3) - 'a' key
      else if (input === 'a') {
        if (optionChain) {
          const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
          setHighlightedIndex(atmIndex);
          dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to ATM strike', type: 'success' } });
        }
      }

      // Jump to top (Phase 3.3) - Ctrl+Up
      else if (key.ctrl && key.upArrow) {
        setHighlightedIndex(0);
        dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to top', type: 'info' } });
      }

      // Jump to bottom (Phase 3.3) - Ctrl+Down
      else if (key.ctrl && key.downArrow) {
        if (optionChain) {
          // Calculate max index based on display
          const displayStrikes = optionChain.calls.length > 0 ? optionChain.calls.length : 40;
          setHighlightedIndex(displayStrikes - 1);
          dispatch({ type: 'SET_STATUS', payload: { message: 'Jumped to bottom', type: 'info' } });
        }
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

      // Go back
      else if (input === 'q') {
        // Clear screen before going back (Phase 3.3 - Fix screen overlap)
        process.stdout.write('\x1Bc');
        dispatch({ type: 'GO_BACK' });
        setHighlightedIndex(0);
      }
    }

    // Saved Strategies screen navigation
    if (currentScreen === 'savedStrategies') {
      // Navigation keys
      if (key.upArrow || input === 'k') {
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        const maxIndex = state.savedStrategies.length - 1;
        setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
      }

      // Delete strategy
      else if (input === 'x') {
        const strategy = state.savedStrategies[highlightedIndex];
        if (strategy) {
          dispatch({ type: 'REMOVE_STRATEGY', payload: strategy.id });
          dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy removed', type: 'success' } });
          // Adjust highlighted index if needed
          if (highlightedIndex >= state.savedStrategies.length - 1) {
            setHighlightedIndex(Math.max(0, state.savedStrategies.length - 2));
          }
        }
      }

      // Go back
      else if (input === 'q') {
        // Clear screen before going back (Phase 3.3 - Fix screen overlap)
        process.stdout.write('\x1Bc');
        dispatch({ type: 'GO_BACK' });
        setHighlightedIndex(0);
      }
    }

    // Legacy optionChain screen navigation (kept for backward compatibility if needed)
    // This is now handled by symbolDetail + strategy builder modal
    /*
    if (currentScreen === 'optionChain') {
      // Strategy Builder Mode
      if (strategyBuilderActive) {
        // Navigation keys
        if (key.upArrow || input === 'k') {
          setHighlightedIndex((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow || input === 'j') {
          const availableCalls = optionChain?.calls || [];
          const filteredCalls = builderStep === 'long'
            ? availableCalls
            : availableCalls.filter(call => selectedLongCall ? call.strikePrice > selectedLongCall.strikePrice : true);
          const maxIndex = Math.min(filteredCalls.length - 1, 9); // Limit to first 10
          setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
        }
        // Select option or save strategy
        else if (key.return) {
          // Save strategy if both calls are selected
          if (selectedLongCall && selectedShortCall) {
            const symbol = state.currentSymbol;
            if (symbol) {
              const strategy = createBullCallSpread(symbol, selectedLongCall, selectedShortCall, 1);
              if (strategy) {
                dispatch({ type: 'ADD_STRATEGY', payload: strategy });
                dispatch({ type: 'DEACTIVATE_STRATEGY_BUILDER' });
                setHighlightedIndex(0);
                dispatch({ type: 'SET_STATUS', payload: { message: '✓ Bull Call Spread saved!', type: 'success' } });
                logger.success(`💼 Strategy saved: ${strategy.type} for ${symbol}`);
              } else {
                dispatch({ type: 'SET_STATUS', payload: { message: 'Invalid strategy configuration', type: 'error' } });
              }
            }
          }
          // Select long or short call
          else {
            const availableCalls = optionChain?.calls || [];
            const filteredCalls = builderStep === 'long'
              ? availableCalls
              : availableCalls.filter(call => selectedLongCall ? call.strikePrice > selectedLongCall.strikePrice : true);
            const selectedCall = filteredCalls[highlightedIndex];

            if (selectedCall) {
              if (builderStep === 'long') {
                dispatch({ type: 'SET_LONG_CALL', payload: selectedCall });
                dispatch({ type: 'SET_BUILDER_STEP', payload: 'short' });
                setHighlightedIndex(0);
                dispatch({ type: 'SET_STATUS', payload: { message: 'Long call selected. Now select SHORT call (higher strike)', type: 'success' } });
              } else if (builderStep === 'short') {
                dispatch({ type: 'SET_SHORT_CALL', payload: selectedCall });
                dispatch({ type: 'SET_STATUS', payload: { message: 'Short call selected. Press Enter again to SAVE strategy', type: 'success' } });
              }
            }
          }
        }
        // Cancel builder
        else if (key.escape) {
          dispatch({ type: 'DEACTIVATE_STRATEGY_BUILDER' });
          setHighlightedIndex(0);
          dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy builder cancelled', type: 'info' } });
        }
      }
      // Normal Navigation Mode
      else {
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

        // Activate strategy builder
        else if (input === 'b') {
          if (optionChain && optionChain.calls.length > 0) {
            logger.info('🏗️ Activating Bull Call Spread Builder');
            dispatch({ type: 'ACTIVATE_STRATEGY_BUILDER' });
            setHighlightedIndex(0);
            dispatch({ type: 'SET_STATUS', payload: { message: 'Bull Call Spread Builder: Select LONG call (buy)', type: 'info' } });
          } else {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Load option chain first', type: 'warning' } });
          }
        }

        // View saved strategies
        else if (input === 'v') {
          setOptionChainFocus('expiration'); // For now, just acknowledge
          dispatch({ type: 'SET_STATUS', payload: { message: 'Saved strategies view (use ↑↓ to navigate)', type: 'info' } });
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
    }
    */
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
          // Switch to symbol detail screen
          dispatch({ type: 'SET_SCREEN', payload: 'symbolDetail' });
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
  const { state, dispatch } = useAppContext();
  const { highlightedIndex, showGreeks, setHighlightedIndex } = useNavigation();
  const terminalSize = useTerminalSize();

  // Auto-adjust display limit based on terminal size
  useEffect(() => {
    const safeLimit = calculateSafeDisplayLimit(terminalSize.rows);

    // Only update if different from current limit
    if (state.displayLimit !== safeLimit && state.displayLimit !== -1) {
      // Don't override if user explicitly set to ALL (-1)
      dispatch({ type: 'SET_DISPLAY_LIMIT', payload: safeLimit });
      logger.debug(`Auto-adjusted display limit to ${safeLimit} based on terminal size ${terminalSize.columns}x${terminalSize.rows}`);
    }
  }, [terminalSize.rows, terminalSize.columns, state.displayLimit, dispatch]);

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

      {/* Terminal size warning */}
      <TerminalSizeWarning terminalSize={terminalSize} />

      {/* Main content area */}
      <Box flexGrow={1} flexDirection="column">
        {/* Home Screen */}
        {state.currentScreen === 'home' && <HomeScreen />}

        {/* Symbol Detail Screen */}
        {state.currentScreen === 'symbolDetail' && !state.strategyBuilderActive && (
          <SymbolDetailScreen
            highlightedIndex={highlightedIndex}
            onExpirationSelect={() => {
              // Expiration selected, could auto-navigate to option chain view if desired
            }}
          />
        )}

        {/* Strategy Builder Modal (overlays Symbol Detail) */}
        {state.currentScreen === 'symbolDetail' && state.strategyBuilderActive && (
          <OptionChainScreen
            currentFocus={'expiration'}
            highlightedIndex={highlightedIndex}
            showGreeks={showGreeks}
            strategyBuilderActive={state.strategyBuilderActive}
            builderStep={state.builderStep}
            selectedLongCall={state.selectedLongCall}
            selectedShortCall={state.selectedShortCall}
            onNavigate={(direction) => {
              if (direction === 'up') {
                setHighlightedIndex((prev) => Math.max(0, prev - 1));
              } else {
                setHighlightedIndex((prev) => prev + 1);
              }
            }}
            onChangeFocus={(_focus) => {
              // Strategy builder doesn't change focus
            }}
          />
        )}

        {/* Option Chain View Screen */}
        {state.currentScreen === 'optionChainView' && (
          <OptionChainViewScreen
            highlightedRow={highlightedIndex}
            showGreeks={showGreeks}
            displayLimit={state.displayLimit}
          />
        )}

        {/* Saved Strategies Screen */}
        {state.currentScreen === 'savedStrategies' && (
          <SavedStrategiesScreen
            highlightedIndex={highlightedIndex}
            onRemove={(strategyId) => {
              dispatch({ type: 'REMOVE_STRATEGY', payload: strategyId });
            }}
          />
        )}

      </Box>

      {/* Keyboard shortcuts help - Context-aware */}
      <Box paddingX={1} marginTop={1}>
        <Box marginRight={2}>
          <Text dimColor>
            {/* Home screen */}
            {state.currentScreen === 'home' && (
              <>
                <Text bold color="cyan">s</Text> Symbol{' '}
                <Text bold color="cyan">h/?</Text> Help{' '}
                <Text bold color="cyan">q</Text> Quit
              </>
            )}

            {/* Symbol Detail screen */}
            {state.currentScreen === 'symbolDetail' && !state.strategyBuilderActive && (
              <>
                <Text bold color="cyan">o</Text> Option Chain{' '}
                <Text bold color="cyan">b</Text> Build Strategy{' '}
                <Text bold color="cyan">v</Text> Strategies{' '}
                <Text bold color="cyan">s</Text> Symbol{' '}
                <Text bold color="cyan">q</Text> Back
              </>
            )}

            {/* Strategy Builder (modal) */}
            {state.strategyBuilderActive && (
              <>
                <Text bold color="cyan">↑↓/j/k</Text> Navigate{' '}
                <Text bold color="cyan">Enter</Text> Select{' '}
                <Text bold color="cyan">Esc</Text> Cancel
              </>
            )}

            {/* Option Chain View screen */}
            {state.currentScreen === 'optionChainView' && (
              <>
                <Text bold color="cyan">↑↓/j/k</Text> Navigate{' '}
                <Text bold color="cyan">l</Text> Limit{' '}
                <Text bold color="cyan">g</Text> Greeks{' '}
                <Text bold color="cyan">q</Text> Back
              </>
            )}

            {/* Saved Strategies screen */}
            {state.currentScreen === 'savedStrategies' && (
              <>
                <Text bold color="cyan">↑↓/j/k</Text> Navigate{' '}
                <Text bold color="cyan">x</Text> Delete{' '}
                <Text bold color="cyan">q</Text> Back
              </>
            )}
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
