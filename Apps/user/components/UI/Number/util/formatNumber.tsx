import { NumberFormat, NumberType } from "../Number";
import { applyCurrencyShortFormat } from "./applyCurrencyShortFormat";
import { formatWithType } from "./formatWithType";

// This function formats a number based on the given format and locale.
// It supports different number formats (none, currency, percentage, decimal) and different number types (standard, scientific, engineering).
// It also supports short format for large numbers.
// 
// Parameters:
// value: The number to format.
// format: The format to use for the number (none, currency, percentage, decimal).
// decimalPlaces: The number of decimal places to use.
// locale: The locale to use for the number.
// currencyType: The currency type to use for the number.
// useShortFormat: Whether to use short format for large numbers.
// numberType: The number type to use for the number (standard, scientific, engineering).
// maxNumberPlaces: The maximum number of places to use for the number.
// Returns: The formatted number as a string.

export const formatNumber = (
  value: number | string,
  format: NumberFormat = 'none',
  decimalPlaces: number = 0,
  locale: string = 'en-US',
  currencyType: string = 'USD',
  useShortFormat: boolean = false,
  numberType: NumberType = 'standard',
  maxNumberPlaces: number = 0
): string => {
  if (typeof value === 'string') return value;
  if (typeof value !== 'number') return 'NaN';
  const num = Number(value);

  switch (format) {
    case 'currency':
      return useShortFormat 
        ? applyCurrencyShortFormat(num, maxNumberPlaces, decimalPlaces, locale, currencyType)
        : new Intl.NumberFormat(locale, {
            style: 'currency',
            currency: currencyType,
            minimumFractionDigits: decimalPlaces,
            maximumFractionDigits: decimalPlaces,
          }).format(num);
    case 'percentage':
      return new Intl.NumberFormat(locale, {
        style: 'percent',
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces,
      }).format(num);
    case 'decimal':
      return formatWithType(num, useShortFormat, maxNumberPlaces, decimalPlaces, numberType, locale);
    default:
      return formatWithType(num, useShortFormat, maxNumberPlaces, decimalPlaces, numberType, locale);
  }
};