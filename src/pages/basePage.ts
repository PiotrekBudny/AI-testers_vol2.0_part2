import { expect, type Page } from '@playwright/test';
import { Footer } from '@/components/footer';
import { NavigationBar } from '@/components/navigationBar';
import { Toast } from '@/components/toast';

export abstract class BasePage {
  abstract readonly url: string;
  abstract readonly title: string;

  readonly navigation: NavigationBar;
  readonly footer: Footer;
  readonly toast: Toast;

  constructor(readonly page: Page) {
    this.navigation = new NavigationBar(page);
    this.footer = new Footer(page);
    this.toast = new Toast(page);
  }

  async goto(): Promise<void> {
    await this.page.goto(this.url);
  }

  async expectToBeOpen(): Promise<void> {
    await expect(this.page).toHaveURL((url) => url.pathname === this.url);
    await expect(this.page).toHaveTitle(this.title);
  }
}
