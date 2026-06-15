const colorPalette = [
  '#64748b', // slate
  // '#475569', // slate dark
  // '#334155', // slate darker
  '#3b82f6', // blue
  '#2563eb', // blue deep
  '#0ea5e9', // sky
  '#06b6d4', // cyan
  '#14b8a6', // teal
  '#10b981', // emerald
  '#22c55e', // green
  '#84cc16', // lime
  '#eab308', // amber
  '#f59e0b', // orange
  '#ec4899', // pink
  '#a855f7', // violet
  '#8b5cf6', // indigo
];


export const getColorFromName = (name: string): string => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colorPalette[Math.abs(hash) % colorPalette.length];
};
