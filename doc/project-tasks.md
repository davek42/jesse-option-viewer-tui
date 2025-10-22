# Option View Project Tasks

## Implementation Tasks
1. Set up a new  project with TypeScript 
2. Install and configure required dependencies 
3. Create API routes to securely proxy requests to Alpaca Markets
4. Build the option chain display component
5. Implement the expiration date selection component
6. Add error handling and loading states
7. Implement the option strategy selection for Bull Call Spread
8. Implement an strategy saved area.
  - It should display below the stock quote area
  - It should show the type, strike prices, max loss, max gain, break even prices.
  - It should be similar to a spreadsheet layout.
  - In the option strategy area there should be a button to save the strategy. On saving it should display
9. For the Option Chain display add a drop to down to limit the number lines displayed
  - The drop down should have have choices of 10,40, and ALL
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

### 1. API Routes

Create two API routes:
- `/api/options` - Fetches option chain data for a given symbol and expiration date
- `/api/expirations` - Fetches available expiration dates for a given symbol
- `/api/quote` - Get Stock quote
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
- Use API routes to proxy requests to Alpaca Markets


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


