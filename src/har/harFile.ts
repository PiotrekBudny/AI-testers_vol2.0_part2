import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

interface HarHeader {
  name: string;
  value: string;
}

interface HarEntry {
  startedDateTime?: string;
  time?: number;
  request: {
    method: string;
    url: string;
    headers: HarHeader[];
    cookies?: unknown[];
    httpVersion?: string;
    queryString?: HarHeader[];
    headersSize?: number;
    bodySize?: number;
  };
  response: {
    status?: number;
    statusText?: string;
    httpVersion?: string;
    headers: HarHeader[];
    cookies?: unknown[];
    content: { text?: string; mimeType?: string; size?: number };
    redirectURL?: string;
    headersSize?: number;
    bodySize?: number;
  };
  cache?: Record<string, unknown>;
  timings?: Record<string, number>;
}

export interface Har {
  log: {
    version?: string;
    creator?: { name: string; version: string };
    entries: HarEntry[];
  };
}

const sensitiveHeaders = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-client-session-id',
]);

export function readHar(path: string): Har {
  return JSON.parse(readFileSync(path, 'utf8')) as Har;
}

export function writeHar(path: string, har: Har): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(har, null, 2)}\n`);
}

export function sanitizeHar(har: Har): Har {
  for (const entry of har.log.entries) {
    entry.request.headers = safeHeaders(entry.request.headers);
    entry.response.headers = safeHeaders(entry.response.headers);
    entry.request.cookies = [];
    entry.response.cookies = [];
  }
  return har;
}

export function pathAndQuery(url: string): string {
  const parsed = new URL(url);
  return `${parsed.pathname}${parsed.search}`;
}

function safeHeaders(headers: HarHeader[]): HarHeader[] {
  return headers.filter(
    (header) => !sensitiveHeaders.has(header.name.toLowerCase()),
  );
}
