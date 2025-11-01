# App.tsx Refactoring Plan

## Current Issues

1. **Large `useInput` section**: ~480 lines (lines 613-1092)
2. **Massive Symbol Detail `if` block**: ~397 lines (lines 678-1075)
3. **Deep nesting**: Strategy builder has 4-5 levels of nested conditionals
4. **Code duplication**: Navigation logic repeated in multiple places
5. **Low cohesion**: Multiple concerns mixed in one handler

## Refactoring Strategy

### Phase 1: Extract Symbol Detail Handler ✅ DONE

**File**: `src/handlers/symbolDetailHandler.ts`

Split Symbol Detail screen logic into:
- `handleSymbolDetailScreen()` - Main router
- `handleSymbolDetailNormal()` - Normal mode (not building)
- `handleExpirationSelection()` - Load option chain
- `handleViewOptionChain()` - View option chain screen
- `handleActivateBuilder()` - Activate strategy builder

**Impact**: Removes ~200 lines from App.tsx

### Phase 2: Extract Strategy Builder Handlers ✅ IN PROGRESS

**File**: `src/handlers/strategyBuilderHandler.ts`

Split strategy builder into:
- `handleStrategyBuilder()` - Main router
- `handleSaveConfirmation()` - Save confirmation dialog
- `handleStrategySelection()` - Strategy type selector
- `handleStrategyBuilding()` - Build strategy (navigation + actions)

**Impact**: Removes ~260 lines from App.tsx

### Phase 3: Extract Navigation Helpers ✅ DONE

**File**: `src/handlers/navigationHelpers.ts`

Reusable navigation functions:
- `handleUpDownNavigation()` - Arrow keys and j/k
- `handleJumpNavigation()` - J/K for 10-item jumps
- `handleAllNavigation()` - Combined helper

**Impact**: Reduces duplication across all handlers

### Phase 4: Further Break Down Strategy Building

**Files to create**:

1. **`src/handlers/strategyBuildingNavigation.ts`**
   - Handle up/down navigation
   - Handle leg jumping (number keys 1-4)
   - Handle expiration selection for diagonal spreads

2. **`src/handlers/strategyBuildingActions.ts`**
   - Handle option selection (Enter key)
   - Handle undo (x/d keys)
   - Handle cancel (Esc/q keys)
   - Handle strategy save

3. **`src/handlers/strategyHelpers.ts`** (move from App.tsx)
   - `shouldCenterOnATM()`
   - `getPreviousStep()`
   - `getAvailableOptionsForStep()`
   - `isStrategyComplete()`
   - `createStrategyByType()`
   - `getInitialStrategyMessage()`
   - `getSelectionStatusMessage()`
   - `handleOptionSelection()`
   - `handleExpirationSelectionForDiagonal()`
   - `getLegCountForStrategy()`

**Impact**: Removes ~200 more lines from App.tsx

### Phase 5: Update App.tsx to Use Handlers

**Modified `GlobalInputHandler()` in App.tsx**:

```typescript
function GlobalInputHandler() {
  const { exit } = useApp();
  const { state, dispatch } = useAppContext();
  const { highlightedIndex, setHighlightedIndex, showGreeks, setShowGreeks } = useNavigation();

  useInput((input, key) => {
    // Global: Ctrl+C to exit
    if (key.ctrl && input === 'c') {
      logger.info('👋 Exiting application...');
      exit();
      return;
    }

    // Create handler context
    const handlerContext = {
      state,
      dispatch,
      exit,
      highlightedIndex,
      setHighlightedIndex,
      showGreeks,
      setShowGreeks,
    };

    // COMMAND MODE
    if (state.mode === 'command') {
      const result = handleCommandMode(input, key, handlerContext);
      if (result.handled) return;
    }

    // INPUT MODE
    if (state.mode === 'input') {
      const inputContext = { ...handlerContext, onSymbolEntry: handleSymbolEntry };
      const result = handleInputMode(input, key, inputContext);
      if (result.handled) return;
    }

    // NAVIGATION MODE

    // Mode confirmation dialog
    if (state.showModeConfirmation) {
      if (input === 'Y' || input === 'y') {
        dispatch({ type: 'CONFIRM_MODE_SWITCH' });
        return;
      } else if (input === 'N' || input === 'n' || key.escape) {
        dispatch({ type: 'CANCEL_MODE_SWITCH' });
        return;
      }
      return;
    }

    // Slash command initiation
    if (input === '/') {
      dispatch({ type: 'SET_MODE', payload: 'command' });
      dispatch({ type: 'APPEND_INPUT', payload: '/' });
      return;
    }

    // Global help
    if ((input === 'h' || input === '?') && !state.strategyBuilderActive && !state.showSaveConfirmation) {
      dispatch({ type: 'SET_SCREEN', payload: 'help' });
      return;
    }

    // Delegate to screen-specific handlers
    const handlers = [
      handleHomeScreen,
      handleSymbolDetailScreen,      // NEW: Handles Symbol Detail + Strategy Builder
      handleOptionChainView,
      handleSavedStrategiesScreen,
      handleHelpScreen,
      handleSettingsScreen,
    ];

    for (const handler of handlers) {
      const result = handler(input, key, handlerContext);
      if (result.handled) return;
    }
  });

  return null;
}
```

**Result**: `GlobalInputHandler` reduced from ~480 lines to ~80 lines!

## Additional Refactoring Ideas

### 1. Strategy Pattern for Different Strategy Types

Create a `StrategyConfig` interface and strategy definitions:

```typescript
// src/strategies/config.ts

export interface StrategyConfig {
  name: string;
  displayName: string;
  legCount: number;
  steps: string[];
  getAvailableOptions: (step: string, context: StrategyBuildingContext) => OptionContract[];
  shouldCenterOnATM: (step: string) => boolean;
  getStepMessage: (step: string) => string;
  getSelectionMessage: (legNumber: number, strikePrice: number, isComplete: boolean) => string;
  createStrategy: (symbol: string, legs: OptionContract[], stockPrice: number) => OptionStrategy;
}

// Then define each strategy:
export const BULL_CALL_SPREAD: StrategyConfig = {
  name: 'bull_call_spread',
  displayName: 'Bull Call Spread',
  legCount: 2,
  steps: ['long', 'short'],
  // ... methods
};

// Registry:
export const STRATEGY_CONFIGS: Record<StrategyType, StrategyConfig> = {
  bull_call_spread: BULL_CALL_SPREAD,
  bear_put_spread: BEAR_PUT_SPREAD,
  // ...
};
```

**Benefits**:
- Eliminates large switch statements
- Makes adding new strategies easier
- Better separation of concerns

### 2. State Machine for Strategy Builder

Use a state machine library like XState or a simple custom state machine:

```typescript
type BuilderState =
  | { type: 'selecting_strategy' }
  | { type: 'selecting_expiration', leg: number }
  | { type: 'selecting_option', step: string }
  | { type: 'confirming_save', strategy: OptionStrategy }
  | { type: 'complete' };

type BuilderEvent =
  | { type: 'SELECT_STRATEGY', strategyType: StrategyType }
  | { type: 'SELECT_EXPIRATION', expiration: string }
  | { type: 'SELECT_OPTION', option: OptionContract }
  | { type: 'CONFIRM_SAVE' }
  | { type: 'CANCEL' }
  | { type: 'UNDO' };
```

**Benefits**:
- Explicit state transitions
- Easier to reason about complex flows
- Better error handling

### 3. Extract Async Operations

Move async operations to separate files:

```typescript
// src/services/optionChainService.ts

export async function loadOptionChain(
  symbol: string,
  expiration: string,
  dispatch: React.Dispatch<AppAction>,
  onProgress?: (message: string) => void
): Promise<OptionChainData | null> {
  // All the async logic
}

export async function loadExpirations(
  symbol: string,
  dispatch: React.Dispatch<AppAction>,
  onProgress?: (batchNum: number, total: number, max: number) => void
): Promise<string[]> {
  // All the async logic
}
```

**Benefits**:
- Testable async logic
- Reusable across components
- Cleaner separation of concerns

### 4. Custom Hooks for Complex State

Extract complex state management:

```typescript
// src/hooks/useStrategyBuilder.ts

export function useStrategyBuilder() {
  const { state, dispatch } = useAppContext();

  const selectStrategyType = (type: StrategyType) => {
    // Logic
  };

  const selectLeg = (option: OptionContract) => {
    // Logic
  };

  const undoLastLeg = () => {
    // Logic
  };

  const saveStrategy = () => {
    // Logic
  };

  return {
    // State
    strategyType: state.selectedStrategyType,
    currentStep: state.builderStep,
    selectedLegs: state.selectedLegs,
    isComplete: isStrategyComplete(...),

    // Actions
    selectStrategyType,
    selectLeg,
    undoLastLeg,
    saveStrategy,
  };
}
```

**Benefits**:
- Cleaner component code
- Testable business logic
- Reusable across components

## Summary

### Before Refactoring
- `GlobalInputHandler`: ~480 lines
- Symbol Detail block: ~397 lines
- Deep nesting: 4-5 levels
- Low maintainability

### After Refactoring
- `GlobalInputHandler`: ~80 lines
- Handler files: 6-8 small, focused files
- Max nesting: 2-3 levels
- High maintainability

### File Structure
```
src/
  handlers/
    types.ts                          # Handler interfaces
    commandHandler.ts                 # Command mode ✅ existing
    inputHandler.ts                   # Input mode ✅ existing
    homeHandler.ts                    # Home screen ✅ existing
    helpHandler.ts                    # Help screen ✅ existing
    settingsHandler.ts                # Settings screen ✅ existing
    savedStrategiesHandler.ts         # Saved strategies ✅ existing
    optionChainHandler.ts             # Option chain view ✅ existing
    navigationHelpers.ts              # Navigation helpers ✅ NEW
    symbolDetailHandler.ts            # Symbol detail ✅ NEW
    strategyBuilderHandler.ts         # Strategy builder ✅ NEW
    strategyBuildingNavigation.ts     # Builder navigation ⏳ TODO
    strategyBuildingActions.ts        # Builder actions ⏳ TODO
    strategyHelpers.ts                # Strategy helper functions ⏳ TODO
```

## Next Steps

1. ✅ Create navigation helpers
2. ✅ Create Symbol Detail handler
3. ✅ Create Strategy Builder handler (partial)
4. ⏳ Create Strategy Building sub-handlers
5. ⏳ Move strategy helper functions from App.tsx
6. ⏳ Update App.tsx to use new handlers
7. ⏳ Test all functionality
8. ⏳ Consider Strategy Pattern refactor
9. ⏳ Consider State Machine refactor
10. ⏳ Extract async operations to services
