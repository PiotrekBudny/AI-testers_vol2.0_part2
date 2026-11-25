import { existsSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { hasStoredSession, validStorageStatePath } from '../config/authState';
import {
  getUser,
  requireCredentials,
  type User,
  type UserRole,
} from '../config/users';
import { ProductGenerator } from '../generators/productGenerator';
import { CartItemsMock } from '../mocks/cartItemsMock';
import { HarMock } from '../mocks/harMock';
import { ProductSearchLiveMock } from '../mocks/productSearchLiveMock';
import { ProductSearchMock } from '../mocks/productSearchMock';
import { DashboardPage } from '../pages/dashboardPage';
import { LoginPage } from '../pages/loginPage';
import { ProductsPage } from '../pages/productsPage';

export type Options = {
  userRole: UserRole | null;
  harRecording: boolean;
  harUpdate: boolean;
};

const harUrlFilter = /\/api\/v1\/(products|cart|currencies|users\/me)(\/|\?|$)/;

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  productsPage: ProductsPage;
  productSearchMock: ProductSearchMock;
  cartItemsMock: CartItemsMock;
  harMock: HarMock;
  productSearchLiveMock: ProductSearchLiveMock;
  loggedInUser: User | null;
};

export const test = base.extend<Options & Fixtures>({
  userRole: ['client', { option: true }],
  harRecording: [false, { option: true }],
  harUpdate: [false, { option: true }],
  storageState: async ({ userRole, storageState }, use) => {
    if (userRole === null) {
      await use(undefined);
      return;
    }
    if (!hasStoredSession(userRole)) {
      await use(storageState);
      return;
    }
    requireCredentials(userRole);
    await use(validStorageStatePath(userRole));
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
  productSearchMock: async ({ page }, use) => {
    const mock = new ProductSearchMock(
      page,
      new ProductGenerator().generateProducts(8),
    );
    await mock.register();
    await use(mock);
  },
  cartItemsMock: async ({ page, loggedInUser, productSearchMock }, use) => {
    const mock = new CartItemsMock(
      page,
      loggedInUser?.username ?? '',
      () => productSearchMock.products,
    );
    await mock.register();
    await use(mock);
  },
  harMock: async ({ page, harUpdate }, use, testInfo) => {
    const mock = new HarMock(
      page,
      harUpdate,
      testInfo.outputPath('har-update'),
    );
    await use(mock);
    await mock.finishRecording(testInfo.status === testInfo.expectedStatus);
  },
  productSearchLiveMock: async ({ page }, use) => {
    await use(new ProductSearchLiveMock(page));
  },
  loggedInUser: [
    async ({ userRole, loginPage, dashboardPage }, use) => {
      if (userRole === null) {
        await use(null);
        return;
      }
      const user = getUser(userRole);
      if (hasStoredSession(userRole)) {
        await use(user);
        return;
      }
      await loginPage.goto();
      await loginPage.loginAs(user);
      await expect(dashboardPage.navigation.links.profile).toHaveText(
        user.displayName,
      );
      await use(user);
    },
    { auto: true },
  ],
});

export { expect };
