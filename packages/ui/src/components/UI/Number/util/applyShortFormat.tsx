import { calculateDecimalPlaces } from "./calculateDecimalPlaces";

// This function formats a number with short format.
// It supports different number formats (none, currency, percentage, decimal) and different number types (standard, scientific, engineering).
// It also supports short format for large numbers.
// 
// Parameters:
// num: The number to format.
// maxNumberPlaces: The maximum number of places to use for the number.
// decimalPlaces: The number of decimal places to use.
// Returns: The formatted number as a string.

export const applyShortFormat = ( num: number, maxNumberPlaces: number, decimalPlaces: number ): string =>
{
    const absNum = Math.abs(num);
    let divisor = 1;
    let suffix = '';
    
    if (absNum >= 1e15) { divisor = 1e15; suffix = 'Q'; }
    else if (absNum >= 1e12) { divisor = 1e12; suffix = 'T'; }
    else if (absNum >= 1e9) { divisor = 1e9; suffix = 'B'; }
    else if (absNum >= 1e6) { divisor = 1e6; suffix = 'M'; }
    else if (absNum >= 1e3) { divisor = 1e3; suffix = 'K'; }

    const scaledNum = num / divisor;
    const actualDecimalPlaces = calculateDecimalPlaces(scaledNum, true, maxNumberPlaces, decimalPlaces);
    
    let formatted = scaledNum.toFixed(actualDecimalPlaces);
    if (actualDecimalPlaces > 0) {
      formatted = formatted.replace(/\.?0+$/, '');
      if (formatted.endsWith('.')) formatted = formatted.slice(0, -1);
    }
    
    return `${formatted}${suffix}`;
};