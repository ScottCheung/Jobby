import { NumberType } from "../Number";
import { applyShortFormat } from "./applyShortFormat";
import { formatWithSignificantDigits } from "./formatWithSignificantDigits";

// This function formats a number with significant digits.
// It supports different number types (standard, scientific, engineering).
// It also supports short format for large numbers.
// 
// Parameters:
// num: The number to format.
// useShortFormat: Whether to use short format for large numbers.
// maxNumberPlaces: The maximum number of places to use for the number.
// decimalPlaces: The number of decimal places to use.
// numberType: The number type to use for the number (standard, scientific, engineering).
// locale: The locale to use for the number.
// Returns: The formatted number as a string. 

// For example:
// formatWithType(1234567, true, 2, 2, 'standard', 'en-US') returns '1.2M'
// formatWithType(1234567, false, 2, 2, 'standard', 'en-US') returns '1,234,567'
// formatWithType(1234567, true, 2, 2, 'scientific', 'en-US') returns '1.23E6'
// formatWithType(1234567, true, 2, 2, 'engineering', 'en-US') returns '1.23E6'

export const formatWithType = ( num: number, useShortFormat: boolean, maxNumberPlaces: number, decimalPlaces: number, numberType: NumberType, locale: string ): string =>
{
  if ( useShortFormat ) return applyShortFormat( num, maxNumberPlaces, decimalPlaces );

  switch ( numberType )
  {
    case 'scientific':
      return formatWithSignificantDigits( num, 'scientific', decimalPlaces, maxNumberPlaces );
    case 'engineering':
      return formatWithSignificantDigits( num, 'engineering', decimalPlaces, maxNumberPlaces );
    default:
      return new Intl.NumberFormat( locale, {
        minimumFractionDigits: decimalPlaces,
        maximumFractionDigits: decimalPlaces
      } ).format( num );
  }
};