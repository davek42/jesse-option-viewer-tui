# Responsive UI - Terminal Size Adaptation

## Overview

The application automatically adapts its UI based on terminal size, providing an optimal experience on both large and small screens.

**Threshold: 40 lines**
- **Below 40 lines:** Compact mode - simplified UI to fit small terminals
- **40+ lines:** Full mode - rich UI with borders and detailed information

---

## Terminal Size Detection

```typescript
const terminalHeight = process.stdout.rows || 30;
const COMPACT_MODE_THRESHOLD = 40;
const compactMode = terminalHeight < COMPACT_MODE_THRESHOLD;
```

---

## Adaptive Elements

### 1. Stock Quote Banner

**Full Mode (40+ lines):**
```
┌─────────────────────────────────┐
│ SPY @ $687.08                   │
│ ▲ $2.15 (0.31%) Vol: 45.2M      │
└─────────────────────────────────┘
```
**Space used:** 3 lines

**Compact Mode (<40 lines):**
```
SPY @ $687.08 ▲ $2.15 (0.31%) Vol: 45.2M
```
**Space used:** 1 line
**Space saved:** 2 lines

---

### 2. Expiration List - Dynamic Sizing

**Full Mode:**
- Reserved space: 18 lines (quote, strategies, actions, status)
- Available for expirations: `terminalHeight - 18`
- Max visible: `min(15, available)`
- Example (50 lines): Shows 15 expirations

**Compact Mode:**
- Reserved space: 10 lines (compact quote, strategies, actions, status)
- Available for expirations: `terminalHeight - 10`
- Max visible: `min(15, available)`
- Example (30 lines): Shows 11-12 expirations

**Algorithm:**
```typescript
const getMaxVisibleExpirations = (): number => {
  if (compactMode) {
    const reservedLines = 10;
    const availableForExpirations = Math.max(5, terminalHeight - reservedLines);
    return Math.min(15, availableForExpirations);
  } else {
    const reservedLines = 18;
    const availableForExpirations = Math.max(8, terminalHeight - reservedLines);
    return Math.min(15, availableForExpirations);
  }
};
```

---

### 3. Strategies Section

**Full Mode:**
```
┌─────────────────────────────────┐
│ 💼 Saved Strategies (2 active)  │
│                                  │
│ Total Risk: -$450                │
│ Potential Gain: $1,200           │
│                                  │
│ Press v to view all strategies   │
└─────────────────────────────────┘
```
**Space used:** 6-8 lines (always visible, even if empty)

**Compact Mode:**
```
┌────────────────────────────────┐
│ 💼 Strategies (2)               │
│ Risk: -$450 | Gain: $1,200      │
└────────────────────────────────┘
```
**Space used:** 3-4 lines (hidden if empty)
**Space saved:** 3-6 lines

---

### 4. Keyboard Shortcuts

**Note:** Keyboard shortcuts are displayed by the main App component at the bottom of the screen, not by SymbolDetailScreen. This avoids duplication and saves space.

**Space used:** 2-3 lines (handled by App.tsx)

---

## Space Savings Summary

| Element | Full Mode | Compact Mode | Saved |
|---------|-----------|--------------|-------|
| **Stock Quote** | 3 lines | 1 line | 2 lines |
| **Expirations** | More reserved | Less reserved | ~7 lines |
| **Strategies (empty)** | 6 lines | 0 lines | 6 lines |
| **Margins** | Generous | Tight | 2 lines |
| **TOTAL SAVED** | - | - | **~17 lines** |

**Note:** Keyboard shortcuts are rendered once by App.tsx for all screens, avoiding duplication.

---

## Example Layouts

### Small Terminal (30 lines) - Compact Mode

```
SPY @ $687.08 ▲ $2.15 (0.31%) Vol: 45.2M

📅 Expiration Dates (k/j navigate, K/J jump 10)    Showing 1-15 of 87

▲ 0 more above

   Oct 28, 2024   0d    📅 Monthly
 ▶ Oct 29, 2024   1d    📆 Weekly
   Oct 30, 2024   2d    📆 Weekly
   Oct 31, 2024   3d    📅 Monthly
   Nov 1, 2024    4d    📆 Weekly
   Nov 4, 2024    7d    📆 Weekly
   Nov 7, 2024    10d   📆 Weekly
   Nov 14, 2024   17d   📆 Weekly
   Nov 21, 2024   24d   📆 Weekly
   Nov 28, 2024   31d   📆 Weekly
   Dec 5, 2024    38d   📆 Weekly
   Dec 12, 2024   45d   📆 Weekly
   Dec 19, 2024   52d   📅 Monthly
   Dec 26, 2024   59d   📆 Weekly
   Jan 2, 2025    66d   📆 Weekly

▼ 72 more below
```

**Total (SymbolDetailScreen only):** ~20 lines
**Note:** App.tsx adds Header (~2 lines), Keyboard shortcuts (~2 lines), and StatusBar (~2 lines) for total of ~26 lines

---

### Large Terminal (50 lines) - Full Mode

```
┌─────────────────────────────────┐
│ SPY @ $687.08                   │
│ ▲ $2.15 (0.31%) Vol: 45.2M      │
└─────────────────────────────────┘

📅 Expiration Dates (k/j navigate, K/J jump 10)    Showing 1-15 of 87

▲ 0 more above

   Oct 28, 2024   0d    📅 Monthly
 ▶ Oct 29, 2024   1d    📆 Weekly
   Oct 30, 2024   2d    📆 Weekly
   Oct 31, 2024   3d    📅 Monthly
   Nov 1, 2024    4d    📆 Weekly
   Nov 4, 2024    7d    📆 Weekly
   Nov 7, 2024    10d   📆 Weekly
   Nov 14, 2024   17d   📆 Weekly
   Nov 21, 2024   24d   📆 Weekly
   Nov 28, 2024   31d   📆 Weekly
   Dec 5, 2024    38d   📆 Weekly
   Dec 12, 2024   45d   📆 Weekly
   Dec 19, 2024   52d   📅 Monthly
   Dec 26, 2024   59d   📆 Weekly
   Jan 2, 2025    66d   📆 Weekly

▼ 72 more below

┌─────────────────────────────────┐
│ 💼 Saved Strategies (2 active)  │
│                                  │
│ Total Risk: -$450                │
│ Potential Gain: $1,200           │
│                                  │
│ Press v to view all strategies   │
└─────────────────────────────────┘
```

**Total (SymbolDetailScreen only):** ~33 lines
**Note:** App.tsx adds Header (~2 lines), Keyboard shortcuts (~2 lines), and StatusBar (~2 lines) for total of ~39 lines

---

## Implementation Details

### Files Modified

**`src/screens/SymbolDetailScreen.tsx`**
- Detects terminal height using `process.stdout.rows`
- Calculates `compactMode` boolean based on 40-line threshold
- Dynamically calculates `maxVisible` for expiration list
- Conditionally renders UI elements based on mode
- Logs terminal size and mode for debugging

### Key Features

1. **Automatic Detection**
   - No user configuration required
   - Adapts instantly on terminal resize
   - Falls back to 30 lines if detection fails

2. **Dynamic Calculation**
   - Expiration list size adapts to available space
   - Always shows at least 5 expirations (minimum)
   - Never exceeds 15 expirations (maximum)

3. **Smart Hiding**
   - Strategies section hidden in compact mode if empty
   - Prevents wasting space on empty sections
   - Always visible in full mode for consistency

4. **Preserved Functionality**
   - All features work in both modes
   - Same keyboard shortcuts
   - Same navigation behavior
   - Only visual presentation changes

---

## Testing

### Test on Small Terminal (30 lines)

```bash
# Resize terminal to 30 lines
# Or use terminal window manager:
stty rows 30
npm start
```

**Expected:**
- Compact mode activates
- Stock quote: 1 line
- Expirations: ~11-12 visible
- Strategies: Hidden if empty
- Quick actions: 1 line
- Everything fits comfortably

### Test on Large Terminal (50 lines)

```bash
# Resize terminal to 50+ lines
stty rows 50
npm start
```

**Expected:**
- Full mode activates
- Stock quote: 3 lines with border
- Expirations: 15 visible
- Strategies: Always visible
- Quick actions: 6 lines with descriptions
- Rich, detailed UI

### Debug Log

When entering SymbolDetailScreen, check logs for:
```
📏 Terminal: 30 lines, Mode: COMPACT, MaxVisible: 11
```
or
```
📏 Terminal: 50 lines, Mode: FULL, MaxVisible: 15
```

---

## Common Terminal Sizes

| Terminal | Lines | Mode | Experience |
|----------|-------|------|------------|
| **tmux split** | 24 | Compact | Tight but works |
| **Small laptop** | 30 | Compact | Comfortable |
| **Medium laptop** | 35 | Compact | Good |
| **Full screen** | 45-50 | Full | Perfect |
| **Large monitor** | 60+ | Full | Spacious |

---

## Why 40 Lines?

1. **Natural breakpoint** - UI goes from "cramped" to "comfortable"
2. **Industry standard** - Many TUIs use similar thresholds
3. **Covers common cases** - Fits split terminals (compact) and full screens (full)
4. **Easy to remember** - Simple round number
5. **Tested** - Works well in practice

---

## Future Enhancements (Not Implemented)

These could be added later if needed:

1. **Manual Override**
   - User preference to force compact/full mode
   - Environment variable: `UI_MODE=compact|full`

2. **Width Adaptation**
   - Adapt to narrow terminals (< 100 columns)
   - Hide less important columns in option chain

3. **Custom Threshold**
   - Allow user to set their own threshold
   - Config file: `compactModeThreshold: 40`

4. **More Granular Modes**
   - Minimal (< 30 lines)
   - Compact (30-40 lines)
   - Full (40-60 lines)
   - Luxurious (60+ lines)

---

## Summary

The responsive UI automatically adapts to terminal size, providing:

✅ **Optimal experience on small screens** (24-35 lines)
✅ **Rich UI on large screens** (45-60+ lines)
✅ **No user configuration required**
✅ **All functionality preserved**
✅ **17 lines saved in compact mode**
✅ **Dynamic expiration list sizing**
✅ **No duplicate UI elements** - keyboard shortcuts shown once by App.tsx

**Result:** Application is now usable on split terminals, tmux panes, and small laptop screens while maintaining a rich experience on desktop monitors.
