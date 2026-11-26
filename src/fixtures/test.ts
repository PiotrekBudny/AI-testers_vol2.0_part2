import { existsSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { savedAuthStateFor } from '@/api/savedAuthState';
import { ProductSearchTraffic } from '@/assertions/productSearchTraffic';
import { SignInTraffic } from '@/assertions/signInTraffic';
import { tagPolicyViolations } from '@/config/testTags';
import { getUser, type UserRole } from '@/config/users';
import { ProductGenerator } from '@/generators/productGenerator';
import { readHar, sanitizeHar, writeHar } from '@/har/harFile';
import { ApiErrorMock } from '@/mocks/apiErrorMock';
import { CartMock } from '@/mocks/cartMock';
import { FakeProductDetailsMock } from '@/mocks/fakeProductDetailsMock';
import { FakeProductSearchMock } from '@/mocks/fakeProductSearchMock';
import { HarReplayMock } from '@/mocks/harReplayMock';
import { LivePatchedProductDetailsMock } from '@/mocks/livePatchedProductDetailsMock';
import { LivePatchedProductSearchMock } from '@/mocks/livePatchedProductSearchMock';
import { NetworkErrorMock } from '@/mocks/networkErrorMock';
import { CartPage } from '@/pages/cartPage';
import { DashboardPage } from '@/pages/dashboardPage';
import { ForgotPasswordPage } from '@/pages/forgotPasswordPage';
import { LoginPage } from '@/pages/loginPage';
import { ProductDetailsPage } from '@/pages/productDetailsPage';
import { ProductsPage } from '@/pages/productsPage';
import { RegisterPage } from '@/pages/registerPage';

export type Options = {
  userRole: UserRole;
  harRecording: boolean;
};

const DETAILS_PRODUCT_ID_FLOOR = 10_000;

const harUrlFilter = /\/api\/v1\/(products|cart|currencies|users\/me)(\/|\?|$)/;

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  productsPage: ProductsPage;
  productDetailsPage: ProductDetailsPage;
  cartPage: CartPage;
  forgotPasswordPage: ForgotPasswordPage;
  registerPage: RegisterPage;
  signInTraffic: SignInTraffic;
  productSearchTraffic: ProductSearchTraffic;
  fakeProductSearchMock: FakeProductSearchMock;
  fakeProductDetailsMock: FakeProductDetailsMock;
  cartMock: CartMock;
  apiErrorMock: ApiErrorMock;
  networkErrorMock: NetworkErrorMock;
  harReplayMock: HarReplayMock;
  livePatchedProductSearchMock: LivePatchedProductSearchMock;
  livePatchedProductDetailsMock: LivePatchedProductDetailsMock;
  tagPolicy: undefined;
};

function requireBaseURL(baseURL: string | undefined): string {
  if (baseURL === undefined) {
    throw new Error(
      'baseURL is not set: API login and HAR replay need it (playwright.config.ts)',
    );
  }
  return baseURL;
}

export const test = base.extend<Options & Fixtures>({
  userRole: ['client', { option: true }],
  harRecording: [false, { option: true }],
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
  storageState: async ({ userRole, baseURL }, use) => {
    await use(await savedAuthStateFor(userRole, requireBaseURL(baseURL)));
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
    const har = sanitizeHar(readHar(harPath));
    writeHar(harPath, har);
    if (har.log.entries.length === 0) {
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
  productDetailsPage: async ({ page }, use) => {
    await use(new ProductDetailsPage(page));
  },
  cartPage: async ({ page }, use) => {
    await use(new CartPage(page));
  },
  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  signInTraffic: async ({ page }, use) => {
    await use(new SignInTraffic(page));
  },
  productSearchTraffic: async ({ page }, use) => {
    await use(new ProductSearchTraffic(page));
  },
  fakeProductSearchMock: async ({ page }, use) => {
    const mock = new FakeProductSearchMock(
      page,
      new ProductGenerator().generateProducts(8),
    );
    await mock.register();
    await use(mock);
  },
  fakeProductDetailsMock: async ({ page }, use) => {
    const mock = new FakeProductDetailsMock(
      page,
      new ProductGenerator().generateProduct({
        id: DETAILS_PRODUCT_ID_FLOOR + Math.floor(Math.random() * 90_000),
        stockQuantity: 5 + Math.floor(Math.random() * 46),
      }),
    );
    await mock.register();
    await use(mock);
  },
  cartMock: async (
    { page, userRole, fakeProductSearchMock, fakeProductDetailsMock },
    use,
  ) => {
    fakeProductDetailsMock.alsoServe(() => fakeProductSearchMock.products);
    const mock = new CartMock(page, getUser(userRole).username, () => [
      ...fakeProductSearchMock.products,
      fakeProductDetailsMock.product,
    ]);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  apiErrorMock: async ({ page }, use) => {
    await use(new ApiErrorMock(page));
  },
  networkErrorMock: async ({ page }, use) => {
    await use(new NetworkErrorMock(page));
  },
  harReplayMock: async ({ page, baseURL, userRole }, use, testInfo) => {
    await use(
      new HarReplayMock(
        page,
        testInfo.outputPath('har-work'),
        requireBaseURL(baseURL),
        userRole,
      ),
    );
  },
  livePatchedProductSearchMock: async ({ page }, use) => {
    await use(new LivePatchedProductSearchMock(page));
  },
  livePatchedProductDetailsMock: async ({ page }, use) => {
    await use(new LivePatchedProductDetailsMock(page));
  },
});

export { expect };
