import { expect, type Page, type Route } from '@playwright/test';
import { expectToStay } from '@/assertions/settle';
import type { Cart, CartItem } from '@/models/cart';
import type { Product } from '@/models/product';
import { apiRoutes } from './apiRoutes';

const CART_ITEM_NOT_FOUND = { message: 'Cart item not found' };

export class CartMock {
  readonly addedItems: CartItem[] = [];
  readonly updatedItems: CartItem[] = [];
  private readonly items = new Map<number, number>();
  private held: Promise<void> = Promise.resolve();
  private releaseHeld: () => void = () => {};
  private holding = false;

  constructor(
    private readonly page: Page,
    private readonly username: string,
    private readonly products: () => Product[],
  ) {}

  async register(): Promise<void> {
    await this.page.route(apiRoutes.cart, (route) => this.handleCart(route));
    await this.page.route(apiRoutes.cartItems, (route) =>
      this.handleAdd(route),
    );
    await this.page.route(apiRoutes.cartItem, (route) =>
      this.handleItem(route),
    );
  }

  seed(items: CartItem[]): void {
    for (const { productId } of items) {
      if (!this.knows(productId)) {
        throw new Error(unknownProduct(productId));
      }
    }
    this.items.clear();
    for (const { productId, quantity } of items) {
      this.items.set(productId, quantity);
    }
  }

  cart(): Cart {
    const prices = new Map(
      this.products().map((product) => [product.id, product.price]),
    );
    const items = [...this.items].map(([productId, quantity]) => ({
      productId,
      quantity,
    }));
    return {
      username: this.username,
      items,
      totalPrice: roundToCents(
        items.reduce(
          (total, { productId, quantity }) =>
            total + this.priceOf(prices, productId) * quantity,
          0,
        ),
      ),
      totalItems: items.reduce((total, { quantity }) => total + quantity, 0),
    };
  }

  private knows(productId: number): boolean {
    return this.products().some((product) => product.id === productId);
  }

  private priceOf(prices: Map<number, number>, productId: number): number {
    const price = prices.get(productId);
    if (price === undefined) {
      throw new Error(unknownProduct(productId));
    }
    return price;
  }

  async expectCartItems(items: CartItem[]): Promise<void> {
    await expect
      .poll(() => this.cart().items, { message: 'items in the mocked cart' })
      .toEqual(items);
  }

  async expectAddedItems(items: CartItem[]): Promise<void> {
    await expect
      .poll(() => this.addedItems, { message: 'items posted to the cart' })
      .toEqual(items);
  }

  async expectUpdatedItems(items: CartItem[]): Promise<void> {
    await expect
      .poll(() => this.updatedItems, { message: 'cart quantities put' })
      .toEqual(items);
  }

  async expectAddedItemsToStay(
    items: CartItem[],
    forMs: number,
  ): Promise<void> {
    await expectToStay(
      this.page,
      () => this.addedItems,
      items,
      forMs,
      'items posted to the cart',
    );
  }

  holdResponses(): () => void {
    if (this.holding) {
      return this.releaseHeld;
    }
    this.holding = true;
    let resolveHeld: () => void = () => {};
    this.held = new Promise<void>((resolve) => {
      resolveHeld = resolve;
    });
    this.releaseHeld = () => {
      this.holding = false;
      this.held = Promise.resolve();
      resolveHeld();
    };
    return this.releaseHeld;
  }

  releaseHeldResponses(): void {
    this.releaseHeld();
  }

  private async handleCart(route: Route): Promise<void> {
    const method = route.request().method();
    if (method === 'GET') {
      await route.fulfill({ json: this.cart() });
      return;
    }
    if (method === 'DELETE') {
      await this.applyAfterHold(route, () => {
        this.items.clear();
      });
      return;
    }
    await route.fallback();
  }

  private async handleAdd(route: Route): Promise<void> {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const item = route.request().postDataJSON() as CartItem;
    this.addedItems.push(item);
    if (!this.knows(item.productId)) {
      await route.fulfill({
        status: 500,
        json: { message: unknownProduct(item.productId) },
      });
      return;
    }
    await this.applyAfterHold(route, () => {
      this.items.set(
        item.productId,
        (this.items.get(item.productId) ?? 0) + item.quantity,
      );
    });
  }

  private async handleItem(route: Route): Promise<void> {
    const method = route.request().method();
    if (method !== 'PUT' && method !== 'DELETE') {
      await route.fallback();
      return;
    }
    const productId = Number(
      new URL(route.request().url()).pathname.split('/').filter(Boolean).at(-1),
    );
    const quantity =
      method === 'PUT'
        ? (route.request().postDataJSON() as Pick<CartItem, 'quantity'>)
            .quantity
        : 0;
    if (method === 'PUT') {
      this.updatedItems.push({ productId, quantity });
    }
    await this.applyAfterHold(route, () => {
      if (!this.items.has(productId)) {
        return 'not found';
      }
      if (quantity > 0) {
        this.items.set(productId, quantity);
      } else {
        this.items.delete(productId);
      }
      return 'applied';
    });
  }

  private async applyAfterHold(
    route: Route,
    change: () => 'applied' | 'not found' | undefined,
  ): Promise<void> {
    await this.held;
    if (change() === 'not found') {
      await route.fulfill({ status: 404, json: CART_ITEM_NOT_FOUND });
      return;
    }
    await route.fulfill({ json: this.cart() });
  }
}

function unknownProduct(productId: number): string {
  return `CartMock has no product ${productId}: add it to fakeProductSearchMock.products or use fakeProductDetailsMock.product`;
}

function roundToCents(amount: number): number {
  return Math.round(amount * 100) / 100;
}
