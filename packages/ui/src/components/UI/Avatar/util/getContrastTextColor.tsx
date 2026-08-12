// 颜色转 RGB（支持 #rgb, #rrggbb, rgb(), hsl(), 颜色名等）
const parseColorToRGB = (color: string): [number, number, number] | null => {
  if (typeof document === 'undefined') {
    return null;
  }
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = '#000'; // 默认
  ctx.fillStyle = color; // 尝试设置颜色
  const computed = ctx.fillStyle;

  // 创建透明画布，再涂色，取像素值
  ctx.fillRect(0, 0, 1, 1);
  const imageData = ctx.getImageData(0, 0, 1, 1).data;
  return [imageData[0], imageData[1], imageData[2]];
};

// 判断黑字或白字更清晰
const getContrastTextColor = (color: string): 'black' | 'white' => {
  const rgb = parseColorToRGB(color);
  if (!rgb) return 'black'; // fallback

  const [r, g, b] = rgb;
  const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
  return luminance > 186 ? 'black' : 'white';
};

export default getContrastTextColor;
