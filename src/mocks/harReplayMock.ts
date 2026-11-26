import { join } from 'node:path';
import {
  expect,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';
import type { UserRole } from '@/config/users';
import { pathAndQuery, writeHar } from '@/har/harFile';
import {
  findEntry,
  harFromRecording,
  type Recording,
  readRecording,
} from '@/har/recording';

export class HarReplayMock {
  constructor(
    private readonly page: Page,
    private readonly workDirectory: string,
    private readonly baseURL: string,
    private readonly userRole: UserRole,
  ) {}

  async serve(name: string): Promise<Recording> {
    const recording = readRecording(name);
    if (recording.capture.role !== this.userRole) {
      throw new Error(
        `${name} was recorded as ${recording.capture.role}, but this test runs as ${this.userRole}: add test.use({ userRole: '${recording.capture.role}' })`,
      );
    }
    const harPath = join(this.workDirectory, `${name}.har`);
    writeHar(
      harPath,
      harFromRecording(recording, new URL(this.baseURL).origin),
    );
    await this.page.routeFromHAR(harPath, {
      url: recording.capture.route,
      notFound: 'abort',
    });
    return recording;
  }

  waitForReplayedResponse(method: string, url: string): Promise<Response> {
    const matches = (request: Request) =>
      request.method() === method && pathAndQuery(request.url()) === url;
    const response = this.page.waitForResponse((candidate) =>
      matches(candidate.request()),
    );
    const failure = this.page
      .waitForEvent('requestfailed', matches)
      .then((request): Response => {
        throw new Error(
          `${method} ${pathAndQuery(request.url())} failed (${request.failure()?.errorText ?? 'unknown'}). The recording has no entry for it: refresh it with the har-to-mock skill.`,
        );
      });
    response.catch(() => undefined);
    failure.catch(() => undefined);
    return Promise.race([response, failure]);
  }

  async expectMatchesRecording(
    recording: Recording,
    response: Response,
  ): Promise<void> {
    const entry = findEntry(
      recording,
      response.request().method(),
      pathAndQuery(response.url()),
    );
    expect(response.status()).toBe(entry.status);
    if (typeof entry.body === 'string') {
      expect(await response.text()).toBe(entry.body);
    } else {
      expect(await response.json()).toEqual(entry.body);
    }
  }
}
