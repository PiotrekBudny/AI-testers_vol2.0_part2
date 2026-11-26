import { mkdtempDisposable } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { authDirectoryEnv } from '@/api/savedAuthState';

export default async function globalSetup(): Promise<() => Promise<void>> {
  const directory = await mkdtempDisposable(join(tmpdir(), 'ai-testers-auth-'));
  process.env[authDirectoryEnv] = directory.path;

  return async () => {
    delete process.env[authDirectoryEnv];
    await directory.remove();
  };
}
