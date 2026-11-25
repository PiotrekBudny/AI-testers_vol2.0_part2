import type { Page, Route } from '@playwright/test';
import type { Cart, CartItem } from '../models/cart';
import type { Product } from '../models/product';

export class CartItemsMock {
  static readonly urlPattern = '**/api/v1/cart/items';

  readonly addedItems: CartItem[] = [];

  constructor(
    private readonly page: Page,
    private readonly username: string,
    private readonly products: () => Product[],
  ) {}

  async register(): Promise<void> {
    await this.page.route(CartItemsMock.urlPattern, (route) =>
      this.fulfill(route),
    );
  }

  private async fulfill(route: Route): Promise<void> {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    this.addedItems.push(route.request().postDataJSON() as CartItem);
    await route.fulfill({ json: this.cart() });
  }

  private cart(): Cart {
    const prices = new Map(
      this.products().map((product) => [product.id, product.price]),
    );
    return {
      username: this.username,
      items: [...this.addedItems],
      totalPrice: this.addedItems.reduce(
        (total, item) =>
          total + (prices.get(item.productId) ?? 0) * item.quantity,
        0,
      ),
      totalItems: this.addedItems.reduce(
        (total, item) => total + item.quantity,
        0,
      ),
    };
  }
}
