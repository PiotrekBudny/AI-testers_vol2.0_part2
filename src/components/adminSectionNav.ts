import { expect, type Locator, type Page } from '@playwright/test';
import type { Locators } from '@/types/locators';

export type AdminSection = 'overview' | 'products' | 'orders' | 'inventory';

const SECTION_PATHS: Record<AdminSection, string> = {
  overview: '/admin',
  products: '/admin/products',
  orders: '/admin/orders',
  inventory: '/admin/inventory',
};

export class AdminSectionNav {
  readonly root: Locator;
  readonly links: Locators<AdminSection>;

  constructor(page: Page) {
    this.root = page.getByTestId('admin-section-nav');
    this.links = {
      overview: this.root.getByTestId('admin-section-overview'),
      products: this.root.getByTestId('admin-section-products'),
      orders: this.root.getByTestId('admin-section-orders'),
      inventory: this.root.getByTestId('admin-section-inventory'),
    };
  }

  async open(section: AdminSection): Promise<void> {
    await this.links[section].click();
  }

  async expectLinks(): Promise<void> {
    for (const [section, path] of Object.entries(SECTION_PATHS)) {
      await expect(this.links[section as AdminSection]).toHaveAttribute(
        'href',
        path,
      );
    }
  }
}
