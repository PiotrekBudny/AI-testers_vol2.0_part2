import { existsSync } from 'node:fs';
import { test as base, expect } from '@playwright/test';
import { savedAuthStateFor } from '@/api/savedAuthState';
import { ProductSearchTraffic } from '@/assertions/productSearchTraffic';
import { SignInTraffic } from '@/assertions/signInTraffic';
import { tagPolicyViolations } from '@/config/testTags';
import { getUser, type UserRole } from '@/config/users';
import { ProductGenerator } from '@/generators/productGenerator';
import { readHar, sanitizeHar, writeHar } from '@/har/harFile';
import { AdminCatalogMock } from '@/mocks/adminCatalogMock';
import { AdminInventoryMock } from '@/mocks/adminInventoryMock';
import { AdminOrdersMock } from '@/mocks/adminOrdersMock';
import { ApiErrorMock } from '@/mocks/apiErrorMock';
import { CartMock } from '@/mocks/cartMock';
import { CheckoutMock } from '@/mocks/checkoutMock';
import { FakeProductDetailsMock } from '@/mocks/fakeProductDetailsMock';
import { FakeProductSearchMock } from '@/mocks/fakeProductSearchMock';
import { HarReplayMock } from '@/mocks/harReplayMock';
import { LivePatchedProductDetailsMock } from '@/mocks/livePatchedProductDetailsMock';
import { LivePatchedProductSearchMock } from '@/mocks/livePatchedProductSearchMock';
import { NetworkErrorMock } from '@/mocks/networkErrorMock';
import { AdminDashboardPage } from '@/pages/adminDashboardPage';
import { AdminInventoryPage } from '@/pages/adminInventoryPage';
import { AdminOrderDetailsPage } from '@/pages/adminOrderDetailsPage';
import { AdminOrdersPage } from '@/pages/adminOrdersPage';
import { AdminProductsPage } from '@/pages/adminProductsPage';
import { CartPage } from '@/pages/cartPage';
import { CheckoutPage } from '@/pages/checkoutPage';
import { DashboardPage } from '@/pages/dashboardPage';
import { ForgotPasswordPage } from '@/pages/forgotPasswordPage';
import { LoginPage } from '@/pages/loginPage';
import { PaymentPage } from '@/pages/paymentPage';
import { ProductDetailsPage } from '@/pages/productDetailsPage';
import { ProductsPage } from '@/pages/productsPage';
import { RegisterPage } from '@/pages/registerPage';

export type Options = {
  userRole: UserRole;
  harRecording: boolean;
};

const DETAILS_PRODUCT_ID_FLOOR = 10_000;

const harUrlFilter =
  /\/api\/v1\/(products|cart|currencies|users\/me|orders|admin\/inventory)(\/|\?|$)/;

type Fixtures = {
  adminDashboardPage: AdminDashboardPage;
  adminProductsPage: AdminProductsPage;
  adminOrdersPage: AdminOrdersPage;
  adminOrderDetailsPage: AdminOrderDetailsPage;
  adminInventoryPage: AdminInventoryPage;
  adminCatalogMock: AdminCatalogMock;
  adminOrdersMock: AdminOrdersMock;
  adminInventoryMock: AdminInventoryMock;
  adminWriteGuard: undefined;
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  productsPage: ProductsPage;
  productDetailsPage: ProductDetailsPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  paymentPage: PaymentPage;
  forgotPasswordPage: ForgotPasswordPage;
  registerPage: RegisterPage;
  signInTraffic: SignInTraffic;
  productSearchTraffic: ProductSearchTraffic;
  fakeProductSearchMock: FakeProductSearchMock;
  fakeProductDetailsMock: FakeProductDetailsMock;
  cartMock: CartMock;
  checkoutMock: CheckoutMock;
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
  adminWriteGuard: [
    async ({ context, userRole }, use) => {
      if (userRole !== 'admin') {
        await use(undefined);
        return;
      }
      const blocked: string[] = [];
      await context.route('**/api/**', async (route) => {
        const request = route.request();
        if (request.method() === 'GET') {
          await route.fallback();
          return;
        }
        blocked.push(`${request.method()} ${request.url()}`);
        await route.fulfill({
          status: 418,
          json: { message: 'Blocked by adminWriteGuard' },
        });
      });
      await use(undefined);
      if (blocked.length > 0) {
        throw new Error(
          `adminWriteGuard blocked writes that no mock handled: ${blocked.join(', ')}`,
        );
      }
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
  checkoutPage: async ({ page }, use) => {
    await use(new CheckoutPage(page));
  },
  paymentPage: async ({ page }, use) => {
    await use(new PaymentPage(page));
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
  checkoutMock: async ({ page, userRole, cartMock }, use) => {
    const mock = new CheckoutMock(page, getUser(userRole).username, cartMock);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  adminDashboardPage: async ({ page }, use) => {
    await use(new AdminDashboardPage(page));
  },
  adminProductsPage: async ({ page }, use) => {
    await use(new AdminProductsPage(page));
  },
  adminOrdersPage: async ({ page }, use) => {
    await use(new AdminOrdersPage(page));
  },
  adminOrderDetailsPage: async ({ page }, use) => {
    await use(new AdminOrderDetailsPage(page));
  },
  adminInventoryPage: async ({ page }, use) => {
    await use(new AdminInventoryPage(page));
  },
  adminCatalogMock: async ({ page }, use) => {
    const mock = new AdminCatalogMock(page);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  adminOrdersMock: async ({ page }, use) => {
    const mock = new AdminOrdersMock(page);
    await mock.register();
    await use(mock);
    mock.releaseHeldResponses();
  },
  adminInventoryMock: async ({ page }, use) => {
    const mock = new AdminInventoryMock(page);
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
