import type { User } from '@/config/users';

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string | null;
  refreshToken: string | null;
  username: string;
  mfaRequired?: boolean;
}

export interface ApiSession {
  user: User;
  token: string;
  refreshToken: string;
  expiresAt: number;
}
