import { expect, type Locator, type Page } from '@playwright/test';
import { ProductCard } from '@/components/productCard';
import type { Product } from '@/models/product';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

const SEARCH_RETRY_WINDOW_MS = 15_000;

export class ProductsPage extends BasePage {
  readonly url = '/products';
  readonly title = 'Products – Awesome Testing';

  readonly root: Locator;
  readonly productList: Locator;
  readonly productItems: Locator;

  readonly texts: Locators<
    | 'countSummary'
    | 'searchSummary'
    | 'inStockCount'
    | 'paginationStatus'
    | 'loading'
    | 'noProducts'
    | 'noCategories'
    | 'loadError'
  >;
  readonly searchInput: Locator;
  readonly buttons: Locators<'clearSearch' | 'resetSearch' | 'retry'>;

  constructor(page: Page) {
    super(page);

    this.root = page.getByTestId('products-page');
    this.productList = page.getByTestId('product-list');
    this.productItems = this.productList.getByTestId('product-item');

    this.texts = {
      countSummary: page.getByTestId('products-count-summary'),
      searchSummary: page.getByTestId('product-search-summary'),
      inStockCount: page.getByTestId('product-in-stock-count'),
      paginationStatus: page.getByTestId('product-pagination-status'),
      loading: page.getByTestId('product-list-loading'),
      noProducts: page.getByTestId('no-products-message'),
      noCategories: page.getByTestId('products-categories-empty'),
      loadError: page.getByTestId('error-message'),
    };

    this.searchInput = page.getByTestId('product-search');

    this.buttons = {
      clearSearch: page.getByTestId('clear-search'),
      resetSearch: page.getByTestId('reset-search-button'),
      retry: page.getByTestId('product-list-retry'),
    };
  }

  product(name: string): ProductCard {
    return new ProductCard(
      this.productItems.filter({
        has: this.page.getByTestId('product-name').getByText(name, {
          exact: true,
        }),
      }),
    );
  }

  productAt(index: number): ProductCard {
    return new ProductCard(this.productItems.nth(index));
  }

  async expectNoProducts(): Promise<void> {
    await expect(this.texts.noProducts).toHaveText('No products found');
    await this.expectEmptyResults();
    await expect(this.buttons.resetSearch).toBeHidden();
  }

  async expectNoSearchResults(): Promise<void> {
    await expect(this.texts.noProducts).toContainText('No products found');
    await expect(this.texts.noProducts).toContainText(
      'Try adjusting your search or',
    );
    await expect(this.buttons.resetSearch).toHaveText('Clear filters');
    await this.expectEmptyResults();
  }

  async expectStillLoading(): Promise<void> {
    await expect(this.texts.loading).toHaveText('Loading products...');
    await expect(this.texts.loadError).toBeHidden();
  }

  async expectLoadError(): Promise<void> {
    await expect(this.texts.loadError).toHaveText('Error loading products', {
      timeout: SEARCH_RETRY_WINDOW_MS,
    });
    await expect(this.texts.loadError).toHaveAttribute('role', 'alert');
    await expect(this.buttons.retry).toBeEnabled();
    await expect(this.texts.countSummary).toHaveText('Searching the catalogue');
    await expect(this.texts.loading).toBeHidden();
    await expect(this.productList).toBeHidden();
    await expect(this.texts.paginationStatus).toBeHidden();
  }

  async expectSearchFor(query: string): Promise<void> {
    await expect(this.searchInput).toHaveValue(query);
    await expect(this.buttons.clearSearch).toBeVisible();
    await expect(this.page).toHaveURL(
      (url) => url.searchParams.get('q') === query,
    );
  }

  async expectSearchCleared(): Promise<void> {
    await expect(this.searchInput).toHaveValue('');
    await expect(this.buttons.clearSearch).toBeHidden();
    await expect(this.page).toHaveURL((url) => !url.searchParams.has('q'));
  }

  async expectMatchCount(totalElements: number): Promise<void> {
    await expect(this.texts.countSummary).toContainText(String(totalElements));
  }

  async expectInStockCount(count: number): Promise<void> {
    await expect(this.texts.inStockCount).toHaveText(String(count));
  }

  async expectToShowProducts(products: Product[]): Promise<void> {
    await expect(this.productItems).toHaveCount(products.length);
    for (const [index, product] of products.entries()) {
      await this.productAt(index).expectToShow(product);
    }
  }

  async search(query: string): Promise<void> {
    await this.searchInput.fill(query);
  }

  async retryLoading(): Promise<void> {
    await this.buttons.retry.click();
  }

  async clearSearch(): Promise<void> {
    await this.buttons.clearSearch.click();
  }

  private async expectEmptyResults(): Promise<void> {
    await expect(this.texts.searchSummary).toHaveText('No matching products');
    await expect(this.texts.countSummary).toHaveText('0 products match');
    await expect(this.texts.noCategories).toHaveText('No categories match');
    await expect(this.texts.inStockCount).toHaveText('0');
    await expect(this.productList).toBeHidden();
    await expect(this.productItems).toHaveCount(0);
    await expect(this.texts.loading).toBeHidden();
    await expect(this.texts.paginationStatus).toBeHidden();
  }
}
