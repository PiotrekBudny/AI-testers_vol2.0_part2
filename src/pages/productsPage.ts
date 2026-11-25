import { expect, type Locator, type Page } from '@playwright/test';
import { ProductCard } from '../components/productCard';
import type { ProductCategory } from '../enums/productCategory';
import type { ProductSortOption } from '../enums/productSortOption';
import type { Product } from '../models/product';
import type { Locators } from '../types/locators';
import { BasePage } from './basePage';

export class ProductsPage extends BasePage {
  readonly url = '/products';

  readonly root: Locator;
  readonly productList: Locator;
  readonly productItems: Locator;

  readonly headings: Locators<'page' | 'categories' | 'productList'>;
  readonly texts: Locators<
    | 'countSummary'
    | 'searchSummary'
    | 'inStockCount'
    | 'paginationStatus'
    | 'loading'
    | 'noProducts'
    | 'noCategories'
  >;
  readonly inputs: Locators<'search' | 'minPrice' | 'maxPrice' | 'inStockOnly'>;
  readonly selects: Locators<'sort' | 'minRating'>;
  readonly buttons: Locators<
    | 'toggleFilters'
    | 'allCategories'
    | 'applyPrice'
    | 'clearSearch'
    | 'resetSearch'
    | 'previousPage'
    | 'nextPage'
  >;

  constructor(page: Page) {
    super(page);

    this.root = page.getByTestId('products-page');
    this.productList = page.getByTestId('product-list');
    this.productItems = this.productList.getByTestId('product-item');

    this.headings = {
      page: page.getByTestId('products-title'),
      categories: page.getByTestId('products-categories-title'),
      productList: page.getByTestId('product-list-title'),
    };

    this.texts = {
      countSummary: page.getByTestId('products-count-summary'),
      searchSummary: page.getByTestId('product-search-summary'),
      inStockCount: page.getByTestId('product-in-stock-count'),
      paginationStatus: page.getByTestId('product-pagination-status'),
      loading: page.getByTestId('product-list-loading'),
      noProducts: page.getByTestId('no-products-message'),
      noCategories: page.getByTestId('products-categories-empty'),
    };

    this.inputs = {
      search: page.getByTestId('product-search'),
      minPrice: page.getByTestId('product-min-price'),
      maxPrice: page.getByTestId('product-max-price'),
      inStockOnly: page.getByTestId('product-in-stock-only'),
    };

    this.selects = {
      sort: page.getByTestId('product-sort'),
      minRating: page.getByTestId('product-min-rating'),
    };

    this.buttons = {
      toggleFilters: page.getByTestId('products-filters-toggle'),
      allCategories: page.getByTestId('products-category-all'),
      applyPrice: page.getByTestId('product-price-apply'),
      clearSearch: page.getByTestId('clear-search'),
      resetSearch: page.getByTestId('reset-search-button'),
      previousPage: page.getByTestId('product-pagination-prev'),
      nextPage: page.getByTestId('product-pagination-next'),
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
    await expect(this.texts.searchSummary).toHaveText('No matching products');
    await expect(this.texts.countSummary).toHaveText('0 products match');
    await expect(this.texts.noCategories).toHaveText('No categories match');
    await expect(this.texts.inStockCount).toHaveText('0');
    await expect(this.productList).toBeHidden();
    await expect(this.productItems).toHaveCount(0);
    await expect(this.texts.loading).toBeHidden();
    await expect(this.texts.paginationStatus).toBeHidden();
    await expect(this.buttons.resetSearch).toBeHidden();
  }

  async expectToShowProducts(products: Product[]): Promise<void> {
    await expect(this.productItems).toHaveCount(products.length);
    for (const [index, product] of products.entries()) {
      await this.productAt(index).expectToShow(product);
    }
  }

  categoryCheckbox(category: ProductCategory): Locator {
    return this.page.getByTestId(
      `products-category-${this.categorySlug(category)}`,
    );
  }

  categoryCount(category: ProductCategory): Locator {
    return this.page.getByTestId(
      `products-category-count-${this.categorySlug(category)}`,
    );
  }

  async search(query: string): Promise<void> {
    await this.inputs.search.fill(query);
  }

  async sortBy(option: ProductSortOption): Promise<void> {
    await this.selects.sort.selectOption(option);
  }

  async filterByPrice(min?: number, max?: number): Promise<void> {
    await this.inputs.minPrice.fill(min === undefined ? '' : String(min));
    await this.inputs.maxPrice.fill(max === undefined ? '' : String(max));
    await this.buttons.applyPrice.click();
  }

  async filterByMinRating(rating: 1 | 2 | 3 | 4 | null): Promise<void> {
    await this.selects.minRating.selectOption(
      rating === null ? '' : String(rating),
    );
  }

  private categorySlug(category: ProductCategory): string {
    return category.toLowerCase().replaceAll(' ', '-');
  }
}
