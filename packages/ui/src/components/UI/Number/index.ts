// Main component exports
export { Number } from './Number';
export { SimpleAnimatedNumber } from './components/SimpleAnimatedNumber';

// Type exports
export type {
  AnimatedNumberProps,
  AnimationType,
  NumberFormat,
  NumberType,
} from './types';

// Utility exports
export { getVariants } from './util/getAnimationVariants';
export { formatNumber } from './util/formatNumber';
export { parseFormattedNumber } from './util/parseFormattedNumber';
export {
  formatNumberValue,
  formatShort,
  formatToSignificantDigits,
} from './utils/numberFormatters';