import { expect, type Locator } from '@playwright/test';
import type { Product } from '../models/product';
import type { Locators } from '../types/locators';

const usdPrice = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
});

export class ProductCard {
  readonly image: Locator;
  readonly nameLink: Locator;
  readonly texts: Locators<
    | 'name'
    | 'price'
    | 'category'
    | 'rating'
    | 'description'
    | 'quantity'
    | 'outOfStock'
  >;
  readonly buttons: Locators<
    'decreaseQuantity' | 'increaseQuantity' | 'addToCart'
  >;

  constructor(readonly root: Locator) {
    this.image = root.getByTestId('product-image');
    this.nameLink = root.getByTestId('product-name-link');

    this.texts = {
      name: root.getByTestId('product-name'),
      price: root.getByTestId('product-price'),
      category: root.getByTestId('product-category'),
      rating: root.getByTestId('product-rating'),
      description: root.getByTestId('product-description'),
      quantity: root.getByTestId('product-quantity-value'),
      outOfStock: root.getByTestId('product-out-of-stock'),
    };

    this.buttons = {
      decreaseQuantity: root.getByTestId('product-decrease-quantity'),
      increaseQuantity: root.getByTestId('product-increase-quantity'),
      addToCart: root.getByTestId('product-add-button'),
    };
  }

  async addToCart(quantity = 1): Promise<void> {
    for (let added = 1; added < quantity; added++) {
      await this.buttons.increaseQuantity.click();
    }
    await this.buttons.addToCart.click();
  }

  async expectToShow(product: Product): Promise<void> {
    await expect(this.texts.name).toHaveText(product.name);
    await expect(this.nameLink).toHaveAttribute(
      'href',
      `/products/${product.id}`,
    );
    await expect(this.texts.description).toHaveText(product.description);
    await expect(this.texts.price).toHaveText(usdPrice.format(product.price));
    await expect(this.texts.category).toHaveText(product.category);
    await expect(this.texts.rating).toHaveText(this.ratingText(product));
    await expect(this.image).toHaveAttribute('alt', product.name);
    if (product.imageUrl !== null) {
      await expect(this.image).toHaveAttribute('src', product.imageUrl);
    }
    await this.expectStockState(product.stockQuantity > 0);
  }

  private async expectStockState(inStock: boolean): Promise<void> {
    if (inStock) {
      await expect(this.texts.outOfStock).toBeHidden();
      await expect(this.texts.quantity).toHaveText('1');
      await expect(this.buttons.addToCart).toBeEnabled();
    } else {
      await expect(this.texts.outOfStock).toHaveText('Out of stock');
      await expect(this.buttons.increaseQuantity).toBeHidden();
      await expect(this.buttons.addToCart).toBeDisabled();
    }
  }

  private ratingText({ averageRating, reviewCount }: Product): string {
    return averageRating === null
      ? 'No reviews yet'
      : `★ ${averageRating.toFixed(1)} (${reviewCount})`;
  }
}
