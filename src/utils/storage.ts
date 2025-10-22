// AIDEV-NOTE: JSON file-based persistence for saved strategies

import { promises as fs } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type { OptionStrategy } from '../types/index.js';
import { logger } from './logger.js';

const STORAGE_DIR = join(homedir(), '.option-viewer');
const STRATEGIES_FILE = join(STORAGE_DIR, 'strategies.json');

/**
 * Ensure storage directory exists
 */
async function ensureStorageDir(): Promise<void> {
  try {
    await fs.access(STORAGE_DIR);
  } catch {
    await fs.mkdir(STORAGE_DIR, { recursive: true });
    logger.data('Created storage directory', STORAGE_DIR);
  }
}

/**
 * Load saved strategies from file
 */
export async function loadStrategies(): Promise<OptionStrategy[]> {
  try {
    await ensureStorageDir();
    const data = await fs.readFile(STRATEGIES_FILE, 'utf-8');
    const strategies = JSON.parse(data) as OptionStrategy[];
    logger.data('Loaded strategies', `${strategies.length} strategies`);
    return strategies;
  } catch (error) {
    // File doesn't exist or is invalid - return empty array
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      logger.debug('No saved strategies file found - starting fresh');
      return [];
    }
    logger.error('Failed to load strategies', error);
    return [];
  }
}

/**
 * Save strategies to file
 */
export async function saveStrategies(strategies: OptionStrategy[]): Promise<boolean> {
  try {
    await ensureStorageDir();
    const data = JSON.stringify(strategies, null, 2);
    await fs.writeFile(STRATEGIES_FILE, data, 'utf-8');
    logger.data('Saved strategies', `${strategies.length} strategies`);
    return true;
  } catch (error) {
    logger.error('Failed to save strategies', error);
    return false;
  }
}

/**
 * Add a new strategy
 */
export async function addStrategy(strategy: OptionStrategy): Promise<boolean> {
  try {
    const strategies = await loadStrategies();
    strategies.push(strategy);
    return await saveStrategies(strategies);
  } catch (error) {
    logger.error('Failed to add strategy', error);
    return false;
  }
}

/**
 * Remove a strategy by ID
 */
export async function removeStrategy(id: string): Promise<boolean> {
  try {
    const strategies = await loadStrategies();
    const filtered = strategies.filter(s => s.id !== id);
    return await saveStrategies(filtered);
  } catch (error) {
    logger.error('Failed to remove strategy', error);
    return false;
  }
}

/**
 * Clear all strategies
 */
export async function clearStrategies(): Promise<boolean> {
  try {
    return await saveStrategies([]);
  } catch (error) {
    logger.error('Failed to clear strategies', error);
    return false;
  }
}
