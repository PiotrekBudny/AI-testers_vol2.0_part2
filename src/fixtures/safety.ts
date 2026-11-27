import type { BrowserContext, Request } from '@playwright/test';
import { apiRoutes } from '@/api/endpoints';
import { tagPolicyViolations } from '@/config/testTags';
import { sessionTest } from './session';

type Safety = {
  tagPolicy: undefined;
  adminWriteGuard: undefined;
  signupGuard: undefined;
};

type RequestFilter = (request: Request) => boolean;

async function blockUnmockedRequests(
  context: BrowserContext,
  route: string | RegExp,
  shouldBlock: RequestFilter,
  guardName: string,
): Promise<() => void> {
  const blocked: string[] = [];
  await context.route(route, async (unmocked) => {
    const request = unmocked.request();
    if (!shouldBlock(request)) {
      await unmocked.fallback();
      return;
    }
    blocked.push(`${request.method()} ${request.url()}`);
    await unmocked.fulfill({
      status: 418,
      json: { message: `Blocked by ${guardName}` },
    });
  });
  return () => {
    if (blocked.length > 0) {
      throw new Error(
        `${guardName} blocked requests that no mock handled: ${blocked.join(', ')}`,
      );
    }
  };
}

const anyRequest: RequestFilter = () => true;
const nonGetRequest: RequestFilter = (request) => request.method() !== 'GET';

export const safetyTest = sessionTest.extend<Safety>({
  tagPolicy: [
    async ({ userRole: _userRole }, use, testInfo) => {
      const violations = tagPolicyViolations(testInfo.tags);
      if (violations.length > 0) {
        throw new Error(
          `"${testInfo.title}" needs ${violations.join(' and ')}. See "Test categories" in CLAUDE.md.`,
        );
      }
      await use(undefined);
    },
    { auto: true },
  ],
  adminWriteGuard: [
    async ({ context, userRole }, use) => {
      if (userRole !== 'admin') {
        await use(undefined);
        return;
      }
      const expectNothingBlocked = await blockUnmockedRequests(
        context,
        '**/api/**',
        nonGetRequest,
        'adminWriteGuard',
      );
      await use(undefined);
      expectNothingBlocked();
    },
    { auto: true },
  ],
  signupGuard: [
    async ({ context }, use) => {
      const expectNothingBlocked = await blockUnmockedRequests(
        context,
        apiRoutes.signUp,
        anyRequest,
        'signupGuard',
      );
      await use(undefined);
      expectNothingBlocked();
    },
    { auto: true },
  ],
});
