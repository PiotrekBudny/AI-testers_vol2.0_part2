import { expect, type Locator, type Page } from '@playwright/test';
import type { Locators } from '@/types/locators';

function exactly(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

export class Toast {
  readonly viewport: Locator;
  readonly texts: Locators<'title' | 'description'>;
  readonly closeButton: Locator;

  constructor(private readonly page: Page) {
    this.viewport = page.getByTestId('toast-viewport');
    this.texts = {
      title: this.viewport.getByTestId('toast-title'),
      description: this.viewport.getByTestId('toast-description'),
    };
    this.closeButton = this.viewport.getByTestId('toast-close');
  }

  async expectToShow(title: string, description: string): Promise<void> {
    const toast = this.viewport
      .getByRole('listitem')
      .filter({
        has: this.page
          .getByTestId('toast-title')
          .filter({ hasText: exactly(title) }),
      })
      .filter({
        has: this.page
          .getByTestId('toast-description')
          .filter({ hasText: exactly(description) }),
      })
      .last();
    await expect(toast).toBeVisible();
  }
}
