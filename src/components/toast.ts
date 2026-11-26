import { expect, type Locator, type Page } from '@playwright/test';

function exactly(text: string): RegExp {
  return new RegExp(`^${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
}

export class Toast {
  readonly viewport: Locator;

  constructor(private readonly page: Page) {
    this.viewport = page.getByTestId('toast-viewport');
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
