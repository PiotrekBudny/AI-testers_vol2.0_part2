import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';
import dotenv from 'dotenv';

const sensitiveHeaders = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'x-client-session-id',
]);
const sensitiveBodyKeys = new Set([
  'token',
  'refreshToken',
  'accessToken',
  'challengeToken',
  'password',
  'email',
]);
const forbiddenPaths = /users\/(signin|refresh)|\/auth\//;

function fail(message) {
  throw new Error(message);
}

function captureSettings(recordingPath, values) {
  const stored = existsSync(recordingPath)
    ? JSON.parse(readFileSync(recordingPath, 'utf8')).capture
    : {};
  const settings = {
    page: values.page ?? stored.page,
    route: values.route ?? stored.route,
    role: values.role ?? stored.role ?? 'client',
  };
  if (!settings.page || !settings.route) {
    fail(
      `${recordingPath} doesn't exist yet: pass --page <path> and --route <glob>`,
    );
  }
  if (/^[a-zA-Z]:[\\/]/.test(settings.page)) {
    fail(
      `--page became a file path (${settings.page}): Git Bash rewrites arguments starting with "/". Pass it without the slash (--page products) or set MSYS_NO_PATHCONV=1.`,
    );
  }
  settings.page = `/${settings.page.replace(/^\/+/, '')}`;
  if (forbiddenPaths.test(settings.route)) {
    fail(`Refusing to record auth traffic (${settings.route})`);
  }
  return settings;
}

async function signIn(origin, role) {
  const prefix = role.toUpperCase();
  const username = process.env[`${prefix}_USERNAME`];
  const password = process.env[`${prefix}_PASSWORD`];
  if (!username || !password) {
    fail(
      `Missing ${prefix}_USERNAME or ${prefix}_PASSWORD (in .env or the shell)`,
    );
  }
  const response = await fetch(`${origin}/api/v1/users/signin`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password }),
  }).catch((error) => fail(`Can't reach ${origin}: ${error.message}`));
  if (!response.ok) {
    fail(`API sign-in as ${username} failed with ${response.status}`);
  }
  const { token, refreshToken } = await response.json();
  if (!token || !refreshToken) {
    fail(`API sign-in as ${username} returned no tokens`);
  }
  return { token, refreshToken };
}

async function record(origin, session, settings, harPath) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL: origin,
      storageState: {
        cookies: [],
        origins: [
          {
            origin,
            localStorage: [
              { name: 'token', value: session.token },
              { name: 'refreshToken', value: session.refreshToken },
            ],
          },
        ],
      },
    });
    const page = await context.newPage();
    await page.routeFromHAR(harPath, {
      url: settings.route,
      update: true,
      updateContent: 'embed',
      updateMode: 'minimal',
    });
    await page.goto(settings.page);
    await page.waitForLoadState('networkidle');
    const redirectedToLogin = new URL(page.url()).pathname === '/login';
    await context.close();
    if (redirectedToLogin) {
      throw new Error(
        'The app redirected to /login: the API session was not accepted',
      );
    }
  } finally {
    await browser.close();
  }
}

function redact(value) {
  if (Array.isArray(value)) {
    return value.map(redact);
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        sensitiveBodyKeys.has(key) && inner !== null
          ? '[redacted]'
          : redact(inner),
      ]),
    );
  }
  return value;
}

function sanitizeHar(har) {
  for (const entry of har.log.entries) {
    for (const side of [entry.request, entry.response]) {
      side.headers = side.headers.filter(
        (header) => !sensitiveHeaders.has(header.name.toLowerCase()),
      );
      side.cookies = [];
    }
  }
  return har;
}

function parsedBody(url, contentType, text) {
  if (text === '' || !contentType?.includes('json')) {
    return text;
  }
  try {
    return JSON.parse(text);
  } catch {
    fail(`${url} says ${contentType} but its body isn't valid JSON`);
  }
}

function recordedEntries(har) {
  const byRequest = new Map();
  for (const { request, response } of har.log.entries) {
    const url = new URL(request.url);
    const path = `${url.pathname}${url.search}`;
    if (forbiddenPaths.test(url.pathname)) {
      fail(
        `Refusing to save auth traffic: ${request.method} ${path} matched the route. Narrow --route.`,
      );
    }
    const contentType =
      response.headers.find(
        (header) => header.name.toLowerCase() === 'content-type',
      )?.value ??
      response.content.mimeType ??
      '';
    byRequest.set(`${request.method} ${path}`, {
      method: request.method,
      url: path,
      status: response.status,
      contentType,
      body: redact(parsedBody(path, contentType, response.content.text ?? '')),
    });
  }
  return [...byRequest.values()];
}

function writeJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

const workHarPath = join(tmpdir(), `har-to-mock-${process.pid}.har`);

try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      page: { type: 'string' },
      route: { type: 'string' },
      role: { type: 'string' },
    },
  });
  const [name] = positionals;
  if (!name || !/^[a-zA-Z0-9-]+$/.test(name)) {
    fail(
      'Usage: node .claude/skills/har-to-mock/capture.mjs <name> [--page products --route "**/api/v1/products/search**" --role client]',
    );
  }
  dotenv.config({ quiet: true });
  const recordingPath = `src/mocks/recorded/${name}.json`;
  const harPath = `hars/${name}.har`;
  const settings = captureSettings(recordingPath, values);
  const origin = new URL(process.env.BASE_URL || 'https://aitesters.byst.re')
    .origin;

  const session = await signIn(origin, settings.role);
  await record(origin, session, settings, workHarPath);
  const har = sanitizeHar(JSON.parse(readFileSync(workHarPath, 'utf8')));
  const entries = recordedEntries(har);
  if (entries.length === 0) {
    fail(
      `Nothing matching ${settings.route} was requested on ${settings.page}`,
    );
  }
  writeJson(harPath, har);
  writeJson(recordingPath, { name, capture: settings, entries });
  execSync(`npx biome format --write "${recordingPath}"`, { stdio: 'ignore' });
  console.log(
    `Captured ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'} from ${origin}:`,
  );
  for (const entry of entries) {
    console.log(`  ${entry.method} ${entry.status} ${entry.url}`);
  }
  console.log(`Raw HAR (git-ignored): ${harPath}`);
  console.log(`Recording (commit it): ${recordingPath}`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  rmSync(workHarPath, { force: true });
}
