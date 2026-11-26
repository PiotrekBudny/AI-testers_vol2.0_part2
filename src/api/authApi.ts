import type { APIRequestContext } from '@playwright/test';
import type { User } from '@/config/users';
import type { ApiSession, LoginRequest, LoginResponse } from '@/models/auth';

export class AuthApi {
  static readonly signInPath = '/api/v1/users/signin';

  constructor(private readonly request: APIRequestContext) {}

  async signIn(user: User, baseURL: string): Promise<ApiSession> {
    const data: LoginRequest = {
      username: user.username,
      password: user.password,
    };
    const response = await this.request.post(
      new URL(AuthApi.signInPath, baseURL).href,
      { data },
    );
    if (!response.ok()) {
      throw new Error(
        `API sign-in as ${user.username} failed with ${response.status()}`,
      );
    }
    const body = (await response.json()) as LoginResponse;
    if (body.mfaRequired) {
      throw new Error(`API sign-in as ${user.username} requires MFA`);
    }
    if (!body.token || !body.refreshToken) {
      throw new Error(`API sign-in as ${user.username} returned no tokens`);
    }
    return {
      user,
      token: body.token,
      refreshToken: body.refreshToken,
      expiresAt: jwtExpiry(body.token),
    };
  }
}

function jwtExpiry(token: string): number {
  const payload = token.split('.')[1];
  if (payload === undefined) {
    throw new Error('The sign-in token is not a JWT');
  }
  const { exp } = JSON.parse(
    Buffer.from(payload, 'base64url').toString('utf8'),
  ) as { exp?: number };
  if (exp === undefined) {
    throw new Error('The sign-in JWT has no exp claim');
  }
  return exp;
}
