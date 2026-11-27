import { expect, type Page, type Route } from '@playwright/test';
import { expectToStay } from '@/assertions/settle';
import { requireMockIds } from '@/config/mockIds';
import type { Order, OrderStatus } from '@/models/order';
import type { PageDto } from '@/models/pageDto';
import { apiRoutes } from './apiRoutes';
import { pathId } from './pathId';
import { ResponseHold } from './responseHold';

const FORWARD_RANK: Record<Exclude<OrderStatus, 'CANCELLED'>, number> = {
  PENDING: 0,
  PAID: 1,
  SHIPPED: 2,
  DELIVERED: 3,
};

export type ListQuery = {
  page: number;
  size: number;
  status: string | null;
};

type StatusUpdate = {
  id: number;
  status: OrderStatus;
};

export class AdminOrdersMock {
  pageSize: number | undefined;
  readonly listQueries: ListQuery[] = [];
  readonly statusUpdates: StatusUpdate[] = [];
  readonly cancelledIds: number[] = [];
  private orders: Order[] = [];
  private readonly updateHold = new ResponseHold();

  constructor(private readonly page: Page) {}

  async register(): Promise<void> {
    await this.page.route(apiRoutes.orderSubresources, (route) =>
      this.handleUnknownSubresource(route),
    );
    await this.page.route(apiRoutes.orderPayments, (route) =>
      this.handlePayments(route),
    );
    await this.page.route(apiRoutes.orderStatus, (route) =>
      this.handleStatus(route),
    );
    await this.page.route(apiRoutes.orderCancel, (route) =>
      this.handleCancel(route),
    );
    await this.page.route(apiRoutes.order, (route) => this.handleOrder(route));
    await this.page.route(apiRoutes.adminOrders, (route) =>
      this.handleList(route),
    );
  }

  seed(orders: Order[]): void {
    requireMockIds(
      'order',
      orders.map((order) => order.id),
    );
    this.orders = orders.map((order) => ({ ...order }));
  }

  holdUpdates(): () => void {
    return this.updateHold.hold();
  }

  releaseHeldResponses(): void {
    this.updateHold.release();
  }

  async expectLastListQuery(expected: Partial<ListQuery>): Promise<void> {
    await expect
      .poll(() => this.listQueries.at(-1), {
        message: 'last admin orders query',
      })
      .toMatchObject(expected);
  }

  async expectListQueriesToStay(
    queries: ListQuery[],
    forMs: number,
  ): Promise<void> {
    await expectToStay(
      this.page,
      () => this.listQueries,
      queries,
      forMs,
      'admin orders queries',
    );
  }

  async expectStatusUpdates(updates: StatusUpdate[]): Promise<void> {
    await expect
      .poll(() => this.statusUpdates, { message: 'order status updates' })
      .toEqual(updates);
  }

  async expectStatusUpdatesToStay(
    updates: StatusUpdate[],
    forMs: number,
  ): Promise<void> {
    await expectToStay(
      this.page,
      () => this.statusUpdates,
      updates,
      forMs,
      'order status updates',
    );
  }

  async expectCancelledIds(ids: number[]): Promise<void> {
    await expect
      .poll(() => this.cancelledIds, { message: 'cancel requests' })
      .toEqual(ids);
  }

  async expectCancelledIdsToStay(ids: number[], forMs: number): Promise<void> {
    await expectToStay(
      this.page,
      () => this.cancelledIds,
      ids,
      forMs,
      'cancel requests',
    );
  }

  async expectOrderStatus(id: number, status: OrderStatus): Promise<void> {
    await expect
      .poll(() => this.find(id)?.status, {
        message: `status of mocked order ${id}`,
      })
      .toBe(status);
  }

  private find(id: number): Order | undefined {
    return this.orders.find((order) => order.id === id);
  }

  private async handleList(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const params = new URL(route.request().url()).searchParams;
    const query = {
      page: Number(params.get('page') ?? 0),
      size: Number(params.get('size') ?? 10),
      status: params.get('status'),
    };
    this.listQueries.push(query);
    const matching = this.orders.filter(
      (order) => query.status === null || order.status === query.status,
    );
    const pageSize = Math.min(query.size, this.pageSize ?? query.size);
    const start = query.page * pageSize;
    const body: PageDto<Order> = {
      content: matching.slice(start, start + pageSize),
      pageNumber: query.page,
      pageSize,
      totalElements: matching.length,
      totalPages: Math.ceil(matching.length / pageSize),
    };
    await route.fulfill({ json: body });
  }

  private async handleOrder(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const order = this.find(pathId(route.request().url()));
    if (order === undefined) {
      await this.fulfillNotFound(route);
      return;
    }
    await route.fulfill({ json: order });
  }

  private async handlePayments(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ json: [] });
  }

  private async handleUnknownSubresource(route: Route): Promise<void> {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    await route.fulfill({ status: 404, json: { message: 'Not found' } });
  }

  private async handleStatus(route: Route): Promise<void> {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    const id = pathId(route.request().url(), 1);
    const status = route.request().postDataJSON() as OrderStatus;
    this.statusUpdates.push({ id, status });
    await this.updateHold.wait();
    await this.changeStatus(route, id, status);
  }

  private async handleCancel(route: Route): Promise<void> {
    if (route.request().method() !== 'POST') {
      await route.fallback();
      return;
    }
    const id = pathId(route.request().url(), 1);
    this.cancelledIds.push(id);
    await this.updateHold.wait();
    await this.changeStatus(route, id, 'CANCELLED');
  }

  private async changeStatus(
    route: Route,
    id: number,
    status: OrderStatus,
  ): Promise<void> {
    const order = this.find(id);
    if (order === undefined) {
      await this.fulfillNotFound(route);
      return;
    }
    if (!isAllowed(order.status, status)) {
      await route.fulfill({
        status: 400,
        json: {
          message: `Cannot change order status from ${order.status} to ${status}`,
        },
      });
      return;
    }
    order.status = status;
    await route.fulfill({ json: order });
  }

  private async fulfillNotFound(route: Route): Promise<void> {
    await route.fulfill({ status: 404, json: { message: 'Order not found' } });
  }
}

function isAllowed(from: OrderStatus, to: OrderStatus): boolean {
  if (from === to) {
    return true;
  }
  if (from === 'CANCELLED' || from === 'DELIVERED') {
    return false;
  }
  if (to === 'CANCELLED') {
    return from === 'PENDING' || from === 'PAID';
  }
  return FORWARD_RANK[to] > FORWARD_RANK[from];
}
