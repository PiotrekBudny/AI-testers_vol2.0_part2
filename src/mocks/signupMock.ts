import { expect, type Page, type Route } from '@playwright/test';
import { apiRoutes } from '@/api/endpoints';
import { expectToStay } from '@/assertions/settle';
import { ResponseHold } from '@/mocks/support/responseHold';
import type { RegisterRequest } from '@/models/auth';

export class SignupMock {
  readonly receivedRequests: RegisterRequest[] = [];
  private readonly hold = new ResponseHold();

  constructor(private readonly page: Page) {}

  async register(): Promise<void> {
    await this.page.route(apiRoutes.signUp, (route) => this.handle(route));
  }

  holdResponses(): () => void {
    return this.hold.hold();
  }

  releaseHeldResponses(): void {
    this.hold.release();
  }

  async expectReceived(request: RegisterRequest): Promise<void> {
    await expect
      .poll(() => this.receivedRequests, { message: 'signup requests' })
      .toEqual([request]);
  }

  async expectReceivedToStay(
    requests: RegisterRequest[],
    forMs: number,
  ): Promise<void> {
    await expectToStay(
      this.page,
      () => this.receivedRequests,
      requests,
      forMs,
      'signup requests',
    );
  }

  private async handle(route: Route): Promise<void> {
    this.receivedRequests.push(route.request().postDataJSON());
    await this.hold.wait();
    await route.fulfill({ status: 201 });
  }
}
