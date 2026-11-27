export const ADMIN_MOCK_ID_FLOOR = 90_000;

export function requireMockIds(kind: string, ids: number[]): void {
  const realLooking = ids.filter((id) => id < ADMIN_MOCK_ID_FLOOR);
  if (realLooking.length > 0) {
    throw new Error(
      `Mocked ${kind} ids must be at least ${ADMIN_MOCK_ID_FLOOR}, so a leaked request can't hit real data. Got ${realLooking.join(', ')}`,
    );
  }
}
