import { expect, type Locator, type Page } from '@playwright/test';
import { NavigationBar } from '@/components/navigationBar';
import { Toast } from '@/components/toast';

export abstract class BasePage {
  abstract readonly url: string;
  abstract readonly title: string;

  readonly navigation: NavigationBar;
  readonly toast: Toast;
  readonly cartCounter: Locator;

  constructor(readonly page: Page) {
    this.navigation = new NavigationBar(page);
    this.toast = new Toast(page);
    this.cartCounter = this.navigation.links.cart;
  }

  async expectCartCount(totalItems: number): Promise<void> {
    await expect(this.cartCounter).toHaveText(
      totalItems === 0 ? '' : String(totalItems),
    );
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async expectToBeOpen(): Promise<void> {
    await expect(this.page).toHaveURL((url) => url.pathname === this.url);
    await expect(this.page).toHaveTitle(this.title);
  }
}
