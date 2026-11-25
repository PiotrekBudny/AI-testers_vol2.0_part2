import { storageStatePath, storedSessionRoles } from '../src/config/authState';
import { getUser, hasCredentials } from '../src/config/users';
import { expect, test as setup } from '../src/fixtures/test';

setup.use({ userRole: null });

for (const role of storedSessionRoles) {
  setup(`store ${role} session`, async ({ page, loginPage, dashboardPage }) => {
    setup.skip(
      !hasCredentials(role),
      `No ${role.toUpperCase()}_* credentials in the environment`,
    );
    const user = getUser(role);

    await loginPage.goto();
    await loginPage.loginAs(user);

    await expect(dashboardPage.navigation.links.profile).toHaveText(
      user.displayName,
    );
    await page.context().storageState({ path: storageStatePath(role) });
  });
}
