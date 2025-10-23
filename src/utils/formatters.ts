// AIDEV-NOTE: Shared formatting utilities for handling API data safely

/**
 * Safely format a number with toFixed, handling string values from API
 *
 * The Alpaca API sometimes returns numeric values as strings instead of numbers.
 * This function ensures we can safely format these values without crashes.
 *
 * @param value - The value to format (can be number, string, undefined, or null)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string or '-' if value is invalid
 *
 * @example
 * safeToFixed(123.456, 2) // "123.46"
 * safeToFixed("123.456", 2) // "123.46"
 * safeToFixed(undefined, 2) // "-"
 * safeToFixed("invalid", 2) // "-"
 */
export function safeToFixed(value: number | string | undefined | null, decimals: number = 2): string {
  if (value === undefined || value === null) return '-';

  // Handle non-number types (API might return strings)
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));

  // Check if conversion resulted in valid number
  if (isNaN(numValue)) return '-';

  return numValue.toFixed(decimals);
}

/**
 * Format a price value safely with $ prefix
 *
 * @param value - The price value to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "$123.46" or "-"
 *
 * @example
 * formatPrice(123.456) // "$123.46"
 * formatPrice("123.456") // "$123.46"
 * formatPrice(undefined) // "-"
 */
export function formatPrice(value: number | string | undefined | null, decimals: number = 2): string {
  const formatted = safeToFixed(value, decimals);
  return formatted === '-' ? '-' : `$${formatted}`;
}

/**
 * Format a percentage value safely with % suffix
 *
 * @param value - The percentage value to format (e.g., 12.34 for 12.34%)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted string like "12.34%" or "-"
 *
 * @example
 * formatPercent(12.345) // "12.35%"
 * formatPercent("12.345") // "12.35%"
 * formatPercent(undefined) // "-"
 */
export function formatPercent(value: number | string | undefined | null, decimals: number = 2): string {
  const formatted = safeToFixed(value, decimals);
  return formatted === '-' ? '-' : `${formatted}%`;
}

/**
 * Format a Greek value with sign and appropriate precision
 *
 * @param value - The Greek value to format
 * @param decimals - Number of decimal places (default: 4 for Greeks)
 * @returns Formatted string with leading space for positive values
 *
 * @example
 * formatGreek(0.5234) // " 0.5234"
 * formatGreek(-0.5234) // "-0.5234"
 * formatGreek(undefined) // "-"
 */
export function formatGreek(value: number | string | undefined | null, decimals: number = 4): string {
  if (value === undefined || value === null) return '-';

  // Handle non-number types (API might return strings)
  const numValue = typeof value === 'number' ? value : parseFloat(String(value));

  // Check if conversion resulted in valid number
  if (isNaN(numValue)) return '-';

  const formatted = numValue.toFixed(decimals);
  return numValue >= 0 ? ` ${formatted}` : formatted;
}
