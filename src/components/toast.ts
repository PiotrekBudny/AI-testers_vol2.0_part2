import type { Locator, Page } from '@playwright/test';
import type { Locators } from '../types/locators';

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
}
