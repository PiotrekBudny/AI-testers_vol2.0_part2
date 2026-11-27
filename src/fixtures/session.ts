import { test as base } from '@playwright/test';
import { savedAuthStateFor } from '@/api/savedAuthState';
import type { UserRole } from '@/config/users';

export type SessionOptions = {
  userRole: UserRole;
};

export function requireBaseURL(baseURL: string | undefined): string {
  if (baseURL === undefined) {
    throw new Error(
      'baseURL is not set: API login and HAR replay need it (playwright.config.ts)',
    );
  }
  return baseURL;
}

export const sessionTest = base.extend<SessionOptions>({
  userRole: ['client', { option: true }],
  storageState: async ({ userRole, baseURL }, use) => {
    await use(await savedAuthStateFor(userRole, requireBaseURL(baseURL)));
  },
});
