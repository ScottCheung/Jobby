export type CelebrationBurstIntensity = 'light' | 'full';

export async function fireCelebrationBurst(
  intensity: CelebrationBurstIntensity,
): Promise<void> {
  const { default: confetti } = await import('canvas-confetti');
  const isFull = intensity === 'full';
  confetti({
    particleCount: isFull ? 100 : 36,
    spread: isFull ? 70 : 58,
    startVelocity: isFull ? 32 : 24,
    scalar: isFull ? 1 : 0.8,
    origin: { y: 0.62 },
    zIndex: 2147483647,
  });
}
