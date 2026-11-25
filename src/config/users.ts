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

function credentialVariables(role: UserRole) {
  const prefix = role.toUpperCase();
  return {
    username: `${prefix}_USERNAME`,
    password: `${prefix}_PASSWORD`,
    displayName: `${prefix}_DISPLAY_NAME`,
  };
}

export function hasCredentials(role: UserRole): boolean {
  return Object.values(credentialVariables(role)).every(
    (name) => !!process.env[name],
  );
}

export function requireCredentials(role: UserRole): void {
  getUser(role);
}

export function getUser(role: UserRole): User {
  const variables = credentialVariables(role);
  return {
    role,
    username: requireEnv(variables.username),
    password: requireEnv(variables.password),
    displayName: requireEnv(variables.displayName),
  };
}
