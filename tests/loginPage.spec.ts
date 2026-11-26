import { faker } from '@faker-js/faker';
import { NO_MORE_REQUESTS_WINDOW_MS } from '@/config/timing';
import { getUser } from '@/config/users';
import { test } from '@/fixtures/test';

test.use({ storageState: { cookies: [], origins: [] } });

test.beforeEach(async ({ loginPage }) => {
  await loginPage.goto();
});

test.describe('login form', { tag: ['@auth', '@live'] }, () => {
  test('shows the sign-in form', async ({ loginPage }) => {
    await loginPage.expectToBeOpen();
    await loginPage.expectEmptyForm();
    await loginPage.navigation.expectLoggedOut();
  });

  test('forgot password opens the reset page', async ({
    loginPage,
    forgotPasswordPage,
  }) => {
    await loginPage.buttons.forgotPassword.click();

    await forgotPasswordPage.expectToBeOpen();
  });

  test('register opens the sign-up page', async ({
    loginPage,
    registerPage,
  }) => {
    await loginPage.buttons.register.click();

    await registerPage.expectToBeOpen();
  });
});

test.describe('valid credentials', { tag: ['@auth', '@live'] }, () => {
  test('client signs in and lands on the dashboard', async ({
    loginPage,
    dashboardPage,
    signInTraffic,
  }) => {
    const client = getUser('client');

    await loginPage.loginAs(client);

    await signInTraffic.expectAccepted();
    await dashboardPage.expectToBeOpen();
    await dashboardPage.expectToWelcome(client.displayName);
  });
});

test.describe('invalid credentials', {
  tag: ['@auth', '@live', '@negative'],
}, () => {
  test('unknown user sees the failed login toast and stays on the form', async ({
    loginPage,
    signInTraffic,
  }) => {
    await loginPage.login(
      `unknown-${faker.string.alphanumeric(12)}`,
      faker.internet.password(),
    );

    await signInTraffic.expectRejected();
    await loginPage.expectInvalidCredentialsError();
    await loginPage.expectToShowLoggedOutForm();
  });
});

test.describe('empty fields', {
  tag: ['@auth', '@live', '@negative'],
}, () => {
  test('empty submit shows both required errors and sends nothing', async ({
    loginPage,
    signInTraffic,
  }) => {
    await loginPage.buttons.signIn.click();

    await loginPage.expectRequiredErrors(['username', 'password']);
    await loginPage.expectToShowLoggedOutForm();
    await signInTraffic.expectNoneSent(NO_MORE_REQUESTS_WINDOW_MS);
  });

  test('missing password shows only the password error and sends nothing', async ({
    loginPage,
    signInTraffic,
  }) => {
    await loginPage.login(faker.internet.username(), '');

    await loginPage.expectRequiredErrors(['password']);
    await loginPage.expectToShowLoggedOutForm();
    await signInTraffic.expectNoneSent(NO_MORE_REQUESTS_WINDOW_MS);
  });

  test('missing username shows only the username error and sends nothing', async ({
    loginPage,
    signInTraffic,
  }) => {
    await loginPage.login('', faker.internet.password());

    await loginPage.expectRequiredErrors(['username']);
    await loginPage.expectToShowLoggedOutForm();
    await signInTraffic.expectNoneSent(NO_MORE_REQUESTS_WINDOW_MS);
  });
});
