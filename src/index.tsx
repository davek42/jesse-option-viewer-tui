#!/usr/bin/env node
// AIDEV-NOTE: Main entry point for the Option Viewer TUI application

import React from 'react';
import { render } from 'ink';
import { App } from './App.js';
import { logger } from './utils/logger.js';

// Display startup banner
logger.info('🚀 Starting Option Viewer TUI...');

// Render the application
const { unmount, waitUntilExit } = render(<App />);

// Handle graceful shutdown
process.on('SIGINT', () => {
  logger.info('👋 Shutting down gracefully...');
  unmount();
  process.exit(0);
});

process.on('SIGTERM', () => {
  logger.info('👋 Shutting down gracefully...');
  unmount();
  process.exit(0);
});

// Wait for exit
await waitUntilExit();
logger.success('✅ Application closed');
