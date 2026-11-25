import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UserRole } from './users';

interface StoredState {
  origins: { localStorage: { name: string; value: string }[] }[];
}

const expiryMarginSeconds = 60;

export const storedSessionRoles: readonly UserRole[] = ['client'];

export function storageStatePath(role: UserRole): string {
  return join(__dirname, '..', '..', 'playwright', '.auth', `${role}.json`);
}

export function hasStoredSession(role: UserRole): boolean {
  return storedSessionRoles.includes(role);
}

export function validStorageStatePath(role: UserRole): string {
  const path = storageStatePath(role);
  if (!existsSync(path)) {
    throw new Error(
      `No stored ${role} session at ${path}. Run the setup project first (drop --no-deps).`,
    );
  }
  const expiresAt = tokenExpiry(path);
  if (expiresAt - expiryMarginSeconds <= Date.now() / 1000) {
    throw new Error(
      `The stored ${role} session expired at ${new Date(expiresAt * 1000).toISOString()}. Run the setup project again (drop --no-deps).`,
    );
  }
  return path;
}

function tokenExpiry(path: string): number {
  const state = JSON.parse(readFileSync(path, 'utf8')) as StoredState;
  const token = state.origins
    .flatMap((origin) => origin.localStorage)
    .find((entry) => entry.name === 'token')?.value;
  const payload = token?.split('.')[1];
  if (payload === undefined) {
    throw new Error(`No JWT under localStorage "token" in ${path}`);
  }
  const { exp } = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { exp?: number };
  if (exp === undefined) {
    throw new Error(`The stored JWT in ${path} has no exp claim`);
  }
  return exp;
}
