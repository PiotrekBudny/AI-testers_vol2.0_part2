export type UserRole = 'client' | 'admin';

export interface User {
  role: UserRole;
  username: string;
  password: string;
  displayName: string;
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing environment variable ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export function getUser(role: UserRole): User {
  const prefix = role.toUpperCase();
  return {
    role,
    username: requireEnv(`${prefix}_USERNAME`),
    password: requireEnv(`${prefix}_PASSWORD`),
    displayName: requireEnv(`${prefix}_DISPLAY_NAME`),
  };
}
