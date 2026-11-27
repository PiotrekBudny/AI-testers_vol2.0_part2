import { expect, type Locator, type Page } from '@playwright/test';
import type { Locators } from '@/types/locators';

export class NavigationBar {
  readonly root: Locator;
  readonly adminLink: Locator;
  readonly links: Locators<'login' | 'register' | 'cart' | 'profile'>;

  constructor(page: Page) {
    this.root = page.getByTestId('navigation');

    this.links = {
      login: this.root.getByTestId('login-link'),
      register: this.root.getByTestId('register-link'),
      cart: this.root.getByTestId('desktop-cart-icon'),
      profile: this.root.getByTestId('username-profile-link'),
    };

    this.adminLink = this.root.getByTestId('desktop-menu-admin');
  }

  async expectNoAdminLink(): Promise<void> {
    await expect(this.links.profile).toBeVisible();
    await expect(this.adminLink).toHaveCount(0);
  }

  async expectLoggedOut(): Promise<void> {
    await expect(this.links.login).toBeVisible();
    await expect(this.links.register).toBeVisible();
    await expect(this.links.profile).toBeHidden();
  }

  async expectLoggedInAs(displayName: string): Promise<void> {
    await expect(this.links.profile).toHaveText(displayName);
    await expect(this.links.login).toBeHidden();
    await expect(this.links.register).toBeHidden();
  }
}
