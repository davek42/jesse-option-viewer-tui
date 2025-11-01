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
import { HelpScreen } from './screens/HelpScreen.js';
import { SettingsScreen } from './screens/SettingsScreen.js';
import { TerminalSizeWarning } from './components/TerminalSizeWarning.js';
import { StrategySelector } from './components/StrategySelector.js';
import { SaveConfirmation } from './components/SaveConfirmation.js';
import { ModeConfirmationDialog } from './components/ModeConfirmationDialog.js';
import { getAlpacaClient } from './lib/alpaca.js';
import { logger } from './utils/logger.js';
import { useTerminalSize, calculateSafeDisplayLimit } from './hooks/useTerminalSize.js';
// AIDEV-NOTE: Refactored input handlers
import { handleCommandMode } from './handlers/commandHandler.js';
import { handleInputMode } from './handlers/inputHandler.js';
import { handleHelpScreen } from './handlers/helpHandler.js';
import { handleHomeScreen } from './handlers/homeHandler.js';
import { handleSettingsScreen } from './handlers/settingsHandler.js';
import { handleSavedStrategiesScreen } from './handlers/savedStrategiesHandler.js';
import { handleOptionChainView } from './handlers/optionChainHandler.js';
import { handleSymbolDetailScreen } from './handlers/symbolDetailHandler.js';

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

// AIDEV-NOTE: All strategy helper functions have been moved to src/handlers/strategyHelpers.ts

/**
 * Global input handler component
 */
function GlobalInputHandler() {
  const { exit } = useApp();
  const { state, dispatch } = useAppContext();
  const { mode } = state;

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

    // AIDEV-NOTE: Create handler context for extracted handlers
    const handlerContext = {
      state,
      dispatch,
      exit,
      highlightedIndex,
      setHighlightedIndex,
      showGreeks,
      setShowGreeks,
    };

    // COMMAND MODE - Delegate to extracted handler
    if (mode === 'command') {
      const result = handleCommandMode(input, key, handlerContext);
      if (result.handled) return;
    }

    // INPUT MODE - Delegate to extracted handler
    if (mode === 'input') {
      const inputContext = { ...handlerContext, onSymbolEntry: handleSymbolEntry };
      const result = handleInputMode(input, key, inputContext as any);
      if (result.handled) return;
    }

    // NAVIGATION MODE

    // MODE CONFIRMATION DIALOG (Task #18) - Handle before other navigation
    if (state.showModeConfirmation) {
      if (input === 'Y' || input === 'y') {
        dispatch({ type: 'CONFIRM_MODE_SWITCH' });
        return;
      } else if (input === 'N' || input === 'n' || key.escape) {
        dispatch({ type: 'CANCEL_MODE_SWITCH' });
        return;
      }
      // While confirmation dialog is showing, ignore all other inputs
      return;
    }

    // Slash command initiation
    if (input === '/') {
      dispatch({ type: 'SET_MODE', payload: 'command' });
      dispatch({ type: 'APPEND_INPUT', payload: '/' });
      return;
    }

    // Global: Help screen (works on all screens except when in strategy builder or confirmation mode)
    if ((input === 'h' || input === '?') && !state.strategyBuilderActive && !state.showSaveConfirmation) {
      dispatch({ type: 'SET_SCREEN', payload: 'help' });
      return;
    }

    // Home screen navigation - Delegate to extracted handler
    const homeResult = handleHomeScreen(input, key, handlerContext);
    if (homeResult.handled) return;

    // Symbol Detail screen navigation - Delegate to extracted handler
    const symbolDetailResult = handleSymbolDetailScreen(input, key, handlerContext);
    if (symbolDetailResult.handled) return;

    // Option Chain View screen navigation - Delegate to extracted handler
    const optionChainResult = handleOptionChainView(input, key, handlerContext);
    if (optionChainResult.handled) return;

    // Saved Strategies screen navigation - Delegate to extracted handler
    const savedStrategiesResult = handleSavedStrategiesScreen(input, key, handlerContext);
    if (savedStrategiesResult.handled) return;

    // Help screen navigation - Delegate to extracted handler
    const helpResult = handleHelpScreen(input, key, handlerContext);
    if (helpResult.handled) return;

    // Settings screen navigation - Delegate to extracted handler
    const settingsResult = handleSettingsScreen(input, key, handlerContext);
    if (settingsResult.handled) return;
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

        // Fetch expiration dates with progress updates
        dispatch({ type: 'SET_STATUS', payload: { message: `📅 Loading expiration dates...`, type: 'info' } });

        const expirations = await client.getExpirationDates(symbol, (batchNum, totalDates, maxBatches) => {
          // Update status bar with progress
          dispatch({
            type: 'SET_STATUS',
            payload: {
              message: `📅 Loading dates... batch ${batchNum}/${maxBatches} - ${totalDates} found`,
              type: 'info',
            },
          });
        });

        if (expirations) {
          logger.debug(`📅 App.tsx: Dispatching SET_AVAILABLE_EXPIRATIONS with ${expirations.dates.length} dates: ${expirations.dates.join(', ')}`);
          dispatch({ type: 'SET_AVAILABLE_EXPIRATIONS', payload: expirations.dates });
          dispatch({ type: 'SET_STATUS', payload: { message: `✅ Loaded ${expirations.dates.length} expiration dates`, type: 'success' } });

          // Clear screen before switching to symbol detail screen
          process.stdout.write('\x1Bc');

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
      <Header compact tradingMode={state.tradingMode} />

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

        {/* Task #9: Strategy Selector Modal (show when no strategy type selected) */}
        {state.currentScreen === 'symbolDetail' && state.strategyBuilderActive && !state.selectedStrategyType && (
          <Box paddingY={1}>
            <StrategySelector
              highlightedIndex={highlightedIndex}
              onSelect={() => {
                // Selection handled by GlobalInputHandler
              }}
              onCancel={() => {
                // Cancel handled by GlobalInputHandler
              }}
            />
          </Box>
        )}

        {/* Save Confirmation Modal */}
        {state.currentScreen === 'symbolDetail' && state.strategyBuilderActive && state.showSaveConfirmation && state.strategyToSave && (
          <SaveConfirmation strategy={state.strategyToSave} />
        )}

        {/* Mode Confirmation Modal (Task #18) */}
        {state.showModeConfirmation && state.pendingModeSwitch && (
          <Box position="absolute" width="100%" height="100%" justifyContent="center" alignItems="center">
            <ModeConfirmationDialog
              currentMode={state.tradingMode}
              targetMode={state.pendingModeSwitch}
              validationWarnings={state.validationWarnings}
            />
          </Box>
        )}

        {/* Task #9: Strategy Builder Modal (show when strategy type is selected) */}
        {state.currentScreen === 'symbolDetail' && state.strategyBuilderActive && state.selectedStrategyType && !state.showSaveConfirmation && (
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

        {/* Help Screen */}
        {state.currentScreen === 'help' && <HelpScreen />}

        {/* Settings Screen */}
        {state.currentScreen === 'settings' && <SettingsScreen />}

      </Box>

      {/* Keyboard shortcuts help - Context-aware */}
      <Box paddingX={1} marginTop={1}>
        <Box marginRight={2}>
          <Text dimColor>
            {/* Home screen */}
            {state.currentScreen === 'home' && (
              <>
                <Text bold color="cyan">s</Text> Symbol{' '}
                <Text bold color="cyan">c</Text> Settings{' '}
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
                <Text bold color="cyan">h/?</Text> Help{' '}
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
                <Text bold color="cyan">h/?</Text> Help{' '}
                <Text bold color="cyan">q</Text> Back
              </>
            )}

            {/* Saved Strategies screen */}
            {state.currentScreen === 'savedStrategies' && (
              <>
                <Text bold color="cyan">↑↓/j/k</Text> Navigate{' '}
                <Text bold color="cyan">x</Text> Delete{' '}
                <Text bold color="cyan">h/?</Text> Help{' '}
                <Text bold color="cyan">q</Text> Back
              </>
            )}

            {/* Help screen */}
            {state.currentScreen === 'help' && (
              <>
                <Text bold color="cyan">q</Text> Back
              </>
            )}

            {/* Settings screen */}
            {state.currentScreen === 'settings' && (
              <>
                <Text bold color="cyan">m</Text> Switch Mode{' '}
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
