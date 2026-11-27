import { expect, type Page, type Request, type Route } from '@playwright/test';
import { apiRoutes } from '@/api/endpoints';
import { expectToStay } from '@/assertions/settle';
import { requireMockIds } from '@/config/mockIds';
import type {
  InventoryAdjustment,
  InventoryItem,
  InventoryMovement,
  StockStatus,
} from '@/models/inventory';
import { pageOf } from './support/paging';
import { pathId } from './support/pathId';
import { ResponseHold } from './support/responseHold';

const LOW_STOCK_LIMIT = 5;

type ListQuery = {
  page: number;
  size: number;
  search: string | null;
  category: string | null;
  status: string | null;
  lowStockThreshold: string | null;
};

type AttemptContent = Pick<InventoryAdjustment, 'delta' | 'reason'>;

export class AdminInventoryMock {
  pageSize: number | undefined;
  readonly listQueries: ListQuery[] = [];
  readonly attempts: InventoryAdjustment[] = [];
  private items: InventoryItem[] = [];
  private readonly movements: InventoryMovement[] = [];
  private readonly adjustmentHold = new ResponseHold();
  private losingNextResponse = false;

  constructor(private readonly page: Page) {}

  async register(): Promise<void> {
    this.page.on('request', (request) => this.recordAttempt(request));
    await this.page.route(apiRoutes.inventoryList, (route) =>
      this.handleList(route),
    );
    await this.page.route(apiRoutes.inventoryItem, (route) =>
      this.handleItem(route),
    );
    await this.page.route(apiRoutes.inventoryMovements, (route) =>
      this.handleMovements(route),
    );
    await this.page.route(apiRoutes.inventoryAdjustments, (route) =>
      this.handleAdjustment(route),
    );
  }

  seed(items: InventoryItem[]): void {
    requireMockIds(
      'inventory product',
      items.map((item) => item.productId),
    );
    this.items = items.map((item) => ({ ...item }));
  }

  holdAdjustments(): () => void {
    return this.adjustmentHold.hold();
  }

  releaseHeldResponses(): void {
    this.adjustmentHold.release();
  }

  loseNextResponse(): void {
    this.losingNextResponse = true;
  }

  async expectLastListQuery(expected: Partial<ListQuery>): Promise<void> {
    await expect
      .poll(() => this.listQueries.at(-1), { message: 'last inventory query' })
      .toMatchObject(expected);
  }

  async expectAttempts(expected: AttemptContent[]): Promise<void> {
    await expect
      .poll(
        () =>
          this.attempts.map(({ delta, reason }) => ({
            delta,
            reason,
          })),
        { message: 'inventory adjustment attempts' },
      )
      .toEqual(expected);
  }

  async expectAttemptsToStay(count: number, forMs: number): Promise<void> {
    await expectToStay(
      this.page,
      () => this.attempts.length,
      count,
      forMs,
      'number of inventory adjustment attempts',
    );
  }

  async expectAttemptsToShareRequestId(count: number): Promise<void> {
    await this.expectRequestIds(count, 1);
  }

  async expectDistinctRequestIds(count: number): Promise<void> {
    await this.expectRequestIds(count, count);
  }

  async expectQuantity(productId: number, quantity: number): Promise<void> {
    await expect
      .poll(() => this.find(productId)?.availableQuantity, {
        message: `mocked stock of product ${productId}`,
      })
      .toBe(quantity);
  }

  async expectAdjustmentMovements(
    productId: number,
    count: number,
  ): Promise<void> {
    await expect
      .poll(() => this.movementsOf(productId).length, {
        message: `adjustment movements of product ${productId}`,
      })
      .toBe(count);
  }

  private async expectRequestIds(
    attempts: number,
    distinct: number,
  ): Promise<void> {
    await expect
      .poll(
        () => ({
          attempts: this.attempts.length,
          distinct: new Set(this.attempts.map(({ requestId }) => requestId))
            .size,
        }),
        { message: 'requestIds of the adjustment attempts' },
      )
      .toEqual({ attempts, distinct });
  }

  private recordAttempt(request: Request): void {
    if (
      request.method() === 'POST' &&
      apiRoutes.inventoryAdjustments.test(request.url())
    ) {
      this.attempts.push(request.postDataJSON() as InventoryAdjustment);
    }
  }

  private find(productId: number): InventoryItem | undefined {
    return this.items.find((item) => item.productId === productId);
  }

  private movementsOf(productId: number): InventoryMovement[] {
    return this.movements.filter(
      (movement) => movement.productId === productId,
    );
  }

  private async handleList(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const params = new URL(route.request().url()).searchParams;
    const query: ListQuery = {
      page: Number(params.get('page') ?? 0),
      size: Number(params.get('size') ?? 20),
      search: params.get('search'),
      category: params.get('category'),
      status: params.get('status'),
      lowStockThreshold: params.get('lowStockThreshold'),
    };
    this.listQueries.push(query);
    const search = query.search?.toLowerCase() ?? '';
    const matching = this.items.filter(
      (item) =>
        item.name.toLowerCase().includes(search) &&
        (query.category === null || item.category === query.category) &&
        (query.status === null || item.stockStatus === query.status),
    );
    await route.fulfill({
      json: pageOf(
        matching,
        query.page,
        Math.min(query.size, this.pageSize ?? query.size),
      ),
    });
  }

  private async handleItem(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const item = this.find(pathId(route.request().url()));
    if (item === undefined) {
      await route.fulfill({
        status: 404,
        json: { message: 'Product not found' },
      });
      return;
    }
    await route.fulfill({ json: item });
  }

  private async handleMovements(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const params = new URL(route.request().url()).searchParams;
    await route.fulfill({
      json: pageOf(
        this.movementsOf(pathId(route.request().url(), 1)),
        Number(params.get('page') ?? 0),
        Number(params.get('size') ?? 20),
      ),
    });
  }

  private async handleAdjustment(route: Route): Promise<void> {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const productId = pathId(route.request().url(), 1);
    const adjustment = route.request().postDataJSON() as InventoryAdjustment;
    await this.adjustmentHold.wait();
    const losingResponse = this.losingNextResponse;
    this.losingNextResponse = false;
    const earlier = this.movements.find(
      (movement) => movement.requestId === adjustment.requestId,
    );
    if (earlier !== undefined) {
      const sameRequest =
        earlier.productId === productId &&
        earlier.delta === adjustment.delta &&
        earlier.reason === adjustment.reason;
      await (sameRequest
        ? route.fulfill({ status: 201, json: earlier })
        : this.fulfillConflict(route, 'requestId reused'));
      return;
    }
    const item = this.find(productId);
    if (item === undefined) {
      await route.fulfill({
        status: 404,
        json: { message: 'Product not found' },
      });
      return;
    }
    const quantityAfter = item.availableQuantity + adjustment.delta;
    if (quantityAfter < 0) {
      await this.fulfillConflict(route, 'Insufficient stock');
      return;
    }
    const movement = this.apply(item, adjustment, quantityAfter);
    if (losingResponse) {
      await route.abort('connectionreset');
      return;
    }
    await route.fulfill({ status: 201, json: movement });
  }

  private apply(
    item: InventoryItem,
    adjustment: InventoryAdjustment,
    quantityAfter: number,
  ): InventoryMovement {
    item.availableQuantity = quantityAfter;
    item.stockStatus = stockStatusFor(quantityAfter);
    const movement: InventoryMovement = {
      id: this.movements.length + 1,
      productId: item.productId,
      orderId: null,
      type: 'ADMIN_ADJUSTMENT',
      delta: adjustment.delta,
      quantityAfter,
      actor: 'admin',
      reason: adjustment.reason,
      requestId: adjustment.requestId,
      createdAt: '2026-11-21T11:00:00.000001',
    };
    this.movements.unshift(movement);
    return movement;
  }

  private async fulfillConflict(route: Route, message: string): Promise<void> {
    await route.fulfill({ status: 409, json: { message } });
  }
}

function stockStatusFor(quantity: number): StockStatus {
  if (quantity === 0) {
    return 'OUT_OF_STOCK';
  }
  return quantity <= LOW_STOCK_LIMIT ? 'LOW_STOCK' : 'IN_STOCK';
}
