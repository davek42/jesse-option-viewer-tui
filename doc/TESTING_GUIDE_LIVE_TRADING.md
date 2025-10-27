# Live Trading Mode - Testing Guide (Task #18)

This document provides comprehensive testing procedures for the Live Trading Mode feature.

## Table of Contents

1. [Test Environment Setup](#test-environment-setup)
2. [Automated Tests](#automated-tests)
3. [Manual Test Scenarios](#manual-test-scenarios)
4. [Security & Safety Tests](#security--safety-tests)
5. [Audit Log Verification](#audit-log-verification)
6. [Troubleshooting](#troubleshooting)

---

## Test Environment Setup

### Prerequisites

1. **Paper Trading Credentials** (Required)
   - `ALPACA_PAPER_API_KEY` (starts with `PK`)
   - `ALPACA_PAPER_SECRET_KEY`

2. **Live Trading Credentials** (Optional - for full testing)
   - `ALPACA_LIVE_API_KEY` (starts with `AK`)
   - `ALPACA_LIVE_SECRET_KEY`

### Setup Instructions

1. **Create `.env.local` file:**
   ```bash
   # Paper credentials (required)
   ALPACA_PAPER_API_KEY=PK_YOUR_PAPER_KEY_HERE
   ALPACA_PAPER_SECRET_KEY=your_paper_secret_key_here

   # Live credentials (optional)
   ALPACA_LIVE_API_KEY=AK_YOUR_LIVE_KEY_HERE
   ALPACA_LIVE_SECRET_KEY=your_live_secret_key_here
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Build the project:**
   ```bash
   npm run build
   ```

---

## Automated Tests

### Running All Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npx vitest run --coverage
```

### Test Suites

#### 1. Config Manager Tests
```bash
npx vitest tests/config/manager.test.ts
```

**Tests:**
- ✅ Platform-specific config directory detection
- ✅ Config file path generation
- ✅ Loading config from environment variables
- ✅ Loading live credentials when available
- ✅ Default mode (paper) enforcement
- ✅ Safety preferences (alwaysDefaultToPaper, confirmModeSwitch)
- ✅ Credential validation (API key format)
- ✅ Live trading availability detection
- ✅ Config file saving and persistence
- ✅ Legacy environment variable support

#### 2. Mode Validation Tests
```bash
npx vitest tests/utils/modeValidation.test.ts
```

**Tests:**
- ✅ Valid paper and live credentials
- ✅ Invalid API key format detection (PK vs AK prefix)
- ✅ Key length validation (minimum 20/40 chars)
- ✅ Placeholder value detection (YOUR_, PLACEHOLDER, XXXX)
- ✅ Warning generation for live mode
- ✅ Missing credentials rejection
- ✅ Multiple validation errors collection
- ✅ Edge cases (minimum length, very long, special characters)

#### 3. Audit Logger Tests
```bash
npx vitest tests/utils/auditLogger.test.ts
```

**Tests:**
- ✅ Audit log file creation
- ✅ Event appending
- ✅ Mode switch request logging
- ✅ Mode switch confirmation logging
- ✅ Mode switch cancellation logging
- ✅ Mode switch failure logging
- ✅ Credential validation logging
- ✅ Connection test logging
- ✅ App startup logging
- ✅ Recent events retrieval
- ✅ Event structure validation
- ✅ Complete audit trail scenarios

#### 4. Integration Tests
```bash
npx vitest tests/integration/modeSwitch.test.ts
```

**Tests:**
- ✅ Complete mode switch flow (paper → live)
- ✅ Complete mode switch flow (live → paper)
- ✅ Mode switch cancellation
- ✅ Validation warnings storage and clearing
- ✅ Edge cases (confirm without pending, multiple requests)
- ✅ State consistency after operations
- ✅ Safety checks (confirmation requirement, state clearing)

### Expected Test Results

All tests should pass:
```
✓ tests/config/manager.test.ts (30 tests)
✓ tests/utils/modeValidation.test.ts (25 tests)
✓ tests/utils/auditLogger.test.ts (28 tests)
✓ tests/integration/modeSwitch.test.ts (15 tests)

Test Files  4 passed (4)
     Tests  98 passed (98)
```

---

## Manual Test Scenarios

### Scenario 1: First-Time Startup

**Goal:** Verify safe startup behavior

**Steps:**
1. Delete config file: `rm ~/.config/jesse-option-viewer/config.json`
2. Start app: `npm start`

**Expected Results:**
- ✅ App starts in PAPER mode
- ✅ Header shows "🟢 PAPER"
- ✅ Status bar shows "🟢 PAPER"
- ✅ If live credentials configured, safety notice appears on home screen
- ✅ Log shows: "🛡️ Safety: Starting in PAPER mode"
- ✅ Audit log created: `~/.config/jesse-option-viewer/audit.log`
- ✅ Audit log contains `APP_STARTED` event

### Scenario 2: Access Settings Screen

**Goal:** Verify settings navigation

**Steps:**
1. Start app
2. Press `c` on home screen

**Expected Results:**
- ✅ Settings screen appears
- ✅ Current mode displayed: "🟢 PAPER"
- ✅ Paper credentials status: "✓ Configured"
- ✅ Live credentials status: "✓ Configured" or "✗ Not Configured"
- ✅ Safety notices displayed
- ✅ Instructions for switching modes shown

### Scenario 3: Request Mode Switch (Paper → Live)

**Goal:** Verify confirmation dialog appears

**Steps:**
1. Navigate to settings (`c` from home)
2. Press `m` to request mode switch

**Expected Results:**
- ✅ Confirmation dialog appears
- ✅ Dialog shows current mode: "🟢 PAPER"
- ✅ Dialog shows target mode: "🔴 LIVE"
- ✅ Red warning box appears with:
  - "⚠️ WARNING: SWITCHING TO LIVE TRADING MODE"
  - "This will connect to your REAL Alpaca trading account"
  - "All trades will use REAL MONEY"
  - "You can lose money - trade at your own risk"
- ✅ Action buttons: "[Y] Confirm" / "[N] Cancel"
- ✅ Status bar shows warning message
- ✅ Audit log contains `MODE_SWITCH_REQUESTED` event

### Scenario 4: Confirm Mode Switch (Paper → Live)

**Goal:** Verify mode switch execution

**Steps:**
1. Follow Scenario 3 to show confirmation dialog
2. Press `Y` to confirm

**Expected Results:**
- ✅ Dialog disappears
- ✅ Header shows "🔴 LIVE"
- ✅ Status bar shows "🔴 LIVE"
- ✅ Status message: "Mode switch confirmed!"
- ✅ Log shows: "✅ Confirmed mode switch to: LIVE"
- ✅ Audit log contains `MODE_SWITCH_CONFIRMED` event (severity: CRITICAL)
- ✅ Config file updated: `tradingMode: "live"`, `lastUsedMode: "live"`

### Scenario 5: Cancel Mode Switch

**Goal:** Verify cancellation behavior

**Steps:**
1. Follow Scenario 3 to show confirmation dialog
2. Press `N` (or `ESC`) to cancel

**Expected Results:**
- ✅ Dialog disappears
- ✅ Mode remains: "🟢 PAPER"
- ✅ Status message: "Mode switch cancelled"
- ✅ Log shows: "❌ Cancelled mode switch"
- ✅ Audit log contains `MODE_SWITCH_CANCELLED` event

### Scenario 6: Switch Back (Live → Paper)

**Goal:** Verify bidirectional switching

**Steps:**
1. Confirm mode is LIVE (from Scenario 4)
2. Navigate to settings
3. Press `m` to request switch to paper
4. Press `Y` to confirm

**Expected Results:**
- ✅ Confirmation dialog shows green "PAPER" message
- ✅ No scary red warnings (safer direction)
- ✅ After confirm, mode shows: "🟢 PAPER"
- ✅ Audit log contains full lifecycle

### Scenario 7: Slash Commands

**Goal:** Verify slash command mode switching

**Steps:**
1. From any screen, press `/`
2. Type `mode` and press Enter
3. Confirm or cancel

**Alternative commands:**
- `/paper` - Switch to paper mode
- `/live` - Switch to live mode
- `/settings` - Open settings screen

**Expected Results:**
- ✅ Each command triggers appropriate action
- ✅ `/mode` toggles between modes
- ✅ `/paper` and `/live` request specific modes
- ✅ Confirmation dialog appears for each

### Scenario 8: Live Credentials Not Configured

**Goal:** Verify error handling when live credentials missing

**Steps:**
1. Remove live credentials from `.env.local`
2. Restart app
3. Try to switch to live mode

**Expected Results:**
- ✅ Settings screen shows: "Live: ✗ Not Configured"
- ✅ Press `m` shows error: "Live credentials not configured. Check .env.local file."
- ✅ `/live` command shows same error
- ✅ No confirmation dialog appears
- ✅ Instructions shown for configuring credentials

### Scenario 9: App Restart After Mode Change

**Goal:** Verify persistence and safety restart

**Steps:**
1. Switch to LIVE mode (Scenario 4)
2. Quit app (`q`)
3. Restart app: `npm start`

**Expected Results:**
- ✅ App starts in PAPER mode (safety feature!)
- ✅ Settings shows "Last used mode" as LIVE
- ✅ Config file has `lastUsedMode: "live"` but app is in paper
- ✅ Log shows: "🛡️ Safety: Starting in PAPER mode"

### Scenario 10: Multiple Mode Switches

**Goal:** Verify state consistency

**Steps:**
1. Paper → Live → Paper → Live → Paper
2. Check after each switch

**Expected Results:**
- ✅ Each switch requires confirmation
- ✅ Mode indicator always accurate
- ✅ Audit log shows complete history
- ✅ No state corruption
- ✅ Config file stays in sync

---

## Security & Safety Tests

### Safety Test 1: Always Default to Paper

**Test:**
1. Set `lastUsedMode: "live"` in config file
2. Restart app

**Expected:**
- ✅ App starts in PAPER mode (not LIVE!)

### Safety Test 2: Confirmation Required

**Test:**
Try to bypass confirmation dialog

**Expected:**
- ✅ No direct mode switch possible
- ✅ All paths require confirmation
- ✅ No keyboard shortcut bypasses dialog

### Safety Test 3: Visual Warnings

**Test:**
Observe all warning displays

**Expected:**
- ✅ Red color for LIVE mode everywhere
- ✅ Green color for PAPER mode everywhere
- ✅ Emoji indicators (🟢/🔴) consistent
- ✅ Clear warnings in confirmation dialog

### Safety Test 4: Audit Trail

**Test:**
Perform complete mode switch cycle

**Expected:**
- ✅ All actions logged
- ✅ Timestamps accurate
- ✅ Severity levels correct (CRITICAL for live confirm)
- ✅ Details complete

### Safety Test 5: Invalid Credentials

**Test:**
1. Set invalid API key (wrong prefix)
2. Try to switch modes

**Expected:**
- ✅ Validation catches error
- ✅ Clear error message shown
- ✅ Mode switch blocked
- ✅ Audit log shows validation failure

---

## Audit Log Verification

### Location

```bash
# macOS/Linux
~/.config/jesse-option-viewer/audit.log

# Windows
%APPDATA%/jesse-option-viewer/audit.log
```

### Viewing Audit Log

```bash
# View recent events
tail -20 ~/.config/jesse-option-viewer/audit.log | jq

# Search for critical events
grep -i "critical" ~/.config/jesse-option-viewer/audit.log | jq
```

### Sample Audit Events

**App Startup:**
```json
{
  "timestamp": "2025-10-27T20:00:00.000Z",
  "event": "APP_STARTED",
  "details": {
    "startMode": "paper",
    "liveAvailable": true,
    "safetyMode": true
  },
  "severity": "info"
}
```

**Mode Switch Request:**
```json
{
  "timestamp": "2025-10-27T20:05:00.000Z",
  "event": "MODE_SWITCH_REQUESTED",
  "details": {
    "fromMode": "paper",
    "toMode": "live",
    "direction": "PAPER→LIVE"
  },
  "severity": "warning"
}
```

**Mode Switch Confirmed:**
```json
{
  "timestamp": "2025-10-27T20:05:15.000Z",
  "event": "MODE_SWITCH_CONFIRMED",
  "details": {
    "fromMode": "paper",
    "toMode": "live",
    "direction": "PAPER→LIVE",
    "userConfirmed": true
  },
  "severity": "critical"
}
```

---

## Troubleshooting

### Issue: Tests Failing

**Solution:**
1. Check environment variables are set
2. Verify .env.local has correct format
3. Run `npm run build` before tests
4. Check TypeScript compilation: `npm run type-check`

### Issue: Live Credentials Not Detected

**Solution:**
1. Verify `.env.local` has `ALPACA_LIVE_API_KEY` and `ALPACA_LIVE_SECRET_KEY`
2. Restart app (environment loaded on startup)
3. Check logs for credential loading messages
4. Verify API key starts with `AK` (not `PK`)

### Issue: Mode Switch Not Working

**Solution:**
1. Check console for error messages
2. View audit log for details
3. Verify credentials are valid
4. Check network connection to Alpaca API

### Issue: Audit Log Not Created

**Solution:**
1. Check config directory exists: `ls ~/.config/jesse-option-viewer/`
2. Check permissions
3. Verify app has write access
4. Check logs for errors

---

## Test Completion Checklist

### Automated Tests
- [ ] All config manager tests pass
- [ ] All validation tests pass
- [ ] All audit logger tests pass
- [ ] All integration tests pass
- [ ] Test coverage > 80%

### Manual Tests
- [ ] First-time startup works correctly
- [ ] Settings screen accessible and accurate
- [ ] Confirmation dialog appears for all switches
- [ ] Mode switches execute correctly (both directions)
- [ ] Cancellation works
- [ ] Slash commands work
- [ ] Error handling for missing credentials
- [ ] App restarts in paper mode (safety)
- [ ] Multiple switches maintain consistency

### Security & Safety
- [ ] Always defaults to paper on startup
- [ ] Confirmation required for all switches
- [ ] Visual warnings clear and prominent
- [ ] Audit trail complete
- [ ] Invalid credentials rejected

### Documentation
- [ ] All test scenarios documented
- [ ] Audit log format documented
- [ ] Troubleshooting guide complete
- [ ] Known issues documented (if any)

---

## Success Criteria

**The live trading feature is considered fully tested when:**

1. ✅ All automated tests pass (98/98)
2. ✅ All manual test scenarios complete successfully
3. ✅ All security & safety tests pass
4. ✅ Audit log verification complete
5. ✅ No critical bugs found
6. ✅ Documentation complete and accurate

---

## Additional Resources

- Configuration docs: `/doc/configuration.md`
- Audit log API: `/src/utils/auditLogger.ts`
- Validation API: `/src/utils/modeValidation.ts`
- Main task documentation: `/doc/project-tasks.md` (Task #18)
