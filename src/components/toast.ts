import { expect, type Locator, type Page } from '@playwright/test';
import type { Locators } from '@/types/locators';

export class Toast {
  readonly viewport: Locator;
  readonly texts: Locators<'title' | 'description'>;
  readonly closeButton: Locator;

  constructor(page: Page) {
    this.viewport = page.getByTestId('toast-viewport');
    this.texts = {
      title: this.viewport.getByTestId('toast-title'),
      description: this.viewport.getByTestId('toast-description'),
    };
    this.closeButton = this.viewport.getByTestId('toast-close');
  }

  async expectToShow(title: string, description: string): Promise<void> {
    await expect(this.texts.title).toHaveText(title);
    await expect(this.texts.description).toHaveText(description);
  }
}
