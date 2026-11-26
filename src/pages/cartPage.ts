import { expect, type Locator, type Page } from '@playwright/test';
import { CartItemRow } from '@/components/cartItemRow';
import { formatUsd } from '@/formatters/price';
import type { Product } from '@/models/product';
import type { Locators } from '@/types/locators';
import { BasePage } from './basePage';

const CLEAR_CONFIRMATION = 'Are you sure you want to clear your cart?';

export class CartPage extends BasePage {
  readonly url = '/cart';
  readonly title = 'Cart – Awesome Testing';
  private lastConfirmation: string | undefined;

  readonly heading: Locator;
  readonly empty: Locator;
  readonly itemRows: Locator;

  readonly links: Locators<'continueShopping' | 'browseProducts'>;
  readonly texts: Locators<'itemsCount' | 'totalPrice'>;
  readonly buttons: Locators<'checkout' | 'clear'>;

  constructor(page: Page) {
    super(page);

    this.heading = page.getByTestId('cart-title');
    this.empty = page.getByTestId('cart-empty');
    this.itemRows = page.getByTestId('cart-items-list').getByRole('row');

    this.links = {
      continueShopping: page.getByTestId('cart-continue-shopping'),
      browseProducts: page.getByTestId('cart-browse-products'),
    };

    this.texts = {
      itemsCount: page.getByTestId('cart-summary-items-count'),
      totalPrice: page.getByTestId('cart-summary-total-price'),
    };

    this.buttons = {
      checkout: page.getByTestId('cart-checkout-button'),
      clear: page.getByTestId('cart-clear-button'),
    };
  }

  item(productId: number): CartItemRow {
    return new CartItemRow(this.page, productId);
  }

  async clearCart(answer: 'accept' | 'dismiss'): Promise<void> {
    const dialogShown = this.page.waitForEvent('dialog');
    const clicked = this.buttons.clear.click();
    const dialog = await dialogShown;
    this.lastConfirmation = `${dialog.type()}: ${dialog.message()}`;
    await (answer === 'accept' ? dialog.accept() : dialog.dismiss());
    await clicked;
  }

  async continueShopping(): Promise<void> {
    await this.links.continueShopping.click();
  }

  async browseProducts(): Promise<void> {
    await this.links.browseProducts.click();
  }

  async expectClearConfirmationAsked(): Promise<void> {
    await expect
      .poll(() => this.lastConfirmation, { message: 'clear cart confirmation' })
      .toBe(`confirm: ${CLEAR_CONFIRMATION}`);
  }

  async expectEmpty(): Promise<void> {
    await expect(this.heading).toHaveText('Your Cart');
    await expect(this.empty).toBeVisible();
    await expect(this.links.browseProducts).toHaveText('Browse Products');
    await expect(this.itemRows).toHaveCount(0);
    await expect(this.buttons.checkout).toBeHidden();
    await this.expectCartCount(0);
  }

  async expectItems(
    lines: { product: Product; quantity: number }[],
  ): Promise<void> {
    await expect(this.empty).toBeHidden();
    await expect(this.itemRows).toHaveCount(lines.length);
    for (const { product, quantity } of lines) {
      await this.item(product.id).expectToShow(product, quantity);
    }
    const totalItems = lines.reduce(
      (total, { quantity }) => total + quantity,
      0,
    );
    const totalPrice = lines.reduce(
      (total, { product, quantity }) => total + product.price * quantity,
      0,
    );
    await this.expectSummary(totalItems, totalPrice);
  }

  async expectSummary(totalItems: number, totalPrice: number): Promise<void> {
    await expect(this.texts.itemsCount).toHaveText(String(totalItems));
    await expect(this.texts.totalPrice).toHaveText(formatUsd(totalPrice));
    await this.expectCartCount(totalItems);
  }
}
