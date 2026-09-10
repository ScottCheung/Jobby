/** @format */

import regularFont from './fonts/NotoSansCJKsc-Regular.otf';
import boldFont from './fonts/NotoSansCJKsc-Bold.otf';

export const RESUME_CJK_FONT_FAMILY = 'NotoSansCJKsc';
export const RESUME_CJK_FONT_REGULAR_URL = regularFont;
export const RESUME_CJK_FONT_BOLD_URL = boldFont;

const CJK_TEXT_PATTERN = /[\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]/u;

export function splitResumeText(value: string) {
  return value
    .split(/([\u3400-\u4DBF\u4E00-\u9FFF\uF900-\uFAFF\u3040-\u30FF\uAC00-\uD7AF]+)/u)
    .filter(Boolean)
    .map((text) => ({ text, isCjk: CJK_TEXT_PATTERN.test(text) }));
}

export function cjkFallbackStyle(style?: any) {
  const styleItems = Array.isArray(style) ? style : [style];
  const fontFamily = styleItems.find((item) => item?.fontFamily)?.fontFamily;
  const fontWeight = styleItems.find((item) => item?.fontWeight)?.fontWeight;
  const fontStyle = styleItems.find((item) => item?.fontStyle)?.fontStyle;

  return {
    fontFamily: RESUME_CJK_FONT_FAMILY,
    ...(fontWeight !== undefined ? { fontWeight } : {}),
    ...(fontStyle !== undefined ? { fontStyle } : {}),
    ...(fontWeight === undefined && fontFamily?.includes('Bold') ? { fontWeight: 700 } : {}),
    ...(fontStyle === undefined && fontFamily?.includes('Oblique') ? { fontStyle: 'italic' } : {}),
  };
}
