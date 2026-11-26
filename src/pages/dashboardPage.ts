import { expect, type Locator, type Page } from '@playwright/test';
import { BasePage } from './basePage';

export class DashboardPage extends BasePage {
  readonly url = '/';
  readonly title = 'Home – Awesome Testing';

  readonly root: Locator;
  readonly welcomeHeading: Locator;

  constructor(page: Page) {
    super(page);

    this.root = page.getByTestId('home-page');
    this.welcomeHeading = page.getByTestId('home-welcome-title');
  }

  async expectToWelcome(displayName: string): Promise<void> {
    const [firstName] = displayName.split(' ');
    await expect(this.root).toBeVisible();
    await expect(this.welcomeHeading).toHaveText(`Welcome, ${firstName}!`);
    await this.navigation.expectLoggedInAs(displayName);
  }
}
