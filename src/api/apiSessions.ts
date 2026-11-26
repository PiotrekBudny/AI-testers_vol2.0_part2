import type { BrowserContextOptions } from '@playwright/test';
import { getUser, type UserRole } from '../config/users';
import type { ApiSession } from '../models/auth';
import type { AuthApi } from './authApi';

type StorageState = Exclude<BrowserContextOptions['storageState'], string>;

const renewBeforeExpirySeconds = 120;

export class ApiSessions {
  private readonly sessions = new Map<string, Promise<ApiSession>>();

  constructor(private readonly authApi: AuthApi) {}

  async get(role: UserRole, baseURL: string): Promise<ApiSession> {
    const cached = await this.sessions
      .get(this.key(role, baseURL))
      ?.catch(() => undefined);
    if (cached && !this.expiresSoon(cached)) {
      return cached;
    }
    return this.renew(role, baseURL);
  }

  renew(role: UserRole, baseURL: string): Promise<ApiSession> {
    const key = this.key(role, baseURL);
    const session = this.authApi.signIn(getUser(role), baseURL);
    this.sessions.set(key, session);
    session.catch(() => this.sessions.delete(key));
    return session;
  }

  private key(role: UserRole, baseURL: string): string {
    return `${new URL(baseURL).origin} ${role}`;
  }

  private expiresSoon(session: ApiSession): boolean {
    return session.expiresAt - renewBeforeExpirySeconds <= Date.now() / 1000;
  }
}

export function storageStateFor(
  session: ApiSession,
  baseURL: string,
): StorageState {
  return {
    cookies: [],
    origins: [
      {
        origin: new URL(baseURL).origin,
        localStorage: [
          { name: 'token', value: session.token },
          { name: 'refreshToken', value: session.refreshToken },
        ],
      },
    ],
  };
}
