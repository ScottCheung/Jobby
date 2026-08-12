/**
 * Number formatting utility functions for SimpleAnimatedNumber component
 */

/**
 * Format a number to a specified number of significant digits
 * Makes sure to remove unnecessary trailing zeros
 *
 * @param value The number to format
 * @param precision The maximum number of significant digits to show
 * @returns The formatted number as a string
 */
export const formatToSignificantDigits = (
  value: number,
  precision: number,
): string => {
  if (value === 0) return '0';

  // Convert to precision significant digits
  const formatted = value.toPrecision(precision);

  // Remove trailing zeros and decimal point if needed
  return formatted.replace(/\.?0+$/, '');
};

/**
 * Formats a number using shorthand notation (K, M, B, etc.)
 *
 * @param value Number to format
 * @returns Formatted number with appropriate suffix
 */
export const formatShort = (value: number): string => {
  const abs = Math.abs(value);
  const thresholds = [
    { value: 1e15, suffix: 'P' },
    { value: 1e12, suffix: 'T' },
    { value: 1e9, suffix: 'B' },
    { value: 1e6, suffix: 'M' },
    { value: 1e3, suffix: 'K' },
  ];

  // Find appropriate threshold
  for (const { value: threshold, suffix } of thresholds) {
    if (abs >= threshold) {
      // For short format, only show 1 decimal place
      const normalized = value / threshold;
      const formatted = normalized.toFixed(1).replace(/\.0$/, '');
      return `${formatted}${suffix}`;
    }
  }

  // For small numbers, just return the integer value if it's a whole number
  if (Number.isInteger(value)) {
    return value.toString();
  }

  // Otherwise show the number with up to 1 decimal place
  return value.toFixed(1).replace(/\.0$/, '');
};

/**
 * Main number formatting function that delegates to specific formatters
 * based on configuration
 *
 * @param value Number to format
 * @param useShortFormat Whether to use shorthand (K, M, B) notation
 * @param maxSignificantDigits Maximum significant digits (only used if useShortFormat is false)
 * @returns Formatted number as a string
 */
export const formatNumberValue = (
  value: number,
  useShortFormat: boolean,
  maxSignificantDigits: number = 3,
): string => {
  // Handle NaN and invalid values
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }

  // Format according to settings - useShortFormat and maxSignificantDigits are mutually exclusive
  if (useShortFormat) {
    // When useShortFormat is true, ignore maxSignificantDigits
    return formatShort(value);
  } else {
    // Use significant digits format with maxSignificantDigits
    return formatToSignificantDigits(value, maxSignificantDigits);
  }
};
