import { expect, test } from '../src/fixtures/test';

test('client is logged in by the API session without the login form', async ({
  page,
  dashboardPage,
  loginViaApi,
}) => {
  await dashboardPage.goto();

  await expect(page).not.toHaveURL(/\/login/);
  await expect(dashboardPage.navigation.links.profile).toHaveText(
    loginViaApi?.user.displayName ?? '',
  );
});

test.describe('with skipAutoLogin', () => {
  test.use({ skipAutoLogin: true });

  test('visitor is sent to the login form', async ({
    page,
    productsPage,
    loginPage,
    loginViaApi,
  }) => {
    expect(loginViaApi).toBeNull();

    await productsPage.goto();

    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.form).toBeVisible();
    await expect(productsPage.navigation.links.login).toBeVisible();
  });
});
