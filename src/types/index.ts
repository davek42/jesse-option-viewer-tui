// AIDEV-NOTE: Core type definitions for the option viewer application

/**
 * Application mode types
 */
export type AppMode = 'navigation' | 'input' | 'command';

/**
 * Screen types for navigation
 */
export type ScreenType =
  | 'home'              // Landing page
  | 'symbolDetail'      // Stock quote + expiration selector + compact saved strategies
  | 'optionChainView'   // Full dedicated option chain display
  | 'savedStrategies'   // Full screen saved strategies management
  | 'help'              // Help screen
  | 'settings';         // Settings screen

/**
 * Status message types
 */
export type StatusType = 'info' | 'success' | 'error' | 'warning';

/**
 * Stock quote data from Alpaca
 */
export interface StockQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
}

/**
 * Option contract data
 */
export interface OptionContract {
  symbol: string;
  strikePrice: number;
  expirationDate: string;
  optionType: 'call' | 'put';
  bid: number;
  ask: number;
  lastPrice: number;
  volume: number;
  openInterest: number;
  impliedVolatility?: number;
  // Greeks
  delta?: number;
  gamma?: number;
  theta?: number;
  vega?: number;
  rho?: number;
}

/**
 * Option chain response containing calls and puts
 */
export interface OptionChain {
  symbol: string;
  expirationDate: string;
  calls: OptionContract[];
  puts: OptionContract[];
  underlyingPrice: number;
}

/**
 * Available expiration dates for an underlying
 */
export interface ExpirationDates {
  symbol: string;
  dates: string[];
}

/**
 * Option strategy types
 */
export type StrategyType =
  | 'bull_call_spread'
  | 'bear_put_spread'
  | 'bull_put_spread'
  | 'bear_call_spread'
  | 'diagonal_call_spread'
  | 'diagonal_put_spread'
  | 'butterfly_spread'
  | 'condor_spread'
  | 'strangle_spread'
  | 'iron_condor'
  | 'long_straddle'
  | 'covered_call';

/**
 * Saved option strategy
 */
export interface OptionStrategy {
  id: string;
  type: StrategyType;
  symbol: string;
  legs: OptionContract[];
  maxLoss: number;
  maxGain: number;
  breakEvenPrices: number[];
  createdAt: Date;
}

/**
 * Application state structure
 */
export interface AppState {
  // Screen management
  currentScreen: ScreenType;
  screenHistory: ScreenType[];

  // Mode management
  mode: AppMode;

  // Input state
  inputBuffer: string;
  commandBuffer: string;

  // Navigation state
  selectedIndex: Record<string, number>;

  // Status
  statusMessage: string;
  statusType: StatusType;

  // Data state
  currentSymbol: string | null;
  stockQuote: StockQuote | null;
  optionChain: OptionChain | null;
  selectedExpiration: string | null;
  availableExpirations: string[];
  savedStrategies: OptionStrategy[];

  // Display preferences
  displayLimit: number; // 10, 40, or -1 for ALL
  loading: boolean;
  error: string | null;

  // Strategy builder state (Task #9 - Multi-strategy support)
  strategyBuilderActive: boolean;
  selectedStrategyType: StrategyType | null;
  builderStep: 'long' | 'short' | 'leg1' | 'leg2' | 'leg3' | 'leg4';
  selectedLongCall: OptionContract | null;
  selectedShortCall: OptionContract | null;
  // Generic legs for multi-strategy support
  selectedLegs: OptionContract[];
}

/**
 * Action types for state reducer
 */
export type AppAction =
  | { type: 'SET_SCREEN'; payload: ScreenType }
  | { type: 'GO_BACK' }
  | { type: 'SET_MODE'; payload: AppMode }
  | { type: 'APPEND_INPUT'; payload: string }
  | { type: 'DELETE_LAST_CHAR' }
  | { type: 'CLEAR_INPUT' }
  | { type: 'MOVE_SELECTION'; payload: { screen: string; direction: 'up' | 'down'; max: number } }
  | { type: 'RESET_SELECTION'; payload: string }
  | { type: 'SET_STATUS'; payload: { message: string; type: StatusType } }
  | { type: 'CLEAR_STATUS' }
  | { type: 'SET_SYMBOL'; payload: string }
  | { type: 'SET_STOCK_QUOTE'; payload: StockQuote | null }
  | { type: 'SET_OPTION_CHAIN'; payload: OptionChain | null }
  | { type: 'SET_EXPIRATION'; payload: string }
  | { type: 'SET_AVAILABLE_EXPIRATIONS'; payload: string[] }
  | { type: 'ADD_STRATEGY'; payload: OptionStrategy }
  | { type: 'REMOVE_STRATEGY'; payload: string }
  | { type: 'LOAD_STRATEGIES'; payload: OptionStrategy[] }
  | { type: 'SET_DISPLAY_LIMIT'; payload: number }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'ACTIVATE_STRATEGY_BUILDER'; payload?: StrategyType }
  | { type: 'DEACTIVATE_STRATEGY_BUILDER' }
  | { type: 'SET_STRATEGY_TYPE'; payload: StrategyType }
  | { type: 'SET_BUILDER_STEP'; payload: 'long' | 'short' | 'leg1' | 'leg2' | 'leg3' | 'leg4' }
  | { type: 'SET_LONG_CALL'; payload: OptionContract | null }
  | { type: 'SET_SHORT_CALL'; payload: OptionContract | null }
  | { type: 'ADD_LEG'; payload: OptionContract }
  | { type: 'CLEAR_LEGS' };
