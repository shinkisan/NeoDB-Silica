export type NeodbVisibility = 0 | 1 | 2;

export function isNeodbVisibility(value: unknown): value is NeodbVisibility {
  return value === 0 || value === 1 || value === 2;
}

export function normalizeNeodbVisibility(
  value: unknown,
  fallback: NeodbVisibility = 0,
): NeodbVisibility {
  const numericValue = Number(value);
  return isNeodbVisibility(numericValue) ? numericValue : fallback;
}
