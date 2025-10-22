# Option Chain Viewer TUI

A terminal-based user interface (TUI) application for viewing option chains using the Alpaca Markets API.

## Features

- 📊 View real-time stock quotes
- 📈 Display option chains with Greeks (delta, gamma, theta, vega)
- 💾 Save and manage option strategies
- ⌨️ Keyboard-driven navigation
- 🎨 Beautiful terminal UI with Ink and React

## Prerequisites

- Node.js >= 18.0.0
- Alpaca Markets account (Paper Trading supported)

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure API Keys

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env` and add your Alpaca API credentials:

```env
ALPACA_API_KEY=your_paper_api_key_here
ALPACA_API_SECRET=your_paper_api_secret_here
ALPACA_PAPER=true
```

Get your API keys from [Alpaca Markets Dashboard](https://app.alpaca.markets/paper/dashboard/overview).

### 3. Run the Application

**Development mode** (with hot reload):
```bash
npm run dev
```

**Production mode**:
```bash
npm run build
npm start
```

## Project Structure

```
option-viewer-tui/
├── src/
│   ├── components/     # React/Ink UI components
│   │   ├── Header.tsx
│   │   └── StatusBar.tsx
│   ├── screens/        # Screen components
│   │   └── HomeScreen.tsx
│   ├── context/        # React Context state management
│   │   └── AppContext.tsx
│   ├── lib/           # API wrappers and integrations
│   │   └── alpaca.ts  # Alpaca API wrapper
│   ├── utils/         # Utility functions
│   │   ├── logger.ts  # Emoji-enhanced logging
│   │   └── storage.ts # JSON file persistence
│   ├── types/         # TypeScript type definitions
│   │   └── index.ts
│   ├── App.tsx        # Main application component
│   └── index.tsx      # Entry point
├── doc/               # Documentation
├── package.json
├── tsconfig.json
└── README.md
```

## Keyboard Shortcuts

### Navigation Mode (Default)
- `s` - Enter stock symbol
- `h` or `?` - Show help
- `q` - Quit application
- `/` - Enter command mode
- `Ctrl+C` - Exit

### Input Mode
- Type symbol and press `Enter` to submit
- `ESC` - Cancel input

### Command Mode
- Type `/` followed by command
- `Enter` - Execute command
- `ESC` - Cancel

## Architecture

### State Management
- Uses React Context + useReducer (not Redux)
- Centralized state in `AppContext`
- Follows global input handler pattern (see `doc/global-input-handler-guidelines.md`)

### API Integration
- Direct Alpaca API calls via wrapper methods in `lib/alpaca.ts`
- Secure credential handling via environment variables
- Mock data support for development

### Data Persistence
- Strategies saved to JSON file in `~/.option-viewer/strategies.json`
- Automatic directory creation
- Error handling for file operations

## Development

### Type Checking
```bash
npm run type-check
```

### Linting
```bash
npm run lint
```

### Testing
```bash
npm test
```

Watch mode:
```bash
npm run test:watch
```

## Implementation Status

### ✅ Completed (Tasks 1-3)
- [x] TypeScript project setup
- [x] Dependencies installed and configured
- [x] Alpaca API wrapper methods created
- [x] Basic folder structure
- [x] Global input handler
- [x] State management with Context
- [x] Logging system with emojis
- [x] JSON file persistence

### 🚧 In Progress
- [ ] Option chain display component
- [ ] Expiration date selection
- [ ] Option strategy builders

### 📋 Planned
- [ ] Multiple option strategies (Bull Call, Bear Put, etc.)
- [ ] Strategy comparison
- [ ] Real-time price updates

## Logging

The application uses emoji-enhanced logging for better debugging:
- 🔍 Debug messages
- ℹ️ Info messages
- ✅ Success messages
- ⚠️ Warnings
- ❌ Errors
- 🌐 API calls
- 💾 Data operations

## Security

- API keys stored in environment variables (never in code)
- `.env` file excluded from git
- Paper trading mode for safe testing

## License

MIT

## Contributing

See `CLAUDE.md` for development guidelines and conventions.
