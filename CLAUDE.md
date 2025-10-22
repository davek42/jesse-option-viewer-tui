# Option Chain Viewer TUI

> **Task**: Create a terminal UI (TUI) application with TypeScript that displays option chains for stocks using the Alpaca Markets API.

## Project Description

This application allows users to:
1. Enter a stock symbol
2. View available option expiration dates
3. View the option chain data including calls and puts for selected expiration dates
4. See detailed option metrics including Greeks (delta, gamma, theta, vega)


## Technology Stack

### Core Technologies

- **Node.js** - JavaScript runtime environment
- **React** - Component-based UI library
- **Ink** - React for terminal applications
- **Typescript** - Use Typescript as the primary language
  - [Ink github](https://github.com/vadimdemedes/ink)
- Data fetching from Alpaca Markets API

### Dependencies

- **ink** (^4.4.1) - Terminal UI framework based on React
- **ink-big-text** (^2.0.0) - Large text rendering
- **ink-gradient** (^3.0.0) - Color gradients for text
- **ink-spinner** (^5.0.0) - Loading spinners
- **react** (^18.2.0) - Core React library
- **chalk** (^5.3.0) - Terminal string styling


## Core UI Design

- This will use a Terminal UI design
- UI components should remain clearly separate from the rest the code

## Anchor comments
Add specially formatted comments throughout the codebase, where appropriate,
for yourself as inline knowledge that can be easily `grep`ped for.

### Anchor Comment Guidelines:

- Use `AIDEV-NOTE:`, `AIDEV-TODO:`, or `AIDEV-QUESTION:` (all-caps prefix) for comments aimed at AI and developers.
- Keep them concise (≤ 120 chars).
- **Important:** Before scanning files, always first try to **locate existing anchors** `AIDEV-*` in relevant subdirectories.
- **Update relevant anchors** when modifying associated code.
- **Do not remove `AIDEV-NOTE`s** without explicit human instruction.

Example:

# AIDEV-NOTE: perf-hot-path; avoid extra allocations (see ADR-24)

async def render_feed(...):

## Related Projects

- This project is related to web project [Option Chain View](file:///Users/davidk/dev/option-chain-viewer/)
- Some ideas will maybe borrowed from this other project


### Source Control Conventions (git)

- **Git Commit Message**: Git message should be of this form:
  - `[#task ID] descriptive message`
  - `[BugFix] description` for bug fixes
  - If no task ID available mark as: `[Ad Hoc] message`

### Global Input Management: Architectural Rules

Here are key architectural rules for the global input management system with focus control that we've implemented:
@doc/global-input-handler-guidelines.md



## Security Considerations

- Store API keys in environment variables (`.env.local`)
- Never expose API keys in client-side code

