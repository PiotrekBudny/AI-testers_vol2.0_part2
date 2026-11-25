import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, type Response } from '@playwright/test';

interface HarHeader {
  name: string;
  value: string;
}

interface HarEntry {
  request: {
    method: string;
    url: string;
    headers: HarHeader[];
    cookies?: unknown[];
  };
  response: {
    headers: HarHeader[];
    cookies?: unknown[];
    content: { text?: string };
  };
}

interface Har {
  log: { entries: HarEntry[] };
}

const sensitiveHeaders = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-client-session-id',
]);

export class HarMock {
  static readonly directory = join(__dirname, '..', '..', 'hars');

  private readonly recordings = new Map<string, string>();

  constructor(
    private readonly page: Page,
    readonly updating: boolean,
    private readonly recordingDirectory: string,
  ) {}

  async serve(harName: string, url: string | RegExp): Promise<void> {
    const committedPath = this.path(harName);
    const recordingPath = join(this.recordingDirectory, harName);
    await this.page.routeFromHAR(
      this.updating ? recordingPath : committedPath,
      {
        url,
        update: this.updating,
        updateContent: 'embed',
        updateMode: 'minimal',
        notFound: 'abort',
      },
    );
    if (this.updating) {
      this.recordings.set(committedPath, recordingPath);
    }
  }

  recordedJson<T>(harName: string, method: string, pathAndQuery: string): T {
    const entry = this.read(this.path(harName)).log.entries.find(
      (candidate) =>
        candidate.request.method === method &&
        this.pathAndQuery(candidate.request.url) === pathAndQuery,
    );
    const text = entry?.response.content.text;
    if (text === undefined) {
      throw new Error(`${harName} has no ${method} ${pathAndQuery} response`);
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
        this.pathAndQuery(response.url()),
      ),
    );
  }

  async finishRecording(testPassed: boolean): Promise<void> {
    if (this.recordings.size === 0 || !testPassed) {
      return;
    }
    await this.page.context().close();
    for (const [committedPath, recordingPath] of this.recordings) {
      const har = this.read(recordingPath);
      if (har.log.entries.length === 0) {
        throw new Error(
          `Recording for ${committedPath} has no entries; kept the committed file`,
        );
      }
      writeFileSync(
        committedPath,
        `${JSON.stringify(this.sanitized(har), null, 2)}\n`,
      );
    }
  }

  private sanitized(har: Har): Har {
    for (const entry of har.log.entries) {
      entry.request.headers = this.safeHeaders(entry.request.headers);
      entry.response.headers = this.safeHeaders(entry.response.headers);
      entry.request.cookies = [];
      entry.response.cookies = [];
    }
    return har;
  }

  private safeHeaders(headers: HarHeader[]): HarHeader[] {
    return headers.filter(
      (header) => !sensitiveHeaders.has(header.name.toLowerCase()),
    );
  }

  private pathAndQuery(url: string): string {
    const parsed = new URL(url);
    return `${parsed.pathname}${parsed.search}`;
  }

  private read(harPath: string): Har {
    return JSON.parse(readFileSync(harPath, 'utf8')) as Har;
  }

  private path(harName: string): string {
    return join(HarMock.directory, harName);
  }
}
