import type { Locator, Page } from '@playwright/test';
import type { Locators } from '../types/locators';

export class Footer {
  readonly root: Locator;
  readonly links: Locators<'blog' | 'linkedIn' | 'coffee'>;

  constructor(page: Page) {
    this.root = page.getByTestId('app-footer');
    this.links = {
      blog: this.root.getByTestId('footer-blog-link'),
      linkedIn: this.root.getByTestId('footer-linkedin-link'),
      coffee: this.root.getByTestId('footer-coffee-link'),
    };
  }
}
