import { getUser } from '@/config/users';
import { test } from '@/fixtures/test';

test.use({ userRole: 'admin' });

test.describe('Admin API session', { tag: ['@auth', '@live'] }, () => {
  test('admin is logged in by the saved API session', async ({
    dashboardPage,
  }) => {
    await dashboardPage.goto();

    await dashboardPage.expectToBeOpen();
    await dashboardPage.navigation.expectLoggedInAs(
      getUser('admin').displayName,
    );
  });
});
