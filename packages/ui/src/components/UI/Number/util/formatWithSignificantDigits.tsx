// This function formats a number with significant digits.
// It supports different number types (standard, scientific, engineering).
// It also supports short format for large numbers.
// 
// Parameters:
// num: The number to format.
// type: The type of number to format (scientific, engineering).
// decimalPlaces: The number of decimal places to use.
// maxNumberPlaces: The maximum number of places to use for the number.
// Returns: The formatted number as a string.   

export const formatWithSignificantDigits = (
  num: number,
  type: 'scientific' | 'engineering',
  decimalPlaces: number,
  maxNumberPlaces: number
): string => {
  // 辅助函数：将指数数字转换为上标
  const toSuperscript = (numStr: string) => {
    const superscripts: { [key: string]: string } = {
      '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵',
      '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹', '+': '⁺', '-': '⁻'
    };
    return numStr.split('').map(c => superscripts[c] || c).join('');
  };

  // 辅助函数：精确分解数字为科学计数法各部分
  const toExactExponential = (n: number) => {
    const str = n.toExponential(20); // 获取最大精度表示
    const [significand, exponent] = str.split('e');
    const [integerPart, fractionalPart] = significand.split('.');
    
    return {
      integer: integerPart,
      fractional: fractionalPart || '',
      exponent: parseInt(exponent, 10)
    };
  };

  // 核心处理逻辑
  const processEngineeringNotation = () => {
    const { integer, fractional, exponent } = toExactExponential(num);
    
    // 合并所有有效数字
    const allDigits = integer + fractional;
    
    // 计算实际有效位数
    const firstSigIndex = allDigits.search(/[1-9]/);
    const sigDigits = firstSigIndex >= 0 
      ? allDigits.slice(firstSigIndex).replace(/0+$/, '') 
      : '0';

    // 确定需要保留的有效位数
    const targetLength = maxNumberPlaces > 0 
      ? Math.min(sigDigits.length, maxNumberPlaces) 
      : sigDigits.length;

    // 获取有效数字部分（不四舍五入）
    const keptDigits = sigDigits.slice(0, targetLength);
    
    // 计算调整后的指数
    let adjustedExp = exponent - (integer.length - 1);
    const remainder = adjustedExp % 3;
    const adjustment = remainder !== 0 
      ? (adjustedExp >= 0 ? remainder : 3 + remainder) 
      : 0;
    
    adjustedExp -= adjustment;
    const shiftAmount = adjustment;

    // 重建系数
    let coefficientDigits = keptDigits;
    if (shiftAmount > 0) {
      coefficientDigits += '0'.repeat(shiftAmount);
      coefficientDigits = coefficientDigits.slice(0, targetLength);
    } else if (shiftAmount < 0) {
      coefficientDigits = coefficientDigits.padStart(targetLength - shiftAmount, '0');
      coefficientDigits = coefficientDigits.slice(-targetLength);
    }

    // 格式化为工程计数法
    const formattedCoefficient = coefficientDigits.length > 1 
      ? `${coefficientDigits[0]}.${coefficientDigits.slice(1)}`
      : coefficientDigits;

    return {
      coefficient: formattedCoefficient.replace(/\.?0+$/, ''),
      exponent: adjustedExp + (integer.length - 1) + adjustment
    };
  };

  if (type === 'engineering') {
    const { coefficient, exponent } = processEngineeringNotation();
    return `${coefficient}×10${toSuperscript(exponent.toString())}`;
  }

  // 处理科学计数法
  const { coefficient, exponent } = (() => {
    const { integer, fractional, exponent } = toExactExponential(num);
    const targetLength = maxNumberPlaces > 0 
      ? Math.min(integer.length + fractional.length, maxNumberPlaces)
      : integer.length + fractional.length;

    const keptDigits = (integer + fractional).slice(0, targetLength);
    const formattedCoefficient = keptDigits.length > 1 
      ? `${keptDigits[0]}.${keptDigits.slice(1)}`
      : keptDigits;

    return {
      coefficient: formattedCoefficient,
      exponent: exponent
    };
  })();

  return `${coefficient}×10${toSuperscript(exponent.toString())}`;
};