import { NumberFormat } from "../Number";
// This function is a helper function that parses a formatted number string into its currency symbol, integer part, and decimal part.
// It is used by the AnimatedNumber component to parse the formatted number string into its currency symbol, integer part, and decimal part.
// 
// Parameters:
// formattedValue: The formatted number string to parse.
// format: The format to use for the number (none, currency, percentage, decimal).
// locale: The locale to use for the number.
// currencyType: The currency type to use for the number.
// Returns: An object containing the currency symbol, integer part, and decimal part of the formatted number string.

export const parseFormattedNumber = (
  formattedValue: string,
  format: NumberFormat,
  currencyType: string
): { currencySymbol: string, integerPart: string, decimalPart: string } => {
  let result = {
    currencySymbol: '',
    integerPart: formattedValue,
    decimalPart: ''
  };

  if (format === 'currency') {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currencyType
    });
    const parts = formatter.formatToParts(0);
    const currencySymbol = parts.find(part => part.type === 'currency')?.value || '';
    
    const symbolIndex = formattedValue.indexOf(currencySymbol);
    if (symbolIndex !== -1) {
      result.currencySymbol = currencySymbol;
      const valueWithoutSymbol = formattedValue.replace(currencySymbol, '').trim();
      
      const decimalSeparator = parts.find(part => part.type === 'decimal')?.value || '.';
      const separatorIndex = valueWithoutSymbol.indexOf(decimalSeparator);
      
      if (separatorIndex !== -1) {
        result.integerPart = valueWithoutSymbol.substring(0, separatorIndex);
        result.decimalPart = decimalSeparator + valueWithoutSymbol.substring(separatorIndex + 1);
      } else {
        result.integerPart = valueWithoutSymbol;
      }
    }
  } else {
    const decimalSeparator = new Intl.NumberFormat('en-US').format(1.1).charAt(1);
    const separatorIndex = formattedValue.indexOf(decimalSeparator);
    
    if (separatorIndex !== -1) {
      result.integerPart = formattedValue.substring(0, separatorIndex);
      result.decimalPart = decimalSeparator + formattedValue.substring(separatorIndex + 1);
    }
  }

  return result;
};