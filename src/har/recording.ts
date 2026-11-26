import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Har } from './harFile';

interface RecordedEntry {
  method: string;
  url: string;
  status: number;
  contentType: string;
  body: unknown;
}

export interface Recording {
  name: string;
  capture: { page: string; route: string; role: string };
  entries: RecordedEntry[];
}

const recordingsDirectory = join(__dirname, '..', 'mocks', 'recorded');

export function readRecording(name: string): Recording {
  const path = join(recordingsDirectory, `${name}.json`);
  if (!existsSync(path)) {
    throw new Error(
      `No recording at src/mocks/recorded/${name}.json. Capture it with the har-to-mock skill: node .claude/skills/har-to-mock/capture.mjs ${name} --page <path> --route <glob>`,
    );
  }
  return JSON.parse(readFileSync(path, 'utf8')) as Recording;
}

export function singleEntry(recording: Recording): RecordedEntry {
  const [entry, ...others] = recording.entries;
  if (!entry || others.length > 0) {
    throw new Error(
      `${recording.name} has ${recording.entries.length} entries, expected exactly one`,
    );
  }
  return entry;
}

export function findEntry(
  recording: Recording,
  method: string,
  url: string,
): RecordedEntry {
  const entry = recording.entries.find(
    (candidate) => candidate.method === method && candidate.url === url,
  );
  if (!entry) {
    throw new Error(`${recording.name} has no ${method} ${url} entry`);
  }
  return entry;
}

export function harFromRecording(recording: Recording, origin: string): Har {
  return {
    log: {
      version: '1.2',
      creator: { name: 'har-to-mock', version: '1' },
      entries: recording.entries.map((entry) => {
        const text =
          typeof entry.body === 'string'
            ? entry.body
            : JSON.stringify(entry.body);
        return {
          startedDateTime: new Date(0).toISOString(),
          time: 0,
          request: {
            method: entry.method,
            url: new URL(entry.url, origin).href,
            httpVersion: 'HTTP/1.1',
            headers: [],
            cookies: [],
            queryString: [],
            headersSize: -1,
            bodySize: -1,
          },
          response: {
            status: entry.status,
            statusText: '',
            httpVersion: 'HTTP/1.1',
            headers: [{ name: 'content-type', value: entry.contentType }],
            cookies: [],
            content: { size: text.length, mimeType: entry.contentType, text },
            redirectURL: '',
            headersSize: -1,
            bodySize: -1,
          },
          cache: {},
          timings: { send: 0, wait: 0, receive: 0 },
        };
      }),
    },
  };
}
