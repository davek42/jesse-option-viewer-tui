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


