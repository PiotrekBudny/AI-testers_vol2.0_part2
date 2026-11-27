import { NO_MORE_REQUESTS_WINDOW_MS } from '@/config/timing';
import { test } from '@/fixtures/test';
import type { RegisterRequest } from '@/models/auth';

test.use({ storageState: { cookies: [], origins: [] } });

const newUser: RegisterRequest = {
  username: 'new.user_01-test',
  email: 'New.User@Example.com',
  password: 'secret-pass-1',
  firstName: 'Johnny',
  lastName: 'Boyden',
};

const malformedUser: RegisterRequest = {
  username: 'abc',
  email: 'not-an-email',
  password: '1234567',
  firstName: 'Ann',
  lastName: 'Lee',
};

test.describe('Register page', { tag: ['@register', '@mocked'] }, () => {
  test('rejects empty and malformed fields without sending anything', {
    tag: '@negative',
  }, async ({ registerPage, signupMock }) => {
    await registerPage.goto();

    await registerPage.submit();
    await registerPage.expectAllFieldsRequired();

    await registerPage.register(malformedUser);
    await registerPage.expectFieldErrors({
      username: 'Username must be at least 4 characters',
      email: 'Invalid email format',
      password: 'Password must be at least 8 characters',
      firstName: 'First name must be at least 4 characters',
      lastName: 'Last name must be at least 4 characters',
    });

    await signupMock.expectReceivedToStay([], NO_MORE_REQUESTS_WINDOW_MS);
    await registerPage.expectToBeOpen();
  });

  test('sends the typed data once and lands on sign in', async ({
    registerPage,
    loginPage,
    signupMock,
  }) => {
    const release = signupMock.holdResponses();
    await registerPage.goto();

    await registerPage.register(newUser);
    await registerPage.expectSubmitPending();
    await registerPage.forceSubmit();
    await signupMock.expectReceived(newUser);
    release();

    await loginPage.expectToBeOpen();
    await loginPage.toast.expectToShow(
      'Success',
      'Registration successful! You can now log in.',
    );
    await loginPage.expectEmptyForm();
    await signupMock.expectReceivedToStay(
      [newUser],
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });

  test('keeps the form when the username is already in use', {
    tag: '@negative',
  }, async ({ registerPage, apiErrorMock }) => {
    await apiErrorMock.respondWithError('signUp', 400, {
      message: `Username ${newUser.username} is already in use`,
    });
    await registerPage.goto();

    await registerPage.register(newUser);

    await registerPage.expectUsernameTakenError(newUser);
    await apiErrorMock.expectRequestCountToStay(
      'signUp',
      1,
      NO_MORE_REQUESTS_WINDOW_MS,
    );
  });
});
