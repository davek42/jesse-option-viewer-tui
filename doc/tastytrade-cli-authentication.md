# tastytrade OAuth2 Authentication for CLI Applications

**Document Version**: 1.0  
**Last Updated**: October 29, 2025  
**Target Application**: jesse-option-viewer-tui (Terminal UI)

---

## Table of Contents

1. [Overview](#overview)
2. [Understanding OAuth2 for CLI Apps](#understanding-oauth2-for-cli-apps)
3. [tastytrade Authentication Methods](#tastytrade-authentication-methods)
4. [Recommended Approach: Refresh Token Flow](#recommended-approach-refresh-token-flow)
5. [Step-by-Step Setup Guide](#step-by-step-setup-guide)
6. [Token Management](#token-management)
7. [Security Best Practices](#security-best-practices)
8. [Troubleshooting](#troubleshooting)
9. [Automated Setup Script](#automated-setup-script)
10. [Alternative: Device Authorization Flow](#alternative-device-authorization-flow)

---

## Overview

### The Challenge

OAuth2 authentication typically requires a web server with a callback endpoint to receive authorization codes. This presents a challenge for CLI (Command Line Interface) applications that don't have web servers.

### The Solution

tastytrade's OAuth2 implementation supports **long-lived refresh tokens**, which allow CLI applications to authenticate without running a web server. You perform the initial OAuth flow once in a browser, obtain a refresh token, and store it locally. The tastytrade SDK then uses this refresh token to automatically obtain and refresh access tokens as needed.

### Key Benefits

- ✅ **No web server required** in your CLI app
- ✅ **One-time setup** (5-10 minutes)
- ✅ **Automatic token refresh** by SDK
- ✅ **Works offline** after initial setup
- ✅ **Secure** when properly configured

---

## Understanding OAuth2 for CLI Apps

### Traditional OAuth2 Flow (Web Apps)

```
User → Browser → Authorization Server → Redirect URI (your web server)
                                      → Authorization Code
                                      → Exchange for Tokens
```

**Problem**: CLI apps don't have web servers to receive the redirect.

### CLI-Friendly OAuth2 Flow (Refresh Token)

```
User → Browser → Authorization Server → Get Refresh Token (one-time)
                                      → Store in .env file
CLI App → Uses Refresh Token → Gets Access Token (automatic)
        → Access Token Expires → SDK auto-refreshes (transparent)
```

**Solution**: Long-lived refresh token eliminates need for web server.

---

## tastytrade Authentication Methods

tastytrade supports multiple OAuth2 authentication methods. For CLI applications, we use the **Refresh Token Flow**.

### Method 1: Refresh Token Flow ⭐ (Recommended for CLI)

**Characteristics:**
- Long-lived refresh tokens (possibly indefinite)
- No callback endpoint needed
- One-time manual browser setup
- Automatic token refresh by SDK

**Use Case:** Perfect for desktop apps, CLI tools, and scripts

### Method 2: Authorization Code Flow (Not Suitable for CLI)

**Characteristics:**
- Requires web server callback endpoint
- Short-lived authorization codes
- Standard OAuth2 flow

**Use Case:** Web applications only

### Method 3: Device Authorization Flow (Future Possibility)

**Characteristics:**
- User enters code in browser
- Polling mechanism for CLI
- No callback needed

**Use Case:** CLI apps, IoT devices (if tastytrade adds support)

---

## Recommended Approach: Refresh Token Flow

### How It Works

```typescript
// Your CLI app initialization
import TastytradeClient from "@tastytrade/api";

const client = new TastytradeClient({
  ...TastytradeClient.ProdConfig,
  clientSecret: process.env.TASTYTRADE_CLIENT_SECRET,
  refreshToken: process.env.TASTYTRADE_REFRESH_TOKEN,  // ⭐ Key part
  oauthScopes: ['read', 'trade']
});

// SDK handles everything from here:
// - Uses refresh token to get access token
// - Stores access token in memory
// - Detects when access token expires (typically 1 hour)
// - Automatically refreshes using refresh token
// - Your code never sees the complexity
```

### Authentication Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ One-Time Setup (Manual, in Browser)                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. Visit tastytrade.com                                    │
│  2. Create OAuth application                                │
│  3. Complete OAuth flow in browser                          │
│  4. Receive Client Secret + Refresh Token                   │
│  5. Store in .env file                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Automatic (Every Time CLI Runs)                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  CLI App Starts                                             │
│     │                                                       │
│     ├─► Load refresh token from .env                       │
│     │                                                       │
│     ├─► SDK: Exchange refresh token for access token       │
│     │   (Happens transparently in constructor)             │
│     │                                                       │
│     ├─► SDK: Store access token in memory                  │
│     │                                                       │
│     └─► Your app code runs normally                        │
│                                                             │
│  When API Call Made:                                        │
│     │                                                       │
│     ├─► SDK checks if access token expired                 │
│     │                                                       │
│     ├─► If expired: Auto-refresh using refresh token       │
│     │   (Your code never knows this happened)              │
│     │                                                       │
│     └─► Make API call with valid access token              │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Step-by-Step Setup Guide

### Prerequisites

1. **tastytrade account** (free to create at tastytrade.com)
2. **Browser access** to tastytrade.com
3. **Node.js** project with `@tastytrade/api` installed

### Step 1: Create OAuth Application

1. Log in to **https://my.tastytrade.com**
2. Navigate to **Settings** → **API Settings** (or Developer Settings)
3. Click **"Create New Application"** or **"New OAuth App"**
4. Fill in the application details:
   ```
   Name: jesse-option-viewer-cli
   Type: Desktop Application (or Mobile if available)
   Redirect URI: http://localhost:8080/callback
   Description: Options trading terminal with IV analytics
   ```
5. Click **Create** or **Save**
6. **Copy and save** the following:
   - **Client ID** (public identifier)
   - **Client Secret** (⚠️ Keep secret! Treat like a password)

### Step 2: Obtain Refresh Token

There are two methods to get your refresh token:

#### Option A: Direct Token Generation (Easiest) ⭐

Many OAuth providers now offer a "Generate Token" button for CLI/desktop apps.

1. In the same **API Settings** page
2. Look for buttons like:
   - "Generate Refresh Token"
   - "Create Personal Access Token"
   - "Get Token for Desktop App"
3. Select scopes: `read` and `trade` (if prompted)
4. Click **Generate**
5. **Copy the Refresh Token** (long string, often 40-100+ characters)
6. ⚠️ **Save immediately** - may only be shown once
7. Skip to Step 3

#### Option B: Manual OAuth Flow (If Option A Not Available)

If tastytrade doesn't provide direct token generation, perform the OAuth flow manually:

**1. Build the Authorization URL:**

```bash
# Replace YOUR_CLIENT_ID with your actual Client ID
https://my.tastytrade.com/oauth/authorize?client_id=YOUR_CLIENT_ID&redirect_uri=http://localhost:8080/callback&response_type=code&scope=read%20trade
```

**2. Visit URL in Browser:**

- Paste the URL into your browser
- Log in to tastytrade if prompted
- Click **Authorize** or **Allow Access**
- Browser will redirect to: `http://localhost:8080/callback?code=AUTHORIZATION_CODE`
- ⚠️ This will fail (no server running), but that's OK!

**3. Extract Authorization Code:**

```bash
# From the browser URL bar, copy everything after "code="
# Example URL: http://localhost:8080/callback?code=abc123xyz789
# Authorization Code: abc123xyz789
```

**4. Exchange Code for Tokens:**

```bash
curl -X POST https://api.tastytrade.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=authorization_code" \
  -d "code=YOUR_AUTHORIZATION_CODE" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "redirect_uri=http://localhost:8080/callback"
```

**5. Parse Response:**

```json
{
  "access_token": "eyJhbG...",      // ← Expires in ~1 hour, ignore
  "refresh_token": "def50200...",   // ← ⭐ SAVE THIS ONE
  "expires_in": 3600,
  "token_type": "Bearer",
  "scope": "read trade"
}
```

**6. Copy the `refresh_token` value** (not the `access_token`)

### Step 3: Configure Environment Variables

Create or update your `.env` file:

```bash
# Navigate to your project root
cd jesse-option-viewer-tui

# Create .env if it doesn't exist
touch .env

# Edit .env
nano .env
```

Add these lines:

```bash
# tastytrade API Authentication
TASTYTRADE_CLIENT_SECRET=your_client_secret_from_step_1
TASTYTRADE_REFRESH_TOKEN=your_refresh_token_from_step_2
TASTYTRADE_ENABLED=true

# Data Source Configuration
DATA_SOURCE=hybrid
IV_METRICS_SOURCE=tastytrade
```

**Example `.env` file:**

```bash
# Alpaca Markets API (existing)
ALPACA_API_KEY=PK1234567890ABCDEF
ALPACA_API_SECRET=sk1234567890abcdef
ALPACA_PAPER=true

# tastytrade API (new)
TASTYTRADE_CLIENT_SECRET=ts_secret_1234567890abcdef
TASTYTRADE_REFRESH_TOKEN=def502001234567890abcdefghijklmnopqrstuvwxyz
TASTYTRADE_ENABLED=true

# Data Source Configuration
DATA_SOURCE=hybrid
PRICING_SOURCE=alpaca
IV_METRICS_SOURCE=tastytrade
GREEKS_SOURCE=alpaca
```

### Step 4: Verify Setup

Test that authentication works:

```bash
# Install dependencies if not done already
npm install @tastytrade/api

# Run your CLI app
npm run dev

# Expected output:
# ✓ Connected to Alpaca Markets
# ✓ Connected to tastytrade API
# ✓ IV Rank enabled
#
# Enter stock symbol: 
```

If you see errors, check the [Troubleshooting](#troubleshooting) section below.

### Step 5: Test IV Rank Display

```bash
# In your running CLI app, enter a symbol:
AAPL

# You should see output like:
# ┌─────────────────────────────────────────────┐
# │ AAPL | $175.23 | +1.2%                      │
# │                                             │
# │ IV Rank: 65.5% | IV Percentile: 68.2%      │
# │ 📊 High - Good for selling premium          │
# │ 52w Range: 15.0% - 45.0% | Current: 25.0%  │
# └─────────────────────────────────────────────┘
```

If IV Rank shows up, **setup is complete!** 🎉

---

## Token Management

### Token Types Explained

| Token Type | Lifespan | Usage | Storage |
|------------|----------|-------|---------|
| **Access Token** | ~1 hour | API requests | Memory only (SDK manages) |
| **Refresh Token** | Long-lived* | Renew access tokens | `.env` file (you manage) |
| **Client Secret** | Permanent | Authenticate app | `.env` file (you manage) |

*Refresh token lifespan varies by provider (often 30-90 days, sometimes indefinite)

### How Token Refresh Works

The `@tastytrade/api` SDK handles token refresh automatically:

```typescript
// You write this simple code:
const client = new TastytradeClient({
  clientSecret: process.env.TASTYTRADE_CLIENT_SECRET,
  refreshToken: process.env.TASTYTRADE_REFRESH_TOKEN,
  // ...
});

// Behind the scenes, SDK does this:
// 1. On initialization: Exchange refresh_token → access_token
// 2. Store access_token in memory (expires in ~1 hour)
// 3. On every API call: Check if access_token expired
// 4. If expired: 
//    - Use refresh_token to get new access_token
//    - Update in-memory access_token
//    - Retry original API request
// 5. Your code never knows refresh happened
```

### Token Refresh Flow Diagram

```
┌──────────────────────────────────────────────────────────┐
│ Initial App Startup                                      │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
                Load refresh_token
                from .env file
                        │
                        ▼
                Exchange for access_token
                (POST /oauth/token)
                        │
                        ▼
                Store access_token in RAM
                Set expiry time (now + 3600s)
                        │
                        ▼
┌──────────────────────────────────────────────────────────┐
│ API Request Made                                         │
└──────────────────────────────────────────────────────────┘
                        │
                        ▼
                  Check expiry
                        │
           ┌────────────┴────────────┐
           │                         │
      Not Expired                Expired
           │                         │
           ▼                         ▼
    Use current              Refresh token:
    access_token             - POST /oauth/token
           │                 - grant_type=refresh_token
           │                 - Get new access_token
           │                 - Update expiry time
           │                         │
           └────────────┬────────────┘
                        │
                        ▼
              Make API request with
              valid access_token
                        │
                        ▼
                  Return data
```

### Manual Token Refresh (Advanced)

If you ever need to manually refresh (rare, SDK does this automatically):

```bash
curl -X POST https://api.tastytrade.com/oauth/token \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "grant_type=refresh_token" \
  -d "refresh_token=YOUR_REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

Response:

```json
{
  "access_token": "new_access_token_here",
  "refresh_token": "possibly_new_refresh_token",  // May be same or rotated
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

⚠️ **Important**: Some OAuth providers **rotate refresh tokens** - if the response includes a new `refresh_token`, update your `.env` file.

---

## Security Best Practices

### 1. Protect Your Credentials

```bash
# ✅ DO: Store in .env file
TASTYTRADE_REFRESH_TOKEN=secret_token_here

# ❌ DON'T: Hardcode in source files
const refreshToken = "def50200...";  // BAD!

# ✅ DO: Add .env to .gitignore
echo ".env" >> .gitignore

# ❌ DON'T: Commit .env to git
git add .env  // Never do this!
```

### 2. Use Environment Variables

```typescript
// ✅ DO: Read from environment
const refreshToken = process.env.TASTYTRADE_REFRESH_TOKEN;

if (!refreshToken) {
  throw new Error('TASTYTRADE_REFRESH_TOKEN not set');
}

// ❌ DON'T: Store in code
const refreshToken = "def50200...";  // Never!
```

### 3. Limit Token Scopes

Only request the permissions you need:

```typescript
// ✅ DO: Minimal scopes
oauthScopes: ['read']  // If you only read data

// ❌ DON'T: Request unnecessary scopes
oauthScopes: ['read', 'trade', 'admin']  // Too broad!
```

### 4. Rotate Tokens Periodically

```bash
# Good practice: Regenerate tokens every 90 days
# 1. Go to my.tastytrade.com
# 2. Revoke old token
# 3. Generate new token
# 4. Update .env file
```

### 5. Never Log Tokens

```typescript
// ❌ DON'T: Log tokens
console.log('Refresh token:', refreshToken);  // NEVER!

// ✅ DO: Log without revealing token
console.log('Refresh token loaded:', refreshToken ? 'Yes' : 'No');
```

### 6. Secure .env File Permissions

```bash
# Linux/Mac: Restrict file permissions
chmod 600 .env  # Only owner can read/write

# Verify
ls -la .env
# Expected: -rw------- (600)
```

### 7. Use Different Tokens for Different Environments

```bash
# .env.development
TASTYTRADE_REFRESH_TOKEN=dev_token_here

# .env.production
TASTYTRADE_REFRESH_TOKEN=prod_token_here

# Never mix production tokens with development code!
```

### 8. Handle Token Expiration Gracefully

```typescript
try {
  const data = await client.getIVMetrics('AAPL');
} catch (error) {
  if (error.message.includes('refresh_token')) {
    console.error('❌ Refresh token expired or invalid');
    console.error('Please regenerate token at my.tastytrade.com');
    process.exit(1);
  }
  throw error;
}
```

---

## Troubleshooting

### Issue 1: "Invalid refresh token"

**Symptoms:**
```
Error: Invalid refresh token
Authentication failed
```

**Causes & Solutions:**

1. **Token expired or revoked**
   ```bash
   # Solution: Generate new token
   # 1. Visit my.tastytrade.com
   # 2. Go to API Settings
   # 3. Revoke old token
   # 4. Generate new token
   # 5. Update .env file
   ```

2. **Token copied incorrectly**
   ```bash
   # Common issues:
   # - Extra spaces before/after token
   # - Missing characters (didn't copy all)
   # - Copied wrong token (access instead of refresh)
   
   # Solution: Carefully re-copy token
   # Tip: Use cat to verify token in .env
   cat .env | grep REFRESH_TOKEN
   ```

3. **Using production token in sandbox (or vice versa)**
   ```bash
   # Make sure token matches environment:
   # Production: api.tastytrade.com
   # Sandbox: sandbox.tastytrade.com (if available)
   ```

### Issue 2: "Missing client secret"

**Symptoms:**
```
Error: TASTYTRADE_CLIENT_SECRET is required
```

**Solution:**
```bash
# Verify .env file has the variable
cat .env | grep CLIENT_SECRET

# If missing, add it:
echo "TASTYTRADE_CLIENT_SECRET=your_secret_here" >> .env

# Restart your CLI app
```

### Issue 3: "Authentication failed" or "401 Unauthorized"

**Symptoms:**
```
Error: 401 Unauthorized
Failed to fetch IV metrics
```

**Debug Steps:**

1. **Check environment variables are loaded:**
   ```typescript
   console.log('Client Secret exists:', !!process.env.TASTYTRADE_CLIENT_SECRET);
   console.log('Refresh Token exists:', !!process.env.TASTYTRADE_REFRESH_TOKEN);
   ```

2. **Verify .env file location:**
   ```bash
   # Must be in project root, same directory as package.json
   ls -la .env
   ```

3. **Check for dotenv loading:**
   ```typescript
   // At top of your main file:
   import 'dotenv/config';  // Or require('dotenv').config()
   ```

4. **Test token manually:**
   ```bash
   curl -X POST https://api.tastytrade.com/oauth/token \
     -d "grant_type=refresh_token" \
     -d "refresh_token=$TASTYTRADE_REFRESH_TOKEN" \
     -d "client_secret=$TASTYTRADE_CLIENT_SECRET"
   
   # Should return new access_token
   # If error, token is invalid
   ```

### Issue 4: "Token refresh failed"

**Symptoms:**
```
Error: Failed to refresh access token
```

**Causes & Solutions:**

1. **Refresh token expired:**
   ```bash
   # Some providers expire refresh tokens after inactivity
   # Solution: Generate new token
   ```

2. **Network/API issue:**
   ```bash
   # Check tastytrade API status
   curl https://api.tastytrade.com/health
   
   # Check your internet connection
   ping api.tastytrade.com
   ```

3. **Client secret changed:**
   ```bash
   # If you regenerated OAuth app, secret changed
   # Solution: Update .env with new secret
   ```

### Issue 5: IV Rank Not Displaying

**Symptoms:**
- CLI runs without errors
- Option chain shows
- But no IV Rank column

**Debug Steps:**

1. **Check feature flag:**
   ```bash
   cat .env | grep TASTYTRADE_ENABLED
   # Should show: TASTYTRADE_ENABLED=true
   ```

2. **Check data source config:**
   ```bash
   cat .env | grep IV_METRICS_SOURCE
   # Should show: IV_METRICS_SOURCE=tastytrade
   ```

3. **Check API response:**
   ```typescript
   // Add temporary logging in tastytrade.ts
   async getIVMetrics(symbol: string) {
     const metrics = await this.client.instrumentsService.getEquity(symbol);
     console.log('IV Metrics response:', metrics);  // Debug
     return metrics;
   }
   ```

4. **Verify tastytrade account status:**
   - Account must be active
   - Account must have market data permissions
   - Some data may require account funding

### Issue 6: "Rate limit exceeded"

**Symptoms:**
```
Error: 429 Too Many Requests
Rate limit exceeded
```

**Solutions:**

1. **Implement caching:**
   ```typescript
   // IV Rank changes slowly - safe to cache
   const config = {
     features: {
       cacheIVMetrics: true,
       cacheDurationMinutes: 15  // Or longer
     }
   };
   ```

2. **Add request delay:**
   ```typescript
   // Between API calls
   await new Promise(resolve => setTimeout(resolve, 1000));
   ```

3. **Batch requests:**
   ```typescript
   // Instead of multiple calls
   const symbols = ['AAPL', 'MSFT', 'GOOGL'];
   for (const symbol of symbols) {
     await getIVMetrics(symbol);  // ❌ Multiple requests
   }
   
   // Batch if API supports it
   await getBatchIVMetrics(symbols);  // ✅ Single request
   ```

### Issue 7: "Cannot find module '@tastytrade/api'"

**Symptoms:**
```
Error: Cannot find module '@tastytrade/api'
```

**Solution:**
```bash
# Install the package
npm install @tastytrade/api

# Verify installation
npm list @tastytrade/api

# If still failing, clear cache and reinstall
rm -rf node_modules package-lock.json
npm install
```

### Issue 8: TypeScript Errors

**Symptoms:**
```
Type 'IVMetrics' is not defined
```

**Solution:**
```bash
# Ensure types are properly exported
# In your types/index.ts, verify:
export interface IVMetrics { ... }

# Clear TypeScript cache
rm -rf node_modules/.cache

# Rebuild
npm run build
```

### Getting Help

If none of the above solutions work:

1. **Check tastytrade API status:**
   - https://status.tastytrade.com (if available)
   - https://twitter.com/tastytrade

2. **Review tastytrade API documentation:**
   - https://developer.tastytrade.com/

3. **Contact tastytrade support:**
   - Email: api@tastytrade.com
   - Include: Error message, OAuth app ID (not secret!), timestamp

4. **Community support:**
   - tastytrade Discord server
   - r/tastytrade on Reddit

---

## Automated Setup Script

To make setup easier, create an interactive setup script:

### Script: `scripts/setup-tastytrade.js`

```javascript
#!/usr/bin/env node

/**
 * Interactive setup script for tastytrade API
 * Guides user through OAuth setup process
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query) {
  return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│  🔐 tastytrade API Setup Wizard    │');
  console.log('└─────────────────────────────────────┘\n');

  console.log('This script will help you configure tastytrade authentication.\n');

  // Check if .env exists
  const envPath = path.join(__dirname, '..', '.env');
  let envContent = '';
  
  if (fs.existsSync(envPath)) {
    console.log('✓ Found existing .env file\n');
    envContent = fs.readFileSync(envPath, 'utf8');
  } else {
    console.log('⚠️  No .env file found. Creating new one...\n');
  }

  // Instructions
  console.log('📋 Before continuing, you need:\n');
  console.log('   1. A tastytrade account (free at tastytrade.com)');
  console.log('   2. Client Secret from OAuth app');
  console.log('   3. Refresh Token from OAuth app\n');
  
  console.log('To get these:\n');
  console.log('   1. Log in to https://my.tastytrade.com');
  console.log('   2. Go to Settings > API Settings');
  console.log('   3. Create a new application (if you haven\'t already)');
  console.log('   4. Copy your Client Secret and Refresh Token\n');

  const proceed = await question('Ready to continue? (yes/no): ');
  
  if (proceed.toLowerCase() !== 'yes' && proceed.toLowerCase() !== 'y') {
    console.log('\nSetup cancelled. Run again when ready.');
    rl.close();
    return;
  }

  console.log('\n');

  // Get credentials
  const clientSecret = await question('Enter your Client Secret: ');
  
  if (!clientSecret || clientSecret.trim().length === 0) {
    console.log('\n❌ Client Secret is required. Setup cancelled.');
    rl.close();
    return;
  }

  const refreshToken = await question('Enter your Refresh Token: ');
  
  if (!refreshToken || refreshToken.trim().length === 0) {
    console.log('\n❌ Refresh Token is required. Setup cancelled.');
    rl.close();
    return;
  }

  // Update .env file
  try {
    if (!envContent.includes('TASTYTRADE_CLIENT_SECRET')) {
      // Add new section
      envContent += `\n# tastytrade API Authentication\n`;
      envContent += `TASTYTRADE_CLIENT_SECRET=${clientSecret.trim()}\n`;
      envContent += `TASTYTRADE_REFRESH_TOKEN=${refreshToken.trim()}\n`;
      envContent += `TASTYTRADE_ENABLED=true\n`;
    } else {
      // Replace existing values
      envContent = envContent.replace(
        /TASTYTRADE_CLIENT_SECRET=.*/,
        `TASTYTRADE_CLIENT_SECRET=${clientSecret.trim()}`
      );
      envContent = envContent.replace(
        /TASTYTRADE_REFRESH_TOKEN=.*/,
        `TASTYTRADE_REFRESH_TOKEN=${refreshToken.trim()}`
      );
      envContent = envContent.replace(
        /TASTYTRADE_ENABLED=.*/,
        `TASTYTRADE_ENABLED=true`
      );
    }

    fs.writeFileSync(envPath, envContent);
    
    console.log('\n✅ Configuration saved to .env');
    console.log('\n🔒 Security reminder:');
    console.log('   • Never commit .env to git');
    console.log('   • Keep your tokens secret');
    console.log('   • Rotate tokens every 90 days\n');
    
    console.log('🚀 Next steps:\n');
    console.log('   1. Run: npm run dev');
    console.log('   2. Enter a stock symbol (e.g., AAPL)');
    console.log('   3. Look for IV Rank in the header');
    console.log('   4. Press "i" to toggle IV Rank display\n');
    
  } catch (error) {
    console.error('\n❌ Failed to save configuration:', error.message);
    console.error('Please manually create .env file with:');
    console.error(`TASTYTRADE_CLIENT_SECRET=${clientSecret.trim()}`);
    console.error(`TASTYTRADE_REFRESH_TOKEN=${refreshToken.trim()}`);
  }

  rl.close();
}

// Run setup
setup().catch(err => {
  console.error('\n❌ Setup failed:', err.message);
  console.error('\nFor help, visit: https://developer.tastytrade.com/');
  process.exit(1);
});
```

### Make Script Executable

```bash
# Make executable
chmod +x scripts/setup-tastytrade.js

# Add to package.json scripts:
{
  "scripts": {
    "setup:tastytrade": "node scripts/setup-tastytrade.js",
    "dev": "node src/index.js",
    // ... other scripts
  }
}
```

### Run Setup Script

```bash
# Run the interactive setup
npm run setup:tastytrade

# Follow the prompts:
# 🔐 tastytrade API Setup Wizard
# 
# Enter your Client Secret: ****
# Enter your Refresh Token: ****
# 
# ✅ Configuration saved!
```

---

## Alternative: Device Authorization Flow

While tastytrade currently uses the refresh token flow, some OAuth providers support a **Device Authorization Flow** (RFC 8628) designed specifically for CLI apps and devices without browsers.

### How Device Flow Works

```
1. CLI requests device code:
   POST /oauth/device
   → Returns: device_code, user_code, verification_uri

2. CLI displays to user:
   "Visit: https://my.tastytrade.com/device"
   "Enter code: ABCD-1234"

3. User enters code in browser

4. CLI polls for authorization:
   POST /oauth/token (every 5 seconds)
   → Returns: access_token, refresh_token (once authorized)
```

### Example Implementation (If Supported)

```typescript
// Note: This is pseudocode - tastytrade may not support this yet
async function deviceFlowAuth() {
  // Step 1: Request device code
  const deviceResponse = await fetch('https://api.tastytrade.com/oauth/device', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: 'YOUR_CLIENT_ID',
      scope: 'read trade'
    })
  });

  const { device_code, user_code, verification_uri, interval } = await deviceResponse.json();

  // Step 2: Display instructions to user
  console.log('\n🔐 Authorization Required\n');
  console.log(`Visit: ${verification_uri}`);
  console.log(`Enter code: ${user_code}`);
  console.log('\nWaiting for authorization...\n');

  // Step 3: Poll for authorization
  let authorized = false;
  while (!authorized) {
    await new Promise(resolve => setTimeout(resolve, interval * 1000));

    const tokenResponse = await fetch('https://api.tastytrade.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        device_code: device_code,
        client_id: 'YOUR_CLIENT_ID'
      })
    });

    if (tokenResponse.ok) {
      const tokens = await tokenResponse.json();
      console.log('✅ Authorization successful!');
      
      // Save refresh_token to .env
      fs.appendFileSync('.env', `\nTASTYTRADE_REFRESH_TOKEN=${tokens.refresh_token}`);
      authorized = true;
    } else if (tokenResponse.status === 400) {
      // Still pending - continue polling
    } else {
      throw new Error('Authorization failed');
    }
  }
}
```

### Benefits of Device Flow

- ✅ **No callback URL needed**
- ✅ **Better UX** than copying tokens
- ✅ **More secure** (no token exposed in browser)
- ✅ **Standard OAuth2** flow

### Current Status

As of October 2025, tastytrade uses the **refresh token flow**. If they add device flow support in the future, this would be an even better option for CLI apps.

---

## Summary

### ✅ CLI Authentication is Possible!

**Yes**, you can authenticate with tastytrade OAuth2 from a CLI app without running a web server:

1. ✅ **Use refresh token flow**
2. ✅ **One-time browser setup** (5-10 minutes)
3. ✅ **Store credentials in .env**
4. ✅ **SDK handles automatic refresh**
5. ✅ **No HTTP endpoint needed**

### Quick Start Checklist

- [ ] Create tastytrade account
- [ ] Create OAuth application at my.tastytrade.com
- [ ] Obtain Client Secret
- [ ] Obtain Refresh Token
- [ ] Add credentials to .env file
- [ ] Install `@tastytrade/api` package
- [ ] Initialize TastytradeClient with tokens
- [ ] Test with `npm run dev`
- [ ] Verify IV Rank displays

### Key Takeaways

1. **Refresh tokens are CLI-friendly** - no web server required
2. **Setup is one-time** - tokens work indefinitely (with rotation)
3. **SDK handles complexity** - automatic token refresh
4. **Security is critical** - protect your .env file
5. **Troubleshooting is straightforward** - most issues are config-related

---

## Additional Resources

### Official Documentation
- **tastytrade API Docs**: https://developer.tastytrade.com/
- **OAuth 2.0 RFC**: https://tools.ietf.org/html/rfc6749
- **Device Flow RFC**: https://tools.ietf.org/html/rfc8628

### Related Guides
- tastytrade SDK on npm: https://www.npmjs.com/package/@tastytrade/api
- OAuth for Native Apps: https://oauth.net/2/native-apps/

### Support Channels
- **tastytrade API Support**: api@tastytrade.com
- **Developer Forum**: developer.tastytrade.com/forum (if available)
- **Discord/Slack**: Ask your community for invite links

---

## Changelog

### Version 1.0 (October 29, 2025)
- Initial documentation
- Refresh token flow explained
- Step-by-step setup guide
- Troubleshooting section
- Automated setup script
- Security best practices

---

**Document maintained by**: Options Trading Development Team  
**Questions?** Open an issue or contact api@tastytrade.com

---

*This document is part of the jesse-option-viewer-tui project.*
