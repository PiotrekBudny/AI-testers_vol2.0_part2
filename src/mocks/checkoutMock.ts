import { expect, type Page, type Request, type Route } from '@playwright/test';
import { apiRoutes } from '@/api/endpoints';
import { expectToStay } from '@/assertions/settle';
import { SAFE_MOCK_ID_FLOOR } from '@/config/mockIds';
import { ShopDataGenerator } from '@/generators/shopDataGenerator';
import { toBackendTimestamp } from '@/generators/timestamps';
import type {
  Address,
  AddressFieldErrors,
  Order,
  TaxPreview,
  VatRate,
} from '@/models/order';
import type { CartMock } from './cartMock';
import { roundToCents } from './support/money';
import { pathId } from './support/pathId';
import { ResponseHold } from './support/responseHold';

const DEFAULT_VAT_RATES: VatRate[] = [
  { countryCode: 'PL', countryName: 'Poland', rate: 23 },
  { countryCode: 'DE', countryName: 'Germany', rate: 19 },
  { countryCode: 'US', countryName: 'United States', rate: 0 },
];

const RESERVATION_MS = 15 * 60_000;

type ReceivedOrder = {
  address: Address;
  idempotencyKey: string | null;
};

type Tax = Pick<TaxPreview, 'country' | 'rate' | 'taxAmount' | 'netAmount'>;

export class CheckoutMock {
  readonly receivedOrders: ReceivedOrder[] = [];
  readonly attemptKeys: (string | null)[] = [];
  private readonly orders: Order[] = [];
  private readonly ordersByKey = new Map<string, Order>();
  private readonly stockLimits = new Map<number, number>();
  private readonly vatRates: VatRate[] = [...DEFAULT_VAT_RATES];
  private readonly taxPreviews: TaxPreview[] = [];
  private readonly orderHold = new ResponseHold();
  private readonly orderData = new ShopDataGenerator();

  constructor(
    private readonly page: Page,
    private readonly username: string,
    private readonly cartMock: CartMock,
  ) {}

  async register(): Promise<void> {
    this.page.on('request', (request) => this.recordAttempt(request));
    await this.page.route(apiRoutes.taxPreview, (route) =>
      this.handleTaxPreview(route),
    );
    await this.page.route(apiRoutes.orders, (route) =>
      this.handlePlaceOrder(route),
    );
    await this.page.route(apiRoutes.order, (route) => this.handleOrder(route));
    await this.page.route(apiRoutes.orderPayments, (route) =>
      this.handleOrderPayments(route),
    );
  }

  setVatRate(rate: VatRate): void {
    this.vatRates.unshift(rate);
  }

  limitStock(productId: number, available: number): void {
    this.stockLimits.set(productId, available);
  }

  async rejectAddress(errors: AddressFieldErrors): Promise<void> {
    await this.page.route(
      apiRoutes.orders,
      async (route) => {
        this.receive(route.request());
        await route.fulfill({ status: 400, json: errors });
      },
      { times: 1 },
    );
  }

  holdResponses(): () => void {
    return this.orderHold.hold();
  }

  releaseHeldResponses(): void {
    this.orderHold.release();
  }

  async waitForTaxPreview(): Promise<TaxPreview> {
    await expect
      .poll(() => this.taxPreviews.length, {
        message: 'waiting for a served tax preview',
      })
      .toBeGreaterThan(0);
    return this.taxPreviews.at(-1) as TaxPreview;
  }

  async waitForOrder(): Promise<Order> {
    await expect
      .poll(() => this.orders.length, {
        message: 'waiting for an order created by the mock',
      })
      .toBeGreaterThan(0);
    return this.orders.at(-1) as Order;
  }

  async expectPlacedOrder(address: Address): Promise<void> {
    await expect
      .poll(() => this.orders.map((order) => order.shippingAddress), {
        message: 'shipping addresses of the orders created by the mock',
      })
      .toEqual([address]);
  }

  async expectOrdersToStay(count: number, forMs: number): Promise<void> {
    await expectToStay(
      this.page,
      () => this.orders.length,
      count,
      forMs,
      'orders created by the mock',
    );
  }

  async expectReceivedOrdersToStay(
    count: number,
    forMs: number,
  ): Promise<void> {
    await expectToStay(
      this.page,
      () => this.receivedOrders.length,
      count,
      forMs,
      'order requests received by the mock',
    );
  }

  async expectAttemptsToShareIdempotencyKey(count: number): Promise<void> {
    await expect
      .poll(
        () => ({
          attempts: this.attemptKeys.length,
          withoutKey: this.attemptKeys.filter((key) => key === null).length,
          distinctKeys: new Set(this.attemptKeys).size,
        }),
        { message: 'Idempotency-Key headers of the order attempts' },
      )
      .toEqual({ attempts: count, withoutKey: 0, distinctKeys: 1 });
  }

  private recordAttempt(request: Request): void {
    if (request.method() === 'POST' && apiRoutes.orders.test(request.url())) {
      this.attemptKeys.push(request.headers()['idempotency-key'] ?? null);
    }
  }

  private receive(request: Request): ReceivedOrder {
    const received = {
      address: request.postDataJSON() as Address,
      idempotencyKey: request.headers()['idempotency-key'] ?? null,
    };
    this.receivedOrders.push(received);
    return received;
  }

  private findVatRate(country: string): VatRate | undefined {
    const wanted = country.trim().toLowerCase();
    return this.vatRates.find(
      (rate) =>
        rate.countryCode.toLowerCase() === wanted ||
        rate.countryName.toLowerCase() === wanted,
    );
  }

  private taxFor(country: string, total: number): Tax | undefined {
    const vatRate = this.findVatRate(country);
    if (vatRate === undefined) {
      return undefined;
    }
    const taxAmount = roundToCents(
      (total * vatRate.rate) / (100 + vatRate.rate),
    );
    return {
      country: vatRate.countryCode,
      rate: vatRate.rate,
      taxAmount,
      netAmount: roundToCents(total - taxAmount),
    };
  }

  private async handleTaxPreview(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const country =
      new URL(route.request().url()).searchParams.get('country') ?? '';
    if (country.trim() === '') {
      await route.fulfill({
        status: 400,
        json: { message: 'Country is required' },
      });
      return;
    }
    const totalAmount = this.cartMock.cart().totalPrice;
    const tax = this.taxFor(country, totalAmount);
    if (tax === undefined) {
      await route.fulfill({
        status: 404,
        json: { message: `VAT rate not found for country: ${country}` },
      });
      return;
    }
    const preview = { ...tax, totalAmount };
    this.taxPreviews.push(preview);
    await route.fulfill({ json: preview });
  }

  private async handlePlaceOrder(route: Route): Promise<void> {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const { address, idempotencyKey } = this.receive(route.request());
    await this.orderHold.wait();
    const replayed =
      idempotencyKey === null
        ? undefined
        : this.ordersByKey.get(idempotencyKey);
    if (replayed !== undefined) {
      await route.fulfill({
        status: 201,
        headers: { 'Idempotent-Replayed': 'true' },
        json: replayed,
      });
      return;
    }
    const lines = this.cartMock.lines();
    if (lines.length === 0) {
      await route.fulfill({ status: 400, json: { message: 'Cart is empty' } });
      return;
    }
    const shortLine = lines.find(
      ({ product, quantity }) =>
        quantity >
        (this.stockLimits.get(product.id) ?? Number.POSITIVE_INFINITY),
    );
    if (shortLine !== undefined) {
      await route.fulfill({
        status: 409,
        json: {
          message: `Insufficient stock for product ${shortLine.product.name}`,
        },
      });
      return;
    }
    const order = this.createOrder(address);
    if (idempotencyKey !== null) {
      this.ordersByKey.set(idempotencyKey, order);
    }
    this.cartMock.clear();
    await route.fulfill({ status: 201, json: order });
  }

  private createOrder(address: Address): Order {
    const id = SAFE_MOCK_ID_FLOOR + this.orders.length + 1;
    const items = this.cartMock.lines().map(({ product, quantity }, index) => ({
      id: id * 100 + index,
      productId: product.id,
      quantity,
      productName: product.name,
      unitPrice: product.price,
      totalPrice: roundToCents(product.price * quantity),
    }));
    const totalAmount = this.cartMock.cart().totalPrice;
    const tax = this.taxFor(address.country, totalAmount);
    const now = new Date();
    const order = this.orderData.order(id, {
      username: this.username,
      items,
      totalAmount,
      status: 'PENDING',
      taxCountry: tax?.country ?? null,
      taxRate: tax?.rate ?? null,
      taxAmount: tax?.taxAmount ?? null,
      netAmount: tax?.netAmount ?? null,
      reservationExpiresAt: new Date(
        now.getTime() + RESERVATION_MS,
      ).toISOString(),
      shippingAddress: address,
      createdAt: toBackendTimestamp(now),
    });
    this.orders.push(order);
    return order;
  }

  private async handleOrder(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const id = pathId(route.request().url());
    const order = this.orders.find((candidate) => candidate.id === id);
    if (order === undefined) {
      await route.fulfill({
        status: 404,
        json: { message: 'Order not found' },
      });
      return;
    }
    await route.fulfill({ json: order });
  }

  private async handleOrderPayments(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: [] });
  }
}
