import { existsSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { ApiSessions, storageStateFor } from '../api/apiSessions';
import { AuthApi } from '../api/authApi';
import type { UserRole } from '../config/users';
import { ProductGenerator } from '../generators/productGenerator';
import { readHar, sanitizeHar, writeHar } from '../har/harFile';
import { CartItemsMock } from '../mocks/cartItemsMock';
import { FakeProductSearchMock } from '../mocks/fakeProductSearchMock';
import { HarReplayMock } from '../mocks/harReplayMock';
import { LivePatchedProductSearchMock } from '../mocks/livePatchedProductSearchMock';
import type { ApiSession } from '../models/auth';
import { DashboardPage } from '../pages/dashboardPage';
import { LoginPage } from '../pages/loginPage';
import { ProductsPage } from '../pages/productsPage';

export type Options = {
  userRole: UserRole;
  skipAutoLogin: boolean;
  harRecording: boolean;
  harUpdate: boolean;
};

const harUrlFilter = /\/api\/v1\/(products|cart|currencies|users\/me)(\/|\?|$)/;

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  productsPage: ProductsPage;
  fakeProductSearchMock: FakeProductSearchMock;
  cartItemsMock: CartItemsMock;
  harReplayMock: HarReplayMock;
  livePatchedProductSearchMock: LivePatchedProductSearchMock;
  loginViaApi: ApiSession | null;
};

function requireBaseURL(baseURL: string | undefined): string {
  if (baseURL === undefined) {
    throw new Error(
      'baseURL is not set: API login and HAR replay need it (playwright.config.ts)',
    );
  }
  return baseURL;
}

type WorkerFixtures = {
  apiSessions: ApiSessions;
};

export const test = base.extend<Options & Fixtures, WorkerFixtures>({
  userRole: ['client', { option: true }],
  skipAutoLogin: [false, { option: true }],
  harRecording: [false, { option: true }],
  harUpdate: [false, { option: true }],
  apiSessions: [
    async ({ playwright }, use) => {
      const request = await playwright.request.newContext();
      await use(new ApiSessions(new AuthApi(request)));
      await request.dispose();
    },
    { scope: 'worker' },
  ],
  loginViaApi: [
    async ({ skipAutoLogin, userRole, apiSessions, baseURL }, use) => {
      if (skipAutoLogin) {
        await use(null);
        return;
      }
      await use(await apiSessions.get(userRole, requireBaseURL(baseURL)));
    },
    { auto: true },
  ],
  storageState: async ({ loginViaApi, baseURL }, use) => {
    await use(
      loginViaApi === null
        ? undefined
        : storageStateFor(loginViaApi, requireBaseURL(baseURL)),
    );
  },
  contextOptions: async ({ contextOptions, harRecording }, use, testInfo) => {
    if (!harRecording) {
      await use(contextOptions);
      return;
    }
    const harPath = testInfo.outputPath('network.har');
    await use({
      ...contextOptions,
      recordHar: {
        path: harPath,
        urlFilter: harUrlFilter,
        mode: 'minimal',
        content: 'embed',
      },
    });
    if (!existsSync(harPath)) {
      return;
    }
    writeHar(harPath, sanitizeHar(readHar(harPath)));
    await testInfo.attach('network.har', {
      path: harPath,
      contentType: 'application/json',
    });
  },
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  dashboardPage: async ({ page }, use) => {
    await use(new DashboardPage(page));
  },
  productsPage: async ({ page }, use) => {
    await use(new ProductsPage(page));
  },
  fakeProductSearchMock: async ({ page }, use) => {
    const mock = new FakeProductSearchMock(
      page,
      new ProductGenerator().generateProducts(8),
    );
    await mock.register();
    await use(mock);
  },
  cartItemsMock: async ({ page, loginViaApi, fakeProductSearchMock }, use) => {
    const mock = new CartItemsMock(
      page,
      loginViaApi?.user.username ?? '',
      () => fakeProductSearchMock.products,
    );
    await mock.register();
    await use(mock);
  },
  harReplayMock: async ({ page, harUpdate, baseURL }, use, testInfo) => {
    const mock = new HarReplayMock(
      page,
      harUpdate,
      testInfo.outputPath('har-work'),
      requireBaseURL(baseURL),
    );
    await use(mock);
    await mock.finishRecording(testInfo.status === 'passed');
  },
  livePatchedProductSearchMock: async ({ page }, use) => {
    await use(new LivePatchedProductSearchMock(page));
  },
});

export { expect };
