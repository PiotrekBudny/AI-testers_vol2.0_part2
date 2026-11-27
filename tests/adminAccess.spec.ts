import { test } from '@/fixtures/test';

const adminPaths = [
  '/admin',
  '/admin/products',
  '/admin/orders',
  '/admin/inventory',
];

test.describe('Admin access for a client account', {
  tag: ['@auth', '@live', '@negative'],
}, () => {
  for (const path of adminPaths) {
    test(`a client opening ${path} lands on the dashboard`, async ({
      page,
      dashboardPage,
    }) => {
      await page.goto(path);

      await dashboardPage.expectToBeOpen();
      await dashboardPage.navigation.expectNoAdminLink();
    });
  }
});
