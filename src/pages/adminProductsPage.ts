import { expect, type Locator, type Page } from '@playwright/test';
import { AdminProductRow } from '@/components/adminProductRow';
import { AdminSectionNav } from '@/components/adminSectionNav';
import { type ConfirmAnswer, NativeDialogs } from '@/components/nativeDialogs';
import { LOAD_ERROR_TIMEOUT_MS } from '@/config/timing';
import type { ProductDetails } from '@/models/product';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

const NEW_PRODUCT_PATH = '/admin/products/new';

const DELETE_CONFIRMATION =
  'confirm: Are you sure you want to delete this product?';

const DELETE_FAILURE_ALERT =
  'alert: Failed to delete product. Please try again.';

export class AdminProductsPage extends BasePage {
  readonly url = '/admin/products';
  readonly title = 'Manage Products – Awesome Testing';

  readonly sectionNav: AdminSectionNav;
  readonly heading: Locator;
  readonly table: Locator;
  readonly rows: Locator;
  readonly links: Locators<'addNew' | 'addFirst'>;
  readonly states: Locators<'loading' | 'empty' | 'error'>;

  private readonly dialogs: NativeDialogs;

  constructor(page: Page) {
    super(page);

    this.sectionNav = new AdminSectionNav(page);
    this.dialogs = new NativeDialogs(page);
    this.heading = page.getByTestId('admin-product-list-title');
    this.table = page.getByTestId('admin-product-list-table');
    this.rows = this.table.getByTestId(/^admin-product-row-\d+$/);
    this.links = {
      addNew: page.getByTestId('admin-product-list-add-new'),
      addFirst: page.getByTestId('admin-product-list-empty-add'),
    };
    this.states = {
      loading: page.getByTestId('admin-product-list-loading'),
      empty: page.getByTestId('admin-product-list-empty'),
      error: page.getByTestId('admin-product-list-error'),
    };
  }

  product(productId: number): AdminProductRow {
    return new AdminProductRow(this.page, productId);
  }

  async deleteProduct(productId: number, answer: ConfirmAnswer): Promise<void> {
    this.dialogs.answerConfirmsWith(answer);
    await this.product(productId).delete();
  }

  async expectToShowProducts(products: ProductDetails[]): Promise<void> {
    await this.expectToBeOpen();
    await expect(this.heading).toHaveText('Manage Products');
    await expect(this.links.addNew).toHaveText('Add New Product');
    await expect(this.links.addNew).toHaveAttribute('href', NEW_PRODUCT_PATH);
    await expect(this.rows).toHaveCount(products.length);
    for (const [index, product] of products.entries()) {
      await expect(this.rows.nth(index)).toHaveAttribute(
        'data-testid',
        `admin-product-row-${product.id}`,
      );
      await this.product(product.id).expectToShow(product);
    }
  }

  async expectEmpty(): Promise<void> {
    await this.expectToBeOpen();
    await expect(this.states.empty).toContainText('No products found');
    await expect(this.links.addFirst).toHaveText('Add Your First Product');
    await expect(this.links.addFirst).toHaveAttribute('href', NEW_PRODUCT_PATH);
    await expect(this.table).toBeHidden();
    await expect(this.states.error).toBeHidden();
    await expect(this.states.loading).toBeHidden();
  }

  async expectStillLoading(): Promise<void> {
    await expect(this.states.loading).toContainText('Loading products...');
    await expect(this.table).toBeHidden();
    await expect(this.states.empty).toBeHidden();
  }

  async expectLoadError(): Promise<void> {
    await expect(this.states.error).toContainText('Error loading products', {
      timeout: LOAD_ERROR_TIMEOUT_MS,
    });
    await expect(this.states.loading).toBeHidden();
    await expect(this.states.empty).toBeHidden();
    await expect(this.table).toBeHidden();
  }

  async expectDeleteConfirmationAsked(): Promise<void> {
    await this.dialogs.expectShown([DELETE_CONFIRMATION]);
  }

  async expectDeleteFailureAlerted(): Promise<void> {
    await this.dialogs.expectShown([DELETE_CONFIRMATION, DELETE_FAILURE_ALERT]);
  }
}
