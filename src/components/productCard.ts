import type { Locator } from '@playwright/test';
import type { Locators } from '../types/locators';

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
}
