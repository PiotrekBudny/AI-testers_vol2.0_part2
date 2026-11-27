import { test as base } from '@playwright/test';
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

type Pages = {
  loginPage: LoginPage;
  registerPage: RegisterPage;
  forgotPasswordPage: ForgotPasswordPage;
  dashboardPage: DashboardPage;
  productsPage: ProductsPage;
  productDetailsPage: ProductDetailsPage;
  cartPage: CartPage;
  checkoutPage: CheckoutPage;
  paymentPage: PaymentPage;
  adminDashboardPage: AdminDashboardPage;
  adminProductsPage: AdminProductsPage;
  adminOrdersPage: AdminOrdersPage;
  adminOrderDetailsPage: AdminOrderDetailsPage;
  adminInventoryPage: AdminInventoryPage;
};

export const pagesTest = base.extend<Pages>({
  loginPage: async ({ page }, use) => {
    await use(new LoginPage(page));
  },
  registerPage: async ({ page }, use) => {
    await use(new RegisterPage(page));
  },
  forgotPasswordPage: async ({ page }, use) => {
    await use(new ForgotPasswordPage(page));
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
});
