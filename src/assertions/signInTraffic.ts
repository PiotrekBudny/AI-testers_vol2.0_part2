import { expect, type Page, type Request } from '@playwright/test';

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
    await this.page.waitForTimeout(forMs);
    expect(
      this.requests,
      `no ${signInPath} request was expected within ${forMs} ms`,
    ).toHaveLength(0);
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
