export const SAFE_MOCK_ID_FLOOR = 90_000;

export const DETAILS_PRODUCT_ID_FLOOR = 10_000;

export const UNKNOWN_ID = 99_999_999;

export function randomDetailsProductId(): number {
  return (
    DETAILS_PRODUCT_ID_FLOOR +
    Math.floor(Math.random() * (SAFE_MOCK_ID_FLOOR - DETAILS_PRODUCT_ID_FLOOR))
  );
}

export function requireMockIds(kind: string, ids: number[]): void {
  const realLooking = ids.filter((id) => id < SAFE_MOCK_ID_FLOOR);
  if (realLooking.length > 0) {
    throw new Error(
      `Mocked ${kind} ids must be at least ${SAFE_MOCK_ID_FLOOR}, so a leaked request can't hit real data. Got ${realLooking.join(', ')}`,
    );
  }
}
