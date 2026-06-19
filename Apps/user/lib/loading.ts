/** @format */

export const MINIMUM_LOADING_MS = 1000;

export async function withMinimumLoadingTime<T>(
  work: Promise<T>,
  minimumMs = MINIMUM_LOADING_MS,
): Promise<T> {
  const [result] = await Promise.all([
    work,
    new Promise((resolve) => window.setTimeout(resolve, minimumMs)),
  ]);

  return result;
}
