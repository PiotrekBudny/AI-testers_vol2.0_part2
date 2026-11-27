export function toBackendTimestamp(date: Date): string {
  return date.toISOString().replace('Z', '');
}

export function fromBackendTimestamp(timestamp: string): Date {
  return new Date(`${timestamp}Z`);
}

export function fixedTimestamp(dayOfNovember: number): string {
  return `2026-11-${String(dayOfNovember).padStart(2, '0')}T10:00:00.000001`;
}

export const BASE_TIMESTAMP = fixedTimestamp(20);
