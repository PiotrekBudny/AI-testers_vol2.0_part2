import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  expect,
  type Page,
  type Request,
  type Response,
} from '@playwright/test';
import {
  pathAndQuery,
  readHar,
  sanitizeHar,
  withOrigin,
  writeHar,
} from '../har/harFile';

export class HarReplayMock {
  static readonly directory = join(__dirname, '..', '..', 'hars');

  private readonly recordings = new Map<string, string>();

  constructor(
    private readonly page: Page,
    readonly updating: boolean,
    private readonly workDirectory: string,
    private readonly baseURL: string,
  ) {}

  async serve(harName: string, url: string | RegExp): Promise<void> {
    const committedPath = this.path(harName);
    const workPath = join(this.workDirectory, harName);
    if (!this.updating) {
      if (!existsSync(committedPath)) {
        throw new Error(
          `No HAR at hars/${harName}. Check the name, or record it with UPDATE_HAR=true.`,
        );
      }
      writeHar(
        workPath,
        withOrigin(readHar(committedPath), new URL(this.baseURL).origin),
      );
    }
    await this.page.routeFromHAR(workPath, {
      url,
      update: this.updating,
      updateContent: 'embed',
      updateMode: 'minimal',
      notFound: 'abort',
    });
    if (this.updating) {
      this.recordings.set(committedPath, workPath);
    }
  }

  waitForReplayedResponse(method: string, pathname: string): Promise<Response> {
    const matches = (request: Request) =>
      request.method() === method &&
      new URL(request.url()).pathname === pathname;
    const response = this.page.waitForResponse((candidate) =>
      matches(candidate.request()),
    );
    const failure = this.page
      .waitForEvent('requestfailed', matches)
      .then((request): Response => {
        throw new Error(
          `${method} ${pathAndQuery(request.url())} failed (${request.failure()?.errorText ?? 'unknown'}). When replaying, the HAR has no entry for it: re-record with UPDATE_HAR=true.`,
        );
      });
    response.catch(() => undefined);
    failure.catch(() => undefined);
    return Promise.race([response, failure]);
  }

  recordedJson<T>(
    harName: string,
    method: string,
    pathAndQueryToFind: string,
  ): T {
    const entry = readHar(this.path(harName)).log.entries.find(
      (candidate) =>
        candidate.request.method === method &&
        pathAndQuery(candidate.request.url) === pathAndQueryToFind,
    );
    const text = entry?.response.content.text;
    if (text === undefined) {
      throw new Error(
        `${harName} has no ${method} ${pathAndQueryToFind} response`,
      );
    }
    return JSON.parse(text) as T;
  }

  async expectMatchesRecording(
    harName: string,
    response: Response,
  ): Promise<void> {
    if (this.updating) {
      return;
    }
    expect(await response.json()).toEqual(
      this.recordedJson(
        harName,
        response.request().method(),
        pathAndQuery(response.url()),
      ),
    );
  }

  async finishRecording(testPassed: boolean): Promise<void> {
    if (this.recordings.size === 0 || !testPassed) {
      return;
    }
    await this.page.context().close();
    for (const [committedPath, workPath] of this.recordings) {
      const har = readHar(workPath);
      if (har.log.entries.length === 0) {
        throw new Error(
          `Recording for ${committedPath} has no entries; kept the committed file`,
        );
      }
      writeHar(committedPath, sanitizeHar(har));
    }
  }

  private path(harName: string): string {
    return join(HarReplayMock.directory, harName);
  }
}
