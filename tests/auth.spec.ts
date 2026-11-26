import { getUser } from '@/config/users';
import { test } from '@/fixtures/test';

test.describe('API session', { tag: ['@auth', '@live'] }, () => {
  test('client is logged in by the API session without the login form', async ({
    dashboardPage,
  }) => {
    await dashboardPage.goto();

    await dashboardPage.expectToBeOpen();
    await dashboardPage.navigation.expectLoggedInAs(
      getUser('client').displayName,
    );
  });
});

test.describe('without a saved session', { tag: ['@auth', '@live'] }, () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('visitor is sent to the login form', async ({
    productsPage,
    loginPage,
  }) => {
    await productsPage.goto();

    await loginPage.expectToShowLoggedOutForm();
  });
});
