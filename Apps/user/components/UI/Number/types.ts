
export type NumberFormat = 'none' | 'currency' | 'percentage' | 'decimal';

export type NumberType =
    | 'standard' // 标准数字格式
    | 'scientific' // 科学计数法
    | 'engineering'; // 工程计数法

export type AnimationType = 'flip' | 'slide' | 'fade' | 'none';

export interface AnimatedNumberProps {
    value: number | string;
    format?: NumberFormat;
    animation?: AnimationType;
    duration?: number;
    debounceDuration?: number;
    decimalPlaces?: number;
    prefix?: string;
    suffix?: string;
    locale?: string;
    maxNumberPlaces?: number;
    delayPerChar?: number;
    currencyType?: string;
    useShortFormat?: boolean;
    numberType?: NumberType;
    currencySymbolSize?: string;
    integerPartSize?: string;
    decimalPartSize?: string;
    suffixSize?: string;
    commaWidth?: string;
    className?: string;
}
