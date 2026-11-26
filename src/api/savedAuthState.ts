import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, rename, rmdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { request } from '@playwright/test';
import { getUser, type UserRole } from '@/config/users';
import { AuthApi } from './authApi';

export const authDirectoryEnv = 'AI_TESTERS_AUTH_DIR';

const signInTimeoutMs = 15_000;
const waitForStateTimeoutMs = 20_000;
const statePollIntervalMs = 100;

export async function savedAuthStateFor(
  role: UserRole,
  baseURL: string,
): Promise<string> {
  const directory = process.env[authDirectoryEnv];
  if (!directory) {
    throw new Error('Global setup did not create the auth state directory');
  }

  const origin = new URL(baseURL).origin;
  const originKey = createHash('sha256').update(origin).digest('hex');
  const file = join(directory, `${role}-${originKey}.json`);
  const lock = `${file}.lock`;
  const deadline = Date.now() + waitForStateTimeoutMs;

  while (!existsSync(file)) {
    if (await tryAcquireLock(lock)) {
      try {
        if (!existsSync(file)) {
          await writeAuthState(file, role, origin);
        }
      } finally {
        await rmdir(lock);
      }
      break;
    }

    if (Date.now() >= deadline) {
      throw new Error(`Timed out waiting for saved ${role} auth state`);
    }
    await delay(statePollIntervalMs);
  }

  return file;
}

async function tryAcquireLock(lock: string): Promise<boolean> {
  try {
    await mkdir(lock, { mode: 0o700 });
    return true;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

async function writeAuthState(
  file: string,
  role: UserRole,
  origin: string,
): Promise<void> {
  const user = getUser(role);
  const apiRequest = await request.newContext({ timeout: signInTimeoutMs });
  try {
    const { token, refreshToken } = await new AuthApi(apiRequest).signIn(
      user,
      origin,
    );
    const state = {
      cookies: [],
      origins: [
        {
          origin,
          localStorage: [
            { name: 'token', value: token },
            { name: 'refreshToken', value: refreshToken },
          ],
        },
      ],
    };
    const pendingFile = `${file}.pending`;
    await writeFile(pendingFile, JSON.stringify(state), { mode: 0o600 });
    await rename(pendingFile, file);
  } finally {
    await apiRequest.dispose();
  }
}
