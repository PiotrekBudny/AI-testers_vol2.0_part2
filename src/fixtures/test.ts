import { test as base, expect } from '@playwright/test';
import { getUser, type User, type UserRole } from '../config/users';
import { ProductGenerator } from '../generators/productGenerator';
import { CartItemsMock } from '../mocks/cartItemsMock';
import { ProductSearchMock } from '../mocks/productSearchMock';
import { DashboardPage } from '../pages/dashboardPage';
import { LoginPage } from '../pages/loginPage';
import { ProductsPage } from '../pages/productsPage';

type Options = {
  userRole: UserRole | null;
};

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  productsPage: ProductsPage;
  productSearchMock: ProductSearchMock;
  cartItemsMock: CartItemsMock;
  loggedInUser: User | null;
};

export const test = base.extend<Options & Fixtures>({
  userRole: ['client', { option: true }],
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
  loggedInUser: [
    async ({ userRole, loginPage, dashboardPage }, use) => {
      if (userRole === null) {
        await use(null);
        return;
      }
      const user = getUser(userRole);
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
