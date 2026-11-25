import { test as base } from '@playwright/test';
import { ProductGenerator } from '../generators/productGenerator';
import { ProductSearchMock } from '../mocks/productSearchMock';
import { DashboardPage } from '../pages/dashboardPage';
import { LoginPage } from '../pages/loginPage';
import { ProductsPage } from '../pages/productsPage';

type Fixtures = {
  loginPage: LoginPage;
  dashboardPage: DashboardPage;
  productsPage: ProductsPage;
  productSearchMock: ProductSearchMock;
};

export const test = base.extend<Fixtures>({
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
});

export { expect } from '@playwright/test';
