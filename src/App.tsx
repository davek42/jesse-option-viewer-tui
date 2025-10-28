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
import { getATMIndex } from './components/OptionChain.js';
import { getAlpacaClient } from './lib/alpaca.js';
import { logger } from './utils/logger.js';
import { useTerminalSize, calculateSafeDisplayLimit } from './hooks/useTerminalSize.js';
import {
  createBullCallSpread,
  createBearPutSpread,
  createBullPutSpread,
  createBearCallSpread,
  createLongStraddle,
  createIronCondor,
  createCoveredCall,
  createDiagonalCallSpread
} from './utils/strategies.js';
import type { StrategyType, OptionContract, OptionStrategy, AppAction } from './types/index.js';

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

// AIDEV-NOTE: Task #9 - Strategy building helper functions

/**
 * Check if a step shows all (unfiltered) options - should center on ATM
 */
function shouldCenterOnATM(strategyType: StrategyType, step: string): boolean {
  switch (strategyType) {
    case 'bull_call_spread':
      return step === 'long'; // leg1 shows all calls
    case 'diagonal_call_spread':
      return step === 'leg1'; // leg1 shows all calls
    case 'bear_put_spread':
      return step === 'leg1'; // leg1 shows all puts
    case 'bull_put_spread':
      return step === 'leg1'; // leg1 shows all puts (buy lower strike)
    case 'bear_call_spread':
      return step === 'leg1'; // leg1 shows all calls (buy higher strike)
    case 'long_straddle':
      return step === 'leg1'; // leg1 shows all calls
    case 'iron_condor':
      return step === 'leg1' || step === 'leg3'; // leg1 shows all puts, leg3 shows all calls
    case 'covered_call':
      return true; // shows all calls
    default:
      return false;
  }
}

/**
 * Get the previous step when undoing a leg selection
 */
function getPreviousStep(
  strategyType: StrategyType,
  currentStep: string,
  selectedLegsCount: number
): string | null {
  // If no legs selected yet, can't go back
  if (selectedLegsCount === 0) {
    return null;
  }

  // For bull_call_spread (uses 'long'/'short' instead of leg1/leg2)
  if (strategyType === 'bull_call_spread') {
    if (currentStep === 'short') return 'long';
    return null; // Can't go back from 'long'
  }

  // For other strategies using leg1, leg2, leg3, leg4
  const legMatch = currentStep.match(/leg(\d+)/);
  if (legMatch && legMatch[1]) {
    const currentLegNum = parseInt(legMatch[1], 10);
    if (currentLegNum > 1) {
      return `leg${currentLegNum - 1}`;
    }
  }

  return null; // Can't go back from leg1
}

/**
 * Get available options for the current step based on strategy type
 *
 * For diagonal spreads, this function needs access to state to get leg-specific option chains
 */
function getAvailableOptionsForStep(
  strategyType: StrategyType,
  step: string,
  calls: OptionContract[],
  puts: OptionContract[],
  selectedLongCall: OptionContract | null,
  selectedLegs: OptionContract[],
  leg1OptionChain?: { calls: OptionContract[]; puts: OptionContract[] } | null,
  leg2OptionChain?: { calls: OptionContract[]; puts: OptionContract[] } | null
): OptionContract[] {
  switch (strategyType) {
    case 'bull_call_spread':
      // Step 1 (long): All calls | Step 2 (short): Higher strike calls
      return step === 'long'
        ? calls
        : calls.filter(c => selectedLongCall ? c.strikePrice > selectedLongCall.strikePrice : true);

    case 'diagonal_call_spread':
      // Use leg-specific option chains for diagonal spreads
      if (step === 'leg1') {
        // Leg 1: Use leg1OptionChain (longer expiration)
        return leg1OptionChain?.calls || [];
      } else if (step === 'leg2') {
        // Leg 2: Use leg2OptionChain (shorter expiration), filter for higher strikes
        const leg2Calls = leg2OptionChain?.calls || [];
        const leg1 = selectedLegs[0];
        return leg1
          ? leg2Calls.filter((c: OptionContract) => c.strikePrice > leg1.strikePrice)
          : leg2Calls;
      }
      return [];

    case 'bear_put_spread':
      // Step 1 (leg1): All puts | Step 2 (leg2): Lower strike puts
      return step === 'leg1'
        ? puts
        : puts.filter(p => selectedLegs[0] ? p.strikePrice < selectedLegs[0].strikePrice : true);

    case 'bull_put_spread':
      // Credit spread: Step 1 (leg1): All puts (buy lower) | Step 2 (leg2): Higher strike puts (sell)
      return step === 'leg1'
        ? puts
        : puts.filter(p => selectedLegs[0] ? p.strikePrice > selectedLegs[0].strikePrice : true);

    case 'bear_call_spread':
      // Credit spread: Step 1 (leg1): All calls (buy higher) | Step 2 (leg2): Lower strike calls (sell)
      return step === 'leg1'
        ? calls
        : calls.filter(c => selectedLegs[0] ? c.strikePrice < selectedLegs[0].strikePrice : true);

    case 'long_straddle':
      // Step 1 (leg1): All calls | Step 2 (leg2): Puts with same strike as selected call
      if (step === 'leg1') {
        return calls;
      } else {
        const selectedCall = selectedLegs.find(leg => leg.optionType === 'call');
        return selectedCall
          ? puts.filter(p => p.strikePrice === selectedCall.strikePrice)
          : puts;
      }

    case 'iron_condor':
      // 4 legs: Buy low put, Sell higher put, Sell lower call, Buy high call
      // Note: Puts and calls are on opposite sides of stock price, so we can't compare put strikes to call strikes
      if (step === 'leg1') return puts; // Buy OTM put (lowest)
      if (step === 'leg2') {
        // Sell put: must be higher strike than leg 1 (the long put)
        return puts.filter(p => selectedLegs[0] ? p.strikePrice > selectedLegs[0].strikePrice : true);
      }
      if (step === 'leg3') {
        // Sell call: just show all calls (user will choose OTM call above stock price)
        // Can't compare to put strikes from legs 1-2
        return calls;
      }
      if (step === 'leg4') {
        // Buy call: must be higher strike than leg 3 (the short call)
        const shortCall = selectedLegs[2];
        return shortCall ? calls.filter(c => c.strikePrice > shortCall.strikePrice) : calls;
      }
      return [];

    case 'covered_call':
      // Just need to select one OTM call
      return calls;

    default:
      return calls;
  }
}

/**
 * Check if strategy is complete and ready to save
 */
function isStrategyComplete(
  strategyType: StrategyType,
  selectedLongCall: OptionContract | null,
  selectedShortCall: OptionContract | null,
  selectedLegs: OptionContract[]
): boolean {
  switch (strategyType) {
    case 'bull_call_spread':
      return selectedLongCall !== null && selectedShortCall !== null;

    case 'diagonal_call_spread':
      return selectedLegs.length === 2;

    case 'bear_put_spread':
      return selectedLegs.length === 2;

    case 'bull_put_spread':
      return selectedLegs.length === 2;

    case 'bear_call_spread':
      return selectedLegs.length === 2;

    case 'long_straddle':
      return selectedLegs.length === 2;

    case 'iron_condor':
      return selectedLegs.length === 4;

    case 'covered_call':
      return selectedLegs.length === 1 || selectedLongCall !== null;

    default:
      return false;
  }
}

/**
 * Create strategy using the appropriate create function
 */
function createStrategyByType(
  strategyType: StrategyType,
  symbol: string,
  selectedLongCall: OptionContract | null,
  selectedShortCall: OptionContract | null,
  selectedLegs: OptionContract[],
  stockPrice: number
): OptionStrategy | null {
  switch (strategyType) {
    case 'bull_call_spread':
      return selectedLongCall && selectedShortCall
        ? createBullCallSpread(symbol, selectedLongCall, selectedShortCall, 1)
        : null;

    case 'diagonal_call_spread': {
      const [longCall, shortCall] = selectedLegs;
      return longCall && shortCall
        ? createDiagonalCallSpread(symbol, longCall, shortCall, 1)
        : null;
    }

    case 'bear_put_spread': {
      const [longPut, shortPut] = selectedLegs;
      return longPut && shortPut
        ? createBearPutSpread(symbol, longPut, shortPut, 1)
        : null;
    }

    case 'bull_put_spread': {
      const [longPut, shortPut] = selectedLegs;
      return longPut && shortPut
        ? createBullPutSpread(symbol, longPut, shortPut, 1)
        : null;
    }

    case 'bear_call_spread': {
      const [longCall, shortCall] = selectedLegs;
      return longCall && shortCall
        ? createBearCallSpread(symbol, longCall, shortCall, 1)
        : null;
    }

    case 'long_straddle': {
      const call = selectedLegs.find(leg => leg.optionType === 'call');
      const put = selectedLegs.find(leg => leg.optionType === 'put');
      return call && put
        ? createLongStraddle(symbol, call, put, 1)
        : null;
    }

    case 'iron_condor': {
      const [leg1, leg2, leg3, leg4] = selectedLegs;
      // AIDEV-NOTE: selectedLegs order: [longPut, shortPut, shortCall, longCall]
      // createIronCondor expects: (symbol, longCall, shortCall, shortPut, longPut, quantity)
      return leg1 && leg2 && leg3 && leg4
        ? createIronCondor(symbol, leg4, leg3, leg2, leg1, 1)  // Reorder parameters
        : null;
    }

    case 'covered_call': {
      const call = selectedLegs[0] || selectedLongCall;
      return call
        ? createCoveredCall(symbol, call, stockPrice, 1)
        : null;
    }

    default:
      return null;
  }
}

/**
 * Get initial instruction message when strategy builder opens
 */
function getInitialStrategyMessage(strategyType: StrategyType): string {
  switch (strategyType) {
    case 'bull_call_spread':
      return 'Select LONG CALL (Buy) - Choose ATM or slightly OTM strike';

    case 'diagonal_call_spread':
      return 'Step 1: Select LONGER expiration for leg 1 (long call)';

    case 'bear_put_spread':
      return 'Select LONG PUT (Buy) - Choose higher strike put';

    case 'bull_put_spread':
      return 'Select LONG PUT (Buy) - Choose lower strike put for protection';

    case 'bear_call_spread':
      return 'Select LONG CALL (Buy) - Choose higher strike call for protection';

    case 'long_straddle':
      return 'Select ATM CALL (Buy) - Choose at-the-money strike';

    case 'iron_condor':
      return 'Select leg 1: BUY OTM PUT (lowest strike) - Start with furthest OTM put';

    case 'covered_call':
      return 'Select OTM CALL (Sell) - Assumes you own 100 shares. Choose higher strike to cap gains';

    default:
      return 'Select first option for this strategy';
  }
}

/**
 * Get strategy-specific status message for leg selection
 */
function getSelectionStatusMessage(
  strategyType: StrategyType,
  legNumber: number,
  strikePrice: number,
  isComplete: boolean
): string {
  const strike = `$${strikePrice.toFixed(2)}`;

  if (isComplete) {
    return 'All legs selected. Press Enter to SAVE strategy';
  }

  switch (strategyType) {
    case 'bear_put_spread':
      if (legNumber === 1) {
        return `✓ LONG PUT (Buy) at ${strike} selected. Now select SHORT PUT (Sell - lower strike)`;
      }
      return `✓ SHORT PUT (Sell) at ${strike} selected. Press Enter to SAVE strategy`;

    case 'bull_put_spread':
      if (legNumber === 1) {
        return `✓ LONG PUT (Buy) at ${strike} selected. Now select SHORT PUT (Sell - higher strike for credit)`;
      }
      return `✓ SHORT PUT (Sell) at ${strike} selected. Press Enter to SAVE strategy`;

    case 'bear_call_spread':
      if (legNumber === 1) {
        return `✓ LONG CALL (Buy) at ${strike} selected. Now select SHORT CALL (Sell - lower strike for credit)`;
      }
      return `✓ SHORT CALL (Sell) at ${strike} selected. Press Enter to SAVE strategy`;

    case 'long_straddle':
      if (legNumber === 1) {
        return `✓ ATM CALL at ${strike} selected. Now select ATM PUT (same strike: ${strike})`;
      }
      return `✓ ATM PUT at ${strike} selected. Press Enter to SAVE strategy`;

    case 'iron_condor':
      if (legNumber === 1) {
        return `✓ BUY OTM PUT (lowest) at ${strike}. Select leg 2: SELL PUT (higher strike than ${strike})`;
      } else if (legNumber === 2) {
        return `✓ SELL PUT at ${strike}. Select leg 3: SELL CALL (choose OTM call above stock price)`;
      } else if (legNumber === 3) {
        return `✓ SELL CALL at ${strike}. Select leg 4: BUY OTM CALL (higher strike than ${strike})`;
      }
      return `✓ BUY OTM CALL at ${strike} selected. Press Enter to SAVE strategy`;

    case 'covered_call':
      return `✓ OTM CALL at ${strike} selected. Press Enter to SAVE (assumes you own 100 shares)`;

    default:
      return `Leg ${legNumber} selected. Select leg ${legNumber + 1}`;
  }
}

/**
 * Handle option selection and update state accordingly
 */
function handleOptionSelection(
  strategyType: StrategyType,
  step: string,
  selectedOption: OptionContract,
  dispatch: React.Dispatch<AppAction>,
  setHighlightedIndex: (index: number | ((prev: number) => number)) => void,
  optionChain?: { calls: OptionContract[]; puts: OptionContract[]; underlyingPrice: number } | null,
  displayLimit?: number
): void {
  // Defensive validation - ensure selectedOption is a valid OptionContract
  if (!selectedOption || typeof selectedOption.strikePrice !== 'number') {
    logger.error(`❌ Invalid OptionContract in handleOptionSelection: ${JSON.stringify(selectedOption)}`);
    logger.error(`   strategyType=${strategyType}, step=${step}`);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Error: Invalid option contract', type: 'error' } });
    return;
  }

  // Bull Call Spread uses legacy longCall/shortCall state
  if (strategyType === 'bull_call_spread') {
    if (step === 'long') {
      dispatch({ type: 'SET_LONG_CALL', payload: selectedOption });
      dispatch({ type: 'SET_BUILDER_STEP', payload: 'short' });
      setHighlightedIndex(0);
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ LONG CALL (Buy) at $${selectedOption.strikePrice.toFixed(2)} selected. Now select SHORT CALL (Sell - higher strike)`, type: 'success' } });
    } else if (step === 'short') {
      dispatch({ type: 'SET_SHORT_CALL', payload: selectedOption });
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ SHORT CALL (Sell) at $${selectedOption.strikePrice.toFixed(2)} selected. Press Enter to SAVE strategy`, type: 'success' } });
    }
    return;
  }

  // All other strategies use selectedLegs array
  dispatch({ type: 'ADD_LEG', payload: selectedOption });

  // Special handling for diagonal spreads
  if (strategyType === 'diagonal_call_spread') {
    if (step === 'leg1') {
      // After selecting leg 1, go to expiration selection for leg 2
      dispatch({ type: 'SET_BUILDER_STEP', payload: 'expiration2' });
      setHighlightedIndex(0);
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 1 (Long Call) at $${selectedOption.strikePrice.toFixed(2)} selected. Now select SHORTER expiration for leg 2`, type: 'success' } });
      return;
    } else if (step === 'leg2') {
      // Leg 2 selected, strategy is complete
      dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 2 (Short Call) at $${selectedOption.strikePrice.toFixed(2)} selected. Press Enter to SAVE strategy`, type: 'success' } });
      return;
    }
  }

  // Determine next step
  const legNumber = parseInt(step.replace('leg', ''));
  const totalLegs = getLegCountForStrategy(strategyType);
  const isComplete = legNumber >= totalLegs;

  if (!isComplete) {
    const nextStep = `leg${legNumber + 1}` as 'leg1' | 'leg2' | 'leg3' | 'leg4';
    dispatch({ type: 'SET_BUILDER_STEP', payload: nextStep });

    // Center on ATM if next leg shows all options
    if (shouldCenterOnATM(strategyType, nextStep) && optionChain && displayLimit !== undefined) {
      const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
      setHighlightedIndex(atmIndex);
    } else {
      setHighlightedIndex(0);
    }
  }

  // Set strategy-specific status message
  const message = getSelectionStatusMessage(strategyType, legNumber, selectedOption.strikePrice, isComplete);
  dispatch({ type: 'SET_STATUS', payload: { message, type: 'success' } });
}

/**
 * Handle expiration selection for diagonal spreads
 * Loads option chain for the selected expiration and transitions to next step
 */
async function handleExpirationSelectionForDiagonal(
  selectedExpiration: string,
  currentStep: 'expiration1' | 'expiration2',
  currentSymbol: string,
  dispatch: React.Dispatch<AppAction>,
  setHighlightedIndex: (index: number) => void
): Promise<void> {

  try {
    dispatch({ type: 'SET_LOADING', payload: true });

    // Fetch option chain for the selected expiration
    const client = getAlpacaClient();
    const chain = await client.getOptionChain(currentSymbol, selectedExpiration);

    if (chain) {
      if (currentStep === 'expiration1') {
        // Save leg 1 expiration and option chain
        dispatch({ type: 'SET_LEG1_EXPIRATION', payload: selectedExpiration });
        dispatch({ type: 'SET_LEG1_OPTION_CHAIN', payload: chain });
        dispatch({ type: 'SET_BUILDER_STEP', payload: 'leg1' });
        dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 1 expiration: ${selectedExpiration}. Select LONG CALL (lower strike)`, type: 'success' } });
        logger.info(`📅 Leg 1 expiration selected: ${selectedExpiration}`);
      } else {
        // Save leg 2 expiration and option chain
        dispatch({ type: 'SET_LEG2_EXPIRATION', payload: selectedExpiration });
        dispatch({ type: 'SET_LEG2_OPTION_CHAIN', payload: chain });
        dispatch({ type: 'SET_BUILDER_STEP', payload: 'leg2' });
        dispatch({ type: 'SET_STATUS', payload: { message: `✓ Leg 2 expiration: ${selectedExpiration}. Select SHORT CALL (higher strike)`, type: 'success' } });
        logger.info(`📅 Leg 2 expiration selected: ${selectedExpiration}`);
      }

      setHighlightedIndex(0);
    } else {
      dispatch({ type: 'SET_STATUS', payload: { message: 'Failed to load option chain', type: 'error' } });
    }
  } catch (error) {
    logger.error('Error loading option chain for diagonal spread:', error);
    dispatch({ type: 'SET_STATUS', payload: { message: 'Error loading option chain', type: 'error' } });
  } finally {
    dispatch({ type: 'SET_LOADING', payload: false });
  }
}

/**
 * Get total number of legs for a strategy type
 */
function getLegCountForStrategy(strategyType: StrategyType): number {
  switch (strategyType) {
    case 'bull_call_spread':
    case 'diagonal_call_spread':
    case 'bear_put_spread':
    case 'bull_put_spread':
    case 'bear_call_spread':
    case 'long_straddle':
      return 2;
    case 'iron_condor':
      return 4;
    case 'covered_call':
      return 1;
    default:
      return 2;
  }
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
        } else if (command === '/help' || command === '/h' || command === '/?') {
          // Show help screen (global command)
          dispatch({ type: 'SET_SCREEN', payload: 'help' });
          dispatch({ type: 'SET_STATUS', payload: { message: 'Showing help screen', type: 'info' } });
        } else if (command === '/settings' || command === '/config') {
          // Show settings screen (Task #18)
          dispatch({ type: 'SET_SCREEN', payload: 'settings' });
          dispatch({ type: 'SET_STATUS', payload: { message: 'Showing settings screen', type: 'info' } });
        } else if (command === '/paper') {
          // Switch to paper mode (Task #18)
          if (state.tradingMode === 'paper') {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Already in PAPER mode', type: 'info' } });
          } else {
            dispatch({ type: 'REQUEST_MODE_SWITCH', payload: 'paper' });
          }
        } else if (command === '/live') {
          // Switch to live mode (Task #18)
          if (!state.liveCredentialsConfigured) {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Live credentials not configured', type: 'error' } });
          } else if (state.tradingMode === 'live') {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Already in LIVE mode', type: 'info' } });
          } else {
            dispatch({ type: 'REQUEST_MODE_SWITCH', payload: 'live' });
          }
        } else if (command === '/mode') {
          // Toggle mode (Task #18)
          const targetMode = state.tradingMode === 'paper' ? 'live' : 'paper';
          if (targetMode === 'live' && !state.liveCredentialsConfigured) {
            dispatch({ type: 'SET_STATUS', payload: { message: 'Live credentials not configured', type: 'error' } });
          } else {
            dispatch({ type: 'REQUEST_MODE_SWITCH', payload: targetMode });
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

    // Home screen navigation
    if (currentScreen === 'home') {
      if (input === 's') {
        dispatch({ type: 'SET_MODE', payload: 'input' });
        dispatch({ type: 'SET_STATUS', payload: { message: 'Enter stock symbol', type: 'info' } });
      } else if (input === 'c') {
        // Settings (Task #18)
        dispatch({ type: 'SET_SCREEN', payload: 'settings' });
      } else if (input === 'q') {
        logger.info('👋 Exiting application...');
        exit();
      }
    }

    // Symbol Detail screen navigation
    if (currentScreen === 'symbolDetail') {
      // Strategy Builder Mode - Handle input when builder is active
      if (state.strategyBuilderActive) {
        // Save Confirmation Mode - Handle confirmation before saving
        if (state.showSaveConfirmation) {
          if (key.return) {
            // Confirm and save strategy
            dispatch({ type: 'CONFIRM_SAVE_STRATEGY' });
            setHighlightedIndex(0);
            dispatch({ type: 'SET_STATUS', payload: { message: `✓ Strategy saved!`, type: 'success' } });
            logger.success(`💼 Strategy confirmed and saved`);
          } else if (key.escape || input === 'q') {
            // Cancel save
            dispatch({ type: 'HIDE_SAVE_CONFIRMATION' });
            dispatch({ type: 'SET_STATUS', payload: { message: 'Save cancelled', type: 'info' } });
            logger.info(`❌ Save cancelled by user`);
          }
          return; // Don't process other inputs while in confirmation mode
        }

        // Task #9: Strategy Selection Mode (no strategy type selected yet)
        if (!state.selectedStrategyType) {
          // Navigate strategy selector
          if (key.upArrow || input === 'k') {
            setHighlightedIndex((prev) => Math.max(0, prev - 1));
          } else if (key.downArrow || input === 'j') {
            // 8 available strategies (0-7)
            setHighlightedIndex((prev) => Math.min(7, prev + 1));
          }
          // Select strategy type
          else if (key.return) {
            const strategies: StrategyType[] = ['bull_call_spread', 'bear_put_spread', 'bull_put_spread', 'bear_call_spread', 'diagonal_call_spread', 'iron_condor', 'long_straddle', 'covered_call'];
            const selectedType = strategies[highlightedIndex];
            if (selectedType) {
              dispatch({ type: 'SET_STRATEGY_TYPE', payload: selectedType });

              // Set initial highlighted index
              if (selectedType === 'diagonal_call_spread') {
                // For diagonal spreads, start at first expiration
                setHighlightedIndex(0);
              } else {
                // Center on ATM for leg1 if showing all options
                const firstStep = selectedType === 'bull_call_spread' ? 'long' : 'leg1';
                if (shouldCenterOnATM(selectedType, firstStep) && optionChain) {
                  const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
                  setHighlightedIndex(atmIndex);
                } else {
                  setHighlightedIndex(0);
                }
              }

              logger.info(`📋 Selected strategy type: ${selectedType}`);
              // Show initial instruction message
              const initialMessage = getInitialStrategyMessage(selectedType);
              dispatch({ type: 'SET_STATUS', payload: { message: initialMessage, type: 'info' } });
            }
          }
          // Cancel strategy selection
          else if (key.escape || input === 'q') {
            dispatch({ type: 'DEACTIVATE_STRATEGY_BUILDER' });
            setHighlightedIndex(0);
            dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy builder cancelled', type: 'info' } });
          }

          // Don't process other inputs in strategy selection mode
          return;
        }

        // Task #9: Strategy Building Mode (strategy type is selected)
        // Navigation keys - allow scrolling through all available options
        if (key.upArrow || input === 'k') {
          setHighlightedIndex((prev) => Math.max(0, prev - 1));
        } else if (key.downArrow || input === 'j') {
          // For expiration selection, use availableExpirations instead of options
          let maxIndex: number;
          if (state.builderStep === 'expiration1' || state.builderStep === 'expiration2') {
            maxIndex = availableExpirations.length - 1;
          } else {
            // Get available options based on strategy type and step
            const availableOptions = getAvailableOptionsForStep(
              state.selectedStrategyType!,
              state.builderStep,
              optionChain?.calls || [],
              optionChain?.puts || [],
              state.selectedLongCall,
              state.selectedLegs,
              state.leg1OptionChain,
              state.leg2OptionChain
            );
            maxIndex = availableOptions.length - 1; // Allow scrolling through all options

            // Debug logging for Iron Condor filtering issues
            if (state.selectedStrategyType === 'iron_condor' && (state.builderStep === 'leg2' || state.builderStep === 'leg4')) {
              const totalCalls = optionChain?.calls.length || 0;
              const totalPuts = optionChain?.puts.length || 0;
              const optionType = state.builderStep === 'leg2' ? 'puts' : 'calls';
              const totalOptions = state.builderStep === 'leg2' ? totalPuts : totalCalls;
              logger.debug(`Iron Condor ${state.builderStep}: ${availableOptions.length} options available (${totalOptions} total ${optionType}), maxIndex=${maxIndex}, currentIndex=${highlightedIndex}`);
              if (availableOptions.length > 0) {
                logger.debug(`First strike: ${availableOptions[0]?.strikePrice}, Last strike: ${availableOptions[availableOptions.length - 1]?.strikePrice}`);
              }
              // Show what was selected in previous legs
              if (state.builderStep === 'leg2' && state.selectedLegs[0]) {
                logger.debug(`Leg 1 (buy put) was: ${state.selectedLegs[0].strikePrice}, filtering for puts > ${state.selectedLegs[0].strikePrice}`);
              }
              if (state.builderStep === 'leg4' && state.selectedLegs[2]) {
                logger.debug(`Leg 3 (short call) was: ${state.selectedLegs[2].strikePrice}, filtering for calls > ${state.selectedLegs[2].strikePrice}`);
                // Also show what the total call range is
                if (optionChain?.calls && optionChain.calls.length > 0) {
                  const allCallStrikes = optionChain.calls.map(c => c.strikePrice).sort((a, b) => a - b);
                  logger.debug(`All available call strikes range: ${allCallStrikes[0]} to ${allCallStrikes[allCallStrikes.length - 1]}`);
                }
              }
            }
          }

          setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
        }

        // Undo last leg selection with 'x' or 'd'
        else if (input === 'x' || input === 'd') {
          const previousStep = getPreviousStep(state.selectedStrategyType!, state.builderStep, state.selectedLegs.length);

          if (previousStep) {
            // Remove the last leg
            dispatch({ type: 'REMOVE_LAST_LEG' });

            // Also clear longCall/shortCall if using bull_call_spread
            if (state.selectedStrategyType === 'bull_call_spread' && state.builderStep === 'short') {
              dispatch({ type: 'SET_SHORT_CALL', payload: null });
            }

            // Go back to previous step
            dispatch({ type: 'SET_BUILDER_STEP', payload: previousStep as 'long' | 'short' | 'leg1' | 'leg2' | 'leg3' | 'leg4' });
            setHighlightedIndex(0);
            dispatch({ type: 'SET_STATUS', payload: { message: `Undid leg selection, back to ${previousStep}`, type: 'info' } });
            logger.info(`🔙 Undid leg selection, back to ${previousStep}`);
          } else {
            dispatch({ type: 'SET_STATUS', payload: { message: 'No leg to undo', type: 'warning' } });
          }
        }

        // Select option or save strategy
        else if (key.return) {
          // Handle expiration selection for diagonal spreads
          if (state.builderStep === 'expiration1' || state.builderStep === 'expiration2') {
            const selectedExpiration = availableExpirations[highlightedIndex];
            logger.debug(`📅 Expiration selection: step=${state.builderStep}, selectedExpiration=${selectedExpiration}, highlightedIndex=${highlightedIndex}`);
            if (selectedExpiration && currentSymbol) {
              // Load option chain for the selected expiration
              handleExpirationSelectionForDiagonal(selectedExpiration, state.builderStep, currentSymbol, dispatch, setHighlightedIndex);
            } else {
              logger.warning(`❌ Cannot select expiration: selectedExpiration=${selectedExpiration}, currentSymbol=${currentSymbol}`);
            }
            return;
          }

          // Check if strategy is complete and ready to save
          const isComplete = isStrategyComplete(state.selectedStrategyType!, state.selectedLongCall, state.selectedShortCall, state.selectedLegs);

          if (isComplete && currentSymbol) {
            // Save the strategy
            const strategy = createStrategyByType(
              state.selectedStrategyType!,
              currentSymbol,
              state.selectedLongCall,
              state.selectedShortCall,
              state.selectedLegs,
              state.stockQuote?.price || 0
            );

            if (strategy) {
              // Show confirmation prompt instead of saving directly
              dispatch({ type: 'SHOW_SAVE_CONFIRMATION', payload: strategy });
              dispatch({ type: 'SET_STATUS', payload: { message: 'Review strategy and press Enter to save, or Esc to cancel', type: 'info' } });
              logger.info(`📋 Showing save confirmation for ${strategy.type}`);
            } else {
              dispatch({ type: 'SET_STATUS', payload: { message: 'Invalid strategy configuration', type: 'error' } });
            }
          }
          // Select option for current step
          else {
            const availableOptions = getAvailableOptionsForStep(
              state.selectedStrategyType!,
              state.builderStep,
              optionChain?.calls || [],
              optionChain?.puts || [],
              state.selectedLongCall,
              state.selectedLegs,
              state.leg1OptionChain,
              state.leg2OptionChain
            );
            const selectedOption = availableOptions[highlightedIndex];

            logger.debug(`🎯 Option selection: step=${state.builderStep}, highlightedIndex=${highlightedIndex}, availableOptions=${availableOptions.length}, selectedOption=${selectedOption ? 'valid' : 'undefined'}`);

            if (selectedOption) {
              // Validate that selectedOption is an OptionContract
              if (!selectedOption.strikePrice || typeof selectedOption.strikePrice !== 'number') {
                logger.error(`❌ Invalid selectedOption: ${JSON.stringify(selectedOption)}`);
                dispatch({ type: 'SET_STATUS', payload: { message: 'Error: Invalid option selected', type: 'error' } });
                return;
              }

              // Handle selection based on strategy type
              handleOptionSelection(
                state.selectedStrategyType!,
                state.builderStep,
                selectedOption,
                dispatch,
                setHighlightedIndex,
                optionChain,
                displayLimit
              );
            }
          }
        }

        // Jump to specific leg with number keys (1-4) - only for multi-leg strategies
        else if (input && ['1', '2', '3', '4'].includes(input)) {
          const legNum = parseInt(input);
          const legName = `leg${legNum}` as 'leg1' | 'leg2' | 'leg3' | 'leg4';
          const totalLegs = getLegCountForStrategy(state.selectedStrategyType!);

          // Only allow jumping to valid legs for this strategy
          if (legNum <= totalLegs) {
            // For diagonal spreads, prevent jumping to legs before expiration is selected
            if (state.selectedStrategyType === 'diagonal_call_spread') {
              if (legName === 'leg1' && !state.leg1OptionChain) {
                dispatch({ type: 'SET_STATUS', payload: { message: 'Please select expiration for leg 1 first', type: 'warning' } });
                return;
              }
              if (legName === 'leg2' && !state.leg2OptionChain) {
                dispatch({ type: 'SET_STATUS', payload: { message: 'Please select expiration for leg 2 first', type: 'warning' } });
                return;
              }
            }

            dispatch({ type: 'SET_BUILDER_STEP', payload: legName });

            // Center on ATM if this leg shows all options
            if (shouldCenterOnATM(state.selectedStrategyType!, legName) && optionChain) {
              const atmIndex = getATMIndex(optionChain.calls, optionChain.puts, optionChain.underlyingPrice, displayLimit);
              setHighlightedIndex(atmIndex);
            } else {
              setHighlightedIndex(0);
            }

            dispatch({ type: 'SET_STATUS', payload: { message: `Jumped to leg ${legNum}`, type: 'info' } });
          }
        }

        // Cancel builder
        else if (key.escape || input === 'q') {
          dispatch({ type: 'DEACTIVATE_STRATEGY_BUILDER' });
          setHighlightedIndex(0);
          dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy builder cancelled', type: 'info' } });
        }

        // Don't process other inputs in builder mode
        return;
      }

      // Normal Mode - Navigation keys for expiration selector
      if (key.upArrow || input === 'k') {
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        const maxIndex = availableExpirations.length - 1;
        setHighlightedIndex((prev) => Math.min(maxIndex, prev + 1));
      }
      // 'K' - Jump up 10 items (Phase 2)
      else if (input === 'K') {
        setHighlightedIndex((prev) => Math.max(0, prev - 10));
        dispatch({ type: 'SET_STATUS', payload: { message: '⬆️  Jumped up 10 expirations', type: 'info' } });
      }
      // 'J' - Jump down 10 items (Phase 2)
      else if (input === 'J') {
        const maxIndex = availableExpirations.length - 1;
        setHighlightedIndex((prev) => Math.min(maxIndex, prev + 10));
        dispatch({ type: 'SET_STATUS', payload: { message: '⬇️  Jumped down 10 expirations', type: 'info' } });
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

      // Activate strategy builder (Task #9 - Show strategy selector first)
      else if (input === 'b') {
        if (optionChain && optionChain.calls.length > 0) {
          logger.info('🏗️ Activating Strategy Builder - Choose strategy type');
          dispatch({ type: 'ACTIVATE_STRATEGY_BUILDER' }); // No strategy type yet - will show selector
          setHighlightedIndex(0);
          dispatch({ type: 'SET_STATUS', payload: { message: 'Strategy Builder: Choose strategy type', type: 'info' } });
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
      // Calculate total strikes for boundary checking
      const totalStrikes = optionChain
        ? [...new Set([...optionChain.calls.map(c => c.strikePrice), ...optionChain.puts.map(p => p.strikePrice)])].length
        : 0;

      // Single-line navigation
      if (key.upArrow || input === 'k') {
        setHighlightedIndex((prev) => Math.max(0, prev - 1));
      } else if (key.downArrow || input === 'j') {
        setHighlightedIndex((prev) => Math.min(totalStrikes - 1, prev + 1));
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

    // Help screen navigation
    if (currentScreen === 'help') {
      // Go back
      if (input === 'q') {
        dispatch({ type: 'GO_BACK' });
      }
    }

    // Settings screen navigation (Task #18)
    if (currentScreen === 'settings') {
      if (input === 'q') {
        // Go back
        dispatch({ type: 'GO_BACK' });
      } else if (input === 'm' || input === 'M') {
        // Switch mode
        const targetMode = state.tradingMode === 'paper' ? 'live' : 'paper';

        // Check if switching to live but credentials not configured
        if (targetMode === 'live' && !state.liveCredentialsConfigured) {
          dispatch({
            type: 'SET_STATUS',
            payload: {
              message: 'Live credentials not configured. Check .env.local file.',
              type: 'error',
            },
          });
        } else {
          // Request mode switch (triggers confirmation dialog)
          dispatch({ type: 'REQUEST_MODE_SWITCH', payload: targetMode });
        }
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
                // Show confirmation prompt instead of saving directly
                dispatch({ type: 'SHOW_SAVE_CONFIRMATION', payload: strategy });
                dispatch({ type: 'SET_STATUS', payload: { message: 'Review strategy and press Enter to save, or Esc to cancel', type: 'info' } });
                logger.info(`📋 Showing save confirmation for ${strategy.type}`);
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
        else if (key.escape || input === 'q') {
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
