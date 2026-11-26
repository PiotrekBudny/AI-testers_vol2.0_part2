import { test } from '@/fixtures/test';

test('client is logged in by the API session without the login form', async ({
  dashboardPage,
  loginViaApi,
}) => {
  await dashboardPage.goto();

  await dashboardPage.expectToBeOpen();
  await dashboardPage.navigation.expectLoggedInAs(
    loginViaApi?.user.displayName ?? '',
  );
});

test.describe('with skipAutoLogin', () => {
  test.use({ skipAutoLogin: true });

  test('visitor is sent to the login form', async ({
    productsPage,
    loginPage,
  }) => {
    await productsPage.goto();

    await loginPage.expectToShowLoggedOutForm();
  });
});
