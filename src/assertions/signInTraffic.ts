import { expect, type Page, type Request } from '@playwright/test';
import { expectToStay } from '@/assertions/settle';

const signInPath = '/api/v1/users/signin';

export class SignInTraffic {
  private readonly requests: Request[] = [];

  constructor(private readonly page: Page) {
    page.on('request', (request) => {
      if (new URL(request.url()).pathname === signInPath) {
        this.requests.push(request);
      }
    });
  }

  async expectAccepted(): Promise<void> {
    await this.expectSingleResponseWithStatus(200);
  }

  async expectRejected(): Promise<void> {
    await this.expectSingleResponseWithStatus(422);
  }

  async expectNoneSent(forMs: number): Promise<void> {
    await expectToStay(
      this.page,
      () => this.requests.length,
      0,
      forMs,
      `${signInPath} requests sent`,
    );
  }

  private async expectSingleResponseWithStatus(status: number): Promise<void> {
    await expect
      .poll(() => this.requests.length, {
        message: `exactly one ${signInPath} request`,
      })
      .toBe(1);
    const response = await this.requests[0]?.response();
    expect(response?.status()).toBe(status);
  }
}
