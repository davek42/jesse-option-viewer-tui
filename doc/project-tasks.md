# Option View Project Tasks

## Implementation Tasks
1. Set up a new  project with TypeScript 
2. Install and configure required dependencies 
3. Create API wrapper methods to  requests to Alpaca Markets
4. Build the option chain display component
5. Implement the expiration date selection component
6. Add error handling and loading states
7. Implement the option strategy selection for Bull Call Spread
8. Implement an strategy saved area.
  - It should display below the stock quote area
  - It should show the type, strike prices, max loss, max gain, break even prices.
  - It should be similar to a spreadsheet layout.
  - In the option strategy area there should be a button to save the strategy. On saving it should display
9. For the Option Chain display should limit the number lines displayed
  - A command should have have choices of 10,40, and ALL
  - The prices should be center around the option with the CALL and PUT strike price closest to the current stock quote. 
    - Example: If AAPL has stock quote of 200 then the Option Chain prices should be centered around the strike 200
10. Implement the option strategy selection for Bear Put Spread
    - It should be very similar as "Bull Call Spread" strategy area
11. Implement the option strategy selection for Bull Put Spread
12. Implement the option strategy selection for Bear Call Spread
  - It should be similar to the Bull Put Spread
13. Implement the option strategy selection for Diagonal Call Spread
14. Implement the option strategy selection for Diagonal Put Spread
15. Implement the option strategy selection for Butterfly Spread
16. Implement the option strategy selection for Condor Spread
17. Implement the option strategy selection for Strangle Spread
18. **Add Live Trading Support** - Enable switching between Paper and Live trading modes
    - Hybrid configuration approach (env vars + config file)
    - Runtime mode switching with UI
    - Safety features and confirmations
    - Visual indicators and warnings

## Implementation Details

### 1. API Wrapper methods

Create  API wrapper:
- `ApiOptions` - Fetches option chain data for a given symbol and expiration date
- `ApiExpirations` - Fetches available expiration dates for a given symbol
- `ApiQuote` - Get Stock quote
-

### 2. Components

Create the following components:
- `OptionChain.tsx` - Main component for displaying option data
- `ExpirationSelect.tsx` - Component for selecting expiration dates

### 3. Data Processing

The application should:
- Parse option symbols to extract strike price, expiration, and option type
- Group options by expiration date
- Format data for display
- Handle API responses and errors
- Use actual Alpaca API calls


## Security Considerations

- Store API keys in environment variables (`.env.local`)
- Never expose API keys in client-side code


## UI/UX Improvements (In Progress)

### Navigation & Consistency
- Normalize Strategy Builder to use 'q' instead of ESC for going back (consistency with other screens)
- Add 'j/k' vim-style navigation everywhere (in addition to arrow keys)
- Allow number keys (1-4) to jump directly to a specific leg in strategy builder
- Center Strategy Builder on ATM strike for legs showing all strikes

### Visual Enhancements
- Add color coding to strategy legs in SavedStrategies display (BUY = green, SELL = red)
- Add visual indicator for current leg being selected (e.g., "Leg 2/4")
- Highlight wide bid/ask spreads (>5%) in yellow/red to identify liquidity issues
- Show volume for each option contract

### User Experience
- Create general help screen with app instructions and keyboard shortcuts
- Add keyboard shortcut reminder at bottom of Strategy Builder
- Allow 'x' or 'd' to delete/cancel current leg selection and go back one step
- Add confirmation prompt before saving strategy (show full summary first)

### Strategy Management
- In SavedStrategies, show days until expiration
- Add quick strategy duplication feature (copy existing strategy to build similar one)
- Sort saved strategies by symbol or date


## Task 18: Live Trading Support - Implementation Plan

### Overview
Add support for Alpaca Live Trading alongside Paper Trading, with runtime mode switching and comprehensive safety features.

### Requirements
- **Hybrid Configuration**: Support both environment variables and config file
- **Runtime Switching**: Allow users to switch modes without restart
- **Default Behavior**: Always start in Paper mode, but remember last mode selection
- **Safety**: Confirm EVERY mode switch (both to live and to paper)
- **UI**: Provide both settings screen and slash command for switching

### Phase 1: Configuration System

#### 1.1 Configuration Types
Create `src/config/types.ts`:
```typescript
export type TradingMode = 'paper' | 'live';

export interface AppConfig {
  tradingMode: TradingMode;
  lastUsedMode: TradingMode;  // Remember user preference
  credentials: {
    paper: {
      apiKey: string;
      secretKey: string;
    };
    live?: {  // Optional - not everyone has live keys
      apiKey: string;
      secretKey: string;
    };
  };
  preferences: {
    alwaysDefaultToPaper: boolean;  // Safety: always start in paper
    confirmModeSwitch: boolean;     // Require confirmation
  };
}
```

#### 1.2 Configuration Manager
Create `src/config/manager.ts`:
- `loadConfig(): AppConfig` - Load from file or env vars
- `saveConfig(config: AppConfig): void` - Persist to config file
- `validateCredentials(mode: TradingMode): boolean` - Validate keys exist
- `getConfigPath(): string` - Get platform-specific config location
- Priority: Environment variables > Config file > Defaults

#### 1.3 Config File Location
- macOS/Linux: `~/.config/jesse-option-viewer/config.json`
- Windows: `%APPDATA%/jesse-option-viewer/config.json`
- Auto-create on first run from env vars

#### 1.4 Environment Variable Support (Backward Compatible)
```bash
# .env.local - Backward compatible
ALPACA_API_KEY=PKxxxxxx          # Paper key (existing)
ALPACA_SECRET_KEY=xxxxx          # Paper secret (existing)

# New variables (optional)
ALPACA_LIVE_API_KEY=AKxxxxxx     # Live key
ALPACA_LIVE_SECRET_KEY=xxxxx     # Live secret
ALPACA_TRADING_MODE=paper        # Default mode
```

### Phase 2: Update Alpaca Client

#### 2.1 Modify `src/lib/alpaca.ts`
```typescript
export function getAlpacaClient(mode?: TradingMode): AlpacaClient {
  const config = loadConfig();
  const tradingMode = mode || config.tradingMode;

  // Select appropriate endpoint
  const baseURL = tradingMode === 'live'
    ? 'https://api.alpaca.markets'
    : 'https://paper-api.alpaca.markets';

  // Get credentials for mode
  const credentials = config.credentials[tradingMode];

  if (!credentials) {
    throw new Error(`No ${tradingMode} trading credentials configured`);
  }

  // Log mode for audit trail
  logger.info(`🔗 Connecting to Alpaca ${tradingMode.toUpperCase()} trading`);

  return new AlpacaClient(baseURL, credentials.apiKey, credentials.secretKey);
}
```

#### 2.2 Add Mode Validation
- Validate API key format (PK* for paper, AK* for live)
- Test connection before allowing switch
- Handle authentication errors gracefully

### Phase 3: State Management

#### 3.1 Add to AppContext State
```typescript
interface AppState {
  // ... existing state
  tradingMode: TradingMode;
  liveCredentialsConfigured: boolean;
  showModeConfirmation: boolean;
  pendingModeSwitch?: TradingMode;
}
```

#### 3.2 New Actions
```typescript
type AppAction =
  | { type: 'REQUEST_MODE_SWITCH'; payload: TradingMode }
  | { type: 'CONFIRM_MODE_SWITCH' }
  | { type: 'CANCEL_MODE_SWITCH' }
  | { type: 'SET_TRADING_MODE'; payload: TradingMode }
  // ... existing actions
```

### Phase 4: UI Components

#### 4.1 Header Component Updates
Always show prominent mode indicator:
```
Paper Mode:
┌──────────────────────────────────────────────────┐
│ 📊 Jesse Option Chain Viewer  [🟢 PAPER MODE]  │
└──────────────────────────────────────────────────┘

Live Mode (with warning):
┌──────────────────────────────────────────────────┐
│ 📊 Jesse Option Chain Viewer  [🔴 LIVE MODE]   │
│ ⚠️  REAL MONEY TRADING ACTIVE                    │
└──────────────────────────────────────────────────┘
```

Color scheme:
- **Paper**: Green background on badge
- **Live**: Red/Yellow background on badge, bold warning

#### 4.2 Status Bar Updates
Always display mode:
```
[PAPER] SPY @ $582.50 | Ready
[LIVE ⚠️] SPY @ $582.50 | REAL MONEY MODE
```

#### 4.3 Mode Confirmation Dialog
Create `src/components/ModeConfirmationDialog.tsx`:
```
┌────────────────────────────────────────────┐
│ ⚠️  SWITCH TO LIVE TRADING MODE?           │
│                                            │
│ This will connect to your LIVE Alpaca     │
│ account using REAL MONEY.                 │
│                                            │
│ Current: PAPER MODE                       │
│ Switch to: LIVE MODE                      │
│                                            │
│ Are you sure you want to continue?        │
│                                            │
│ [Yes, Switch] [Cancel]                    │
└────────────────────────────────────────────┘
```

Show for BOTH directions:
- Paper → Live: "REAL MONEY" warning
- Live → Paper: "SIMULATION MODE" confirmation

#### 4.4 Settings Screen
Create new settings screen with mode selection:
```
⚙️  Settings
─────────────

Trading Mode
  Current: [🟢 PAPER MODE]

  Available Modes:
  • Paper Trading (Simulated) ✓
  • Live Trading (Real Money) [Configure]

  [Switch Mode] [Back]

Preferences
  ☑ Always start in Paper mode
  ☑ Confirm mode switches

[Save] [Cancel]
```

Access via:
- Keyboard: 'm' key to open mode switcher
- Command: '/settings' or '/config'

#### 4.5 Slash Commands
Add to command handler:
```
/mode             - Show current mode and switch options
/mode live        - Request switch to live (with confirmation)
/mode paper       - Request switch to paper (with confirmation)
/mode status      - Display current mode details
```

### Phase 5: Safety Features

#### 5.1 Mode Switch Validation
- Always require confirmation (both directions)
- Validate credentials exist for target mode
- Test connection before completing switch
- Show error if switch fails

#### 5.2 Visual Warnings
- **Live Mode**: Red/yellow persistent indicators
- **Paper Mode**: Green reassuring indicators
- Warning icon on every screen when in live mode
- Persistent reminder in status bar

#### 5.3 Audit Logging
```typescript
logger.warn(`🔴 SWITCHED TO LIVE TRADING MODE at ${timestamp} by user`);
logger.info(`🟢 Switched to paper trading mode at ${timestamp} by user`);
logger.info(`📊 Trading mode on startup: ${mode} (default: paper)`);
```

#### 5.4 Default Behavior
- **Always** start in paper mode on launch
- Load `lastUsedMode` from config to show in UI
- User must explicitly switch to live each session
- Prevent accidental live trading

#### 5.5 Credential Validation
- Check API key format (PK* vs AK*)
- Verify key matches mode
- Test connection before allowing switch
- Clear error messages for mismatched keys

### Phase 6: Testing

#### 6.1 Unit Tests
- Config loading with various combinations
- Mode switching state transitions
- Credential validation
- Endpoint selection logic

#### 6.2 Integration Tests
- Switch modes and verify endpoint changes
- Test with missing credentials
- Verify confirmation flow
- Test env var priority over config file

#### 6.3 Manual Testing Checklist
- [ ] Start app in paper mode (default)
- [ ] Switch to live mode (with confirmation)
- [ ] Switch back to paper (with confirmation)
- [ ] Restart app (should be in paper)
- [ ] Try switching without live credentials
- [ ] Verify visual indicators in both modes
- [ ] Test slash commands
- [ ] Test settings screen
- [ ] Verify audit logs

### Implementation Order

1. **Phase 1**: Configuration system (types, manager, file handling)
2. **Phase 2**: Update Alpaca client with mode support
3. **Phase 3**: Add state management for mode switching
4. **Phase 4.1-4.2**: Visual indicators (header, status bar)
5. **Phase 4.3**: Confirmation dialog
6. **Phase 4.4**: Settings screen
7. **Phase 4.5**: Slash commands
8. **Phase 5**: All safety features
9. **Phase 6**: Testing

### Success Criteria
- ✅ Can switch between paper and live at runtime
- ✅ Always starts in paper mode
- ✅ Requires confirmation for every switch
- ✅ Clear visual indicators of current mode
- ✅ Backward compatible with existing env vars
- ✅ Comprehensive audit logging
- ✅ No accidental live trading possible

## Further Enhancements

Potential extensions to consider:
- Add option to display historical option prices
- Implement option strategy analysis
- Add visualization of implied volatility skew
- Create option profit/loss calculators
  - [How to Create a JavaScript Option Pricing Calculator Using the Black-Scholes Model](https://developer.mescius.com/blogs/how-to-create-javascript-option-pricing-calculator-black-scholes-model)
  - [BlackSholesJS](https://developer.mescius.com/blogs/how-to-create-javascript-option-pricing-calculator-black-scholes-model)
- Add way to save and display option strategies selected
- Add real-time updates for option prices


