// AIDEV-NOTE: Custom hook for terminal size detection and responsive layout

import { useState, useEffect } from 'react';
import { useStdout } from 'ink';

export interface TerminalSize {
  columns: number;
  rows: number;
  isSmall: boolean;
  isTooSmall: boolean;
  recommendedColumns: number;
  recommendedRows: number;
}

// Minimum recommended terminal size
const MIN_COLUMNS = 100;
const MIN_ROWS = 30;

// Absolute minimum (show warning but still functional)
const ABSOLUTE_MIN_COLUMNS = 80;
const ABSOLUTE_MIN_ROWS = 20;

/**
 * Custom hook to detect terminal size and provide responsive layout info
 *
 * @returns Terminal size information and recommendations
 */
export function useTerminalSize(): TerminalSize {
  const { stdout } = useStdout();

  const [size, setSize] = useState<TerminalSize>({
    columns: stdout?.columns || 100,
    rows: stdout?.rows || 30,
    isSmall: false,
    isTooSmall: false,
    recommendedColumns: MIN_COLUMNS,
    recommendedRows: MIN_ROWS,
  });

  useEffect(() => {
    const updateSize = () => {
      const columns = stdout?.columns || 100;
      const rows = stdout?.rows || 30;

      const isSmall = columns < MIN_COLUMNS || rows < MIN_ROWS;
      const isTooSmall = columns < ABSOLUTE_MIN_COLUMNS || rows < ABSOLUTE_MIN_ROWS;

      setSize({
        columns,
        rows,
        isSmall,
        isTooSmall,
        recommendedColumns: MIN_COLUMNS,
        recommendedRows: MIN_ROWS,
      });
    };

    // Initial size
    updateSize();

    // Listen for terminal resize events
    if (stdout) {
      stdout.on('resize', updateSize);

      return () => {
        stdout.off('resize', updateSize);
      };
    }

    // Return cleanup function (no-op if stdout is undefined)
    return undefined;
  }, [stdout]);

  return size;
}

/**
 * Calculate safe display limit for option chains based on terminal height
 *
 * @param terminalRows - Current terminal height
 * @param reservedRows - Rows used by header, footer, etc. (default: 15)
 * @returns Safe number of option strikes to display
 */
export function calculateSafeDisplayLimit(terminalRows: number, reservedRows: number = 15): number {
  const availableRows = Math.max(5, terminalRows - reservedRows);

  // Each strike takes 1 row, limit to reasonable max
  const calculatedLimit = Math.floor(availableRows / 1);

  // Return limited to min 5, max 50
  return Math.max(5, Math.min(50, calculatedLimit));
}
