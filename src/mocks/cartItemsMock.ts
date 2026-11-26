import { expect, type Page, type Route } from '@playwright/test';
import type { Cart, CartItem } from '@/models/cart';
import type { Product } from '@/models/product';
import { apiRoutes } from './apiRoutes';

export class CartItemsMock {
  readonly addedItems: CartItem[] = [];
  private held: Promise<void> = Promise.resolve();
  private releaseHeld: () => void = () => {};

  constructor(
    private readonly page: Page,
    private readonly username: string,
    private readonly products: () => Product[],
  ) {}

  async register(): Promise<void> {
    await this.page.route(apiRoutes.cartItems, (route) => this.fulfill(route));
  }

  async expectAddedItems(items: CartItem[]): Promise<void> {
    await expect
      .poll(() => this.addedItems, { message: 'items posted to the cart' })
      .toEqual(items);
  }

  async expectAddedItemsToStay(
    items: CartItem[],
    forMs: number,
  ): Promise<void> {
    await this.expectAddedItems(items);
    await this.page.waitForTimeout(forMs);
    expect(
      this.addedItems,
      `items posted to the cart after ${forMs} ms`,
    ).toEqual(items);
  }

  holdResponses(): () => void {
    let resolveHeld: () => void = () => {};
    this.held = new Promise<void>((resolve) => {
      resolveHeld = resolve;
    });
    this.releaseHeld = () => {
      this.held = Promise.resolve();
      resolveHeld();
    };
    return this.releaseHeld;
  }

  releaseHeldResponses(): void {
    this.releaseHeld();
  }

  private async fulfill(route: Route): Promise<void> {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    this.addedItems.push(route.request().postDataJSON() as CartItem);
    await this.held;
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
