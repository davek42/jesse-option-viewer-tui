#!/usr/bin/env node
// AIDEV-NOTE: Main entry point for the Option Viewer TUI application

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { logger } from './utils/logger.js';

// Display startup banner (logs to file, not console)
logger.info('🚀 Starting Option Viewer TUI...');
logger.info(`📄 Log file: ${logger.getLogFilePath()}`);

// Clear the terminal screen to remove npm startup messages
// This provides a clean slate for the TUI application
process.stdout.write('\x1Bc');

// Render the application
const { unmount, waitUntilExit } = render(<App />);

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down gracefully...');
  logger.close();
  unmount();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('👋 Shutting down gracefully...');
  logger.close();
  unmount();
  process.exit(0);
});

// Wait for exit
await waitUntilExit();
logger.success('✅ Application closed');
logger.close();
