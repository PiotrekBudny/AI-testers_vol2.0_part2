import { expect, type Locator, type Page } from '@playwright/test';
import { formatUsd } from '@/formatters/price';
import type { Product, ProductDetails } from '@/models/product';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

const NOT_FOUND_TITLE = 'Product not found – Awesome Testing';

export class ProductDetailsPage extends BasePage {
  private productId: number | undefined;
  private productName: string | undefined;

  readonly heading: Locator;
  readonly image: Locator;
  readonly quantitySection: Locator;
  readonly notFound: Locator;

  readonly links: Locators<'back' | 'notFoundBack'>;
  readonly texts: Locators<
    | 'price'
    | 'description'
    | 'category'
    | 'stock'
    | 'quantity'
    | 'notFoundHeading'
    | 'notFoundMessage'
  >;
  readonly buttons: Locators<
    'decreaseQuantity' | 'increaseQuantity' | 'addToCart' | 'wishlist'
  >;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByTestId('product-title');
    this.image = page.getByTestId('product-image');
    this.quantitySection = page.getByTestId('product-quantity-section');
    this.notFound = page.getByTestId('product-not-found');

    this.links = {
      back: page.getByTestId('product-back-link'),
      notFoundBack: page.getByTestId('product-not-found-back-link'),
    };

    this.texts = {
      price: page.getByTestId('product-price'),
      description: page.getByTestId('product-description'),
      category: page.getByTestId('product-category'),
      stock: page.getByTestId('product-stock'),
      quantity: page.getByTestId('quantity-value'),
      notFoundHeading: this.notFound.getByRole('heading', { level: 1 }),
      notFoundMessage: this.notFound.getByText(
        'This product does not exist or may have been removed.',
        { exact: true },
      ),
    };

    this.buttons = {
      decreaseQuantity: page.getByTestId('decrease-quantity'),
      increaseQuantity: page.getByTestId('increase-quantity'),
      addToCart: page.getByTestId('add-to-cart'),
      wishlist: page.getByTestId('wishlist-toggle'),
    };
  }

  get url(): string {
    if (this.productId === undefined) {
      throw new Error('Call open(product) or openById(id) first');
    }
    return `/products/${this.productId}`;
  }

  get title(): string {
    if (this.productName === undefined) {
      throw new Error('Call open(product) first to know the page title');
    }
    return `${this.productName} – Awesome Testing`;
  }

  async open(product: Pick<Product, 'id' | 'name'>): Promise<void> {
    this.productId = product.id;
    this.productName = product.name;
    await this.goto();
  }

  async openById(id: number): Promise<void> {
    this.productId = id;
    this.productName = undefined;
    await this.goto();
  }

  async increaseQuantity(times: number): Promise<void> {
    for (let step = 0; step < times; step++) {
      await this.buttons.increaseQuantity.click();
    }
  }

  async addToCart(): Promise<void> {
    await this.buttons.addToCart.click();
  }

  async forceAddToCart(): Promise<void> {
    await this.buttons.addToCart.click({ force: true });
  }

  async backToProducts(): Promise<void> {
    await this.links.notFoundBack.click();
  }

  async expectToShowProduct(product: ProductDetails): Promise<void> {
    await this.expectToBeOpen();
    await expect(this.heading).toHaveText(product.name);
    await expect(this.links.back).toHaveText('← Back to Products');
    await expect(this.links.back).toHaveAttribute('href', '/products');
    await expect(this.texts.price).toHaveText(formatUsd(product.price));
    await expect(this.texts.description).toHaveText(product.description);
    await expect(this.texts.category).toHaveText(product.category);
    if (product.stockQuantity > 0) {
      await expect(this.texts.stock).toHaveText(
        `${product.stockQuantity} in stock`,
      );
    }
    if (product.imageUrl === null) {
      await expect(this.image).toHaveCount(0);
    } else {
      await expect(this.image).toHaveAttribute('alt', product.name);
      await expect(this.image).toHaveAttribute('src', product.imageUrl);
    }
    await expect(this.buttons.wishlist).toHaveText('Save to wishlist');
    await expect(this.notFound).toBeHidden();
    if (product.stockQuantity === 0) {
      await this.expectOutOfStock();
      return;
    }
    await expect(this.buttons.decreaseQuantity).toBeDisabled();
    if (product.stockQuantity > 1) {
      await expect(this.buttons.increaseQuantity).toBeEnabled();
    } else {
      await expect(this.buttons.increaseQuantity).toBeDisabled();
    }
    await this.expectReadyToAdd(1);
  }

  async expectNotFound(): Promise<void> {
    await expect(this.page).toHaveTitle(NOT_FOUND_TITLE);
    await expect(this.page).toHaveURL((url) => url.pathname === this.url);
    await expect(this.notFound).toHaveAttribute('role', 'alert');
    await expect(this.texts.notFoundHeading).toHaveText('Product not found');
    await expect(this.texts.notFoundMessage).toBeVisible();
    await expect(this.links.notFoundBack).toHaveText('Back to Products');
    await expect(this.links.notFoundBack).toHaveAttribute('href', '/products');
    await expect(this.heading).toBeHidden();
    await expect(this.buttons.addToCart).toBeHidden();
    await expect(this.quantitySection).toBeHidden();
  }

  async expectOutOfStock(): Promise<void> {
    await expect(this.texts.stock).toHaveText('Out of stock');
    await expect(this.quantitySection).toBeHidden();
    await expect(this.texts.quantity).toBeHidden();
    await expect(this.buttons.decreaseQuantity).toBeHidden();
    await expect(this.buttons.increaseQuantity).toBeHidden();
    await expect(this.buttons.addToCart).toHaveText('Add to Cart');
    await expect(this.buttons.addToCart).toBeDisabled();
    await expect(this.buttons.wishlist).toBeEnabled();
  }

  async expectAddingToCart(): Promise<void> {
    await expect(this.buttons.addToCart).toHaveText('Adding to Cart...');
    await expect(this.buttons.addToCart).toBeDisabled();
  }

  async expectReadyToAdd(quantity: number): Promise<void> {
    await expect(this.buttons.addToCart).toHaveText('Add to Cart');
    await expect(this.buttons.addToCart).toBeEnabled();
    await expect(this.texts.quantity).toHaveText(String(quantity));
  }
}
