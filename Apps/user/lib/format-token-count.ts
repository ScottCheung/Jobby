export function formatTokenCount(value: number): string {
  const count = Number.isFinite(value) ? Math.max(value, 0) : 0;
  const format = (amount: number, suffix: string) => `${Number(amount.toFixed(1))}${suffix}`;

  if (count < 1_000) return Math.round(count).toLocaleString();
  if (count < 1_000_000) return format(count / 1_000, 'K');
  return format(count / 1_000_000, 'M');
}
