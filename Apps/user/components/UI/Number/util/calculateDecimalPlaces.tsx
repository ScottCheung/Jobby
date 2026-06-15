// This function calculates the number of decimal places to use for a number.
// It supports different number formats (none, currency, percentage, decimal) and different number types (standard, scientific, engineering).
// It also supports short format for large numbers.
// 
// Parameters:
// num: The number to calculate the decimal places for.
// isShortFormat: Whether to use short format for large numbers.
// maxNumberPlaces: The maximum number of places to use for the number.
// decimalPlaces: The number of decimal places to use.
// Returns: The number of decimal places to use.

export const calculateDecimalPlaces = ( num: number, isShortFormat: boolean, maxNumberPlaces: number, decimalPlaces: number ): number =>
{
    if (maxNumberPlaces <= 0) return decimalPlaces;
    
    const absNum = Math.abs(num);
    if (absNum === 0) return decimalPlaces;
    
    let integerDigits = absNum >= 1 ? Math.floor(Math.log10(absNum)) + 1 : 0;
    
    if (isShortFormat) {
      if (absNum >= 1e3 && absNum < 1e6) integerDigits -= 3;
      else if (absNum >= 1e6 && absNum < 1e9) integerDigits -= 6;
      else if (absNum >= 1e9 && absNum < 1e12) integerDigits -= 9;
      else if (absNum >= 1e12 && absNum < 1e15) integerDigits -= 12;
      else if ( absNum >= 1e15 ) integerDigits -= 15;
    }
    
    return Math.max(0, maxNumberPlaces - integerDigits);
};
