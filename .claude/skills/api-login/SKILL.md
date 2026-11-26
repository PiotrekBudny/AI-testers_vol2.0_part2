---
name: api-login
description: "How this project authenticates: via the API (AuthApi.signIn + storageStateFor + the loginViaApi auto fixture), never through the UI login form. Use it when: (1) writing or changing a Playwright test that needs a logged-in user or must stay logged out; (2) adding a new user role or account (new *_USERNAME/*_PASSWORD variables, a new UserRole value); (3) touching src/api/authApi.ts, src/api/apiSessions.ts, src/config/users.ts or the loginViaApi/apiSessions/storageState fixtures in src/fixtures/test.ts; (4) a test logs out, invalidates its token or mocks a 401 (expired session); (5) driving the app through Playwright MCP (a real browser) on any page behind login, for example to verify or explore something. Not for tests of the login form itself, beyond turning auto-login off with skipAutoLogin."
---

# API login

Tests never log in through the login form. They sign in over the API and start
with the session already in localStorage. Driving the app through Playwright
MCP follows the same rule.

## How it works

| Piece                               | File                     | Role                                                                                                                                                                                                                                                       |
| ----------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `getUser(role)`                     | `src/config/users.ts`    | Reads `<ROLE>_USERNAME`, `_PASSWORD` and `_DISPLAY_NAME` from env when called, and throws a clear error if one is missing.                                                                                                                                 |
| `AuthApi.signIn(user, baseURL)`     | `src/api/authApi.ts`     | Sends `POST /api/v1/users/signin` with `{username, password}` and returns an `ApiSession` (`user`, `token`, `refreshToken`, `expiresAt`). Throws on a non-2xx status, on `mfaRequired`, or when the tokens are missing. Never puts the password in errors. |
| `ApiSessions`                       | `src/api/apiSessions.ts` | Per-worker cache keyed by **`baseURL` origin + role**. `get()` signs in again within 120 s of the JWT's `exp`, and `renew()` always signs in again.                                                                                                        |
| `storageStateFor(session, baseURL)` | `src/api/apiSessions.ts` | Builds an in-memory storage state: localStorage `token` and `refreshToken` for the origin, with no cookies.                                                                                                                                                |
| `apiSessions` fixture               | `src/fixtures/test.ts`   | Worker-scoped. Holds one `APIRequestContext` (absolute URLs).                                                                                                                                                                                              |
| `loginViaApi` fixture               | `src/fixtures/test.ts`   | `auto`. Yields the `ApiSession` for `userRole`, or `null` with `skipAutoLogin`.                                                                                                                                                                            |
| `storageState` override             | `src/fixtures/test.ts`   | Feeds `storageStateFor(loginViaApi, baseURL)` to the context, so it starts logged in.                                                                                                                                                                      |

App facts:

- The session lives only in localStorage (`token`, `refreshToken`).
- The app generates `clientSessionId` itself (a UUID, sent as `x-client-session-id`), so it's never injected.
- The JWT is valid for 1 hour.
- The API contract is in Swagger: `LoginDto` → `LoginResponseDto` at `https://awesome.byst.re/v3/api-docs`.

## A new test that needs a logged-in user

Nothing to set up: `loginViaApi` is `auto`. Import `test`/`expect` from the
fixtures and open the page directly.

```ts
import { expect, test } from '@/fixtures/test';

test('client sees the products page', async ({ productsPage }) => {
  await productsPage.goto();

  await expect(productsPage.headings.page).toBeVisible();
});
```

- Request `loginViaApi` only when the test needs the user's data, for example `loginViaApi?.user.displayName`. Otherwise Biome flags the unused parameter.
- Open the target page with its page object's `goto()`, not through the dashboard or `/login`.
- Locate with `getByTestId` through page objects, as CLAUDE.md requires.

## A test that must stay logged out

For login form tests and redirect checks:

```ts
test.describe('login form', () => {
  test.use({ skipAutoLogin: true });

  test('visitor is sent to the login form', async ({
    page,
    productsPage,
    loginPage,
  }) => {
    await productsPage.goto();

    await expect(page).toHaveURL(/\/login/);
    await expect(loginPage.form).toBeVisible();
  });
});
```

`skipAutoLogin` is the only way to stay logged out: there is no `userRole: null`. These tests need no credentials. `tests/auth.spec.ts` is the reference.

## A test that logs out or invalidates its token

Tests in one worker share one cached session. Such a test takes the
`apiSessions`, `userRole` and `baseURL` fixtures. As its last step it calls
`await apiSessions.renew(userRole, baseURL)`, or the next test in that worker
gets a dead token.

A test that **mocks a 401** (an expired session) doesn't need `renew`, as
long as the app's refresh never reaches the server. On a 401 the app calls
`POST /api/v1/users/refresh` with the shared refresh token, so mock that too:
`apiErrorMock.rejectSession()` or `respondWithError('tokenRefresh', 401)`.
See the **mock-api-errors** skill.

`baseURL` is typed `string | undefined` but is always set by
`playwright.config.ts`. Narrow it with a check that throws, the way
`requireBaseURL` in `src/fixtures/test.ts` does. Never fall back to `''`.

## A new user role

1. Add the role to `UserRole` in `src/config/users.ts` (for example `'client' | 'admin' | 'warehouse'`). `getUser` derives the variable names from it: `WAREHOUSE_USERNAME`, `WAREHOUSE_PASSWORD`, `WAREHOUSE_DISPLAY_NAME`.
2. Add the three variables to `.env.example` (empty values) and ask the user for the real values for `.env`. Never commit them.
3. For CI, the user adds `<ROLE>_PASSWORD` as a repository **secret** and `<ROLE>_USERNAME` / `<ROLE>_DISPLAY_NAME` as **variables**. Add all three to the Playwright step's `env:` in `.github/workflows/ci.yml`.
4. Use it per file or `describe`: `test.use({ userRole: 'warehouse' })`. The cache keys sessions by role, so nothing else changes.
5. Prove it: copy the first test in `tests/auth.spec.ts` with the new `userRole`. The app should accept the session (no redirect to `/login`, the profile link shows the display name).
6. If the account needs MFA, `AuthApi.signIn` throws `requires MFA`. Supporting `POST /api/v1/users/signin/2fa` is then a new feature, so ask first.
7. Record the role in CLAUDE.md (env variables, what the role sees).

## Playwright MCP: authenticate via the API too

When driving the real app through Playwright MCP, don't fill in the login
form. Sign in over the API, put the tokens in localStorage, and reload.

**Never put the password in MCP tool arguments.** They end up in the
transcript. The MCP code sandbox can't read `.env` either: it has no
`require`, `import` or file system. So the sign-in runs locally:

1. Sign in and generate a one-off login script (role defaults to `client`):

   ```bash
   node .claude/skills/api-login/mcp-login.mjs client
   ```

   It reads `.env`, calls `POST /api/v1/users/signin`, and writes
   `.playwright-mcp/api-login.js` (git-ignored). The script opens `/login`,
   sets `token` and `refreshToken` in localStorage, and reloads.
2. Run it in the MCP browser with `browser_run_code_unsafe` and
   `filename: ".playwright-mcp/api-login.js"`. Success: the reload redirects
   from `/login` to `/` ("Home – Awesome Testing").
3. Delete `.playwright-mcp/api-login.js` straight away.
4. Navigate with `browser_navigate` and read with `browser_evaluate` or
   `browser_snapshot`, preferring `data-testid` selectors.

Caveat: the MCP server echoes the code it ran, so the **tokens** (not the
password) appear in its output. They expire within an hour.

If tokens are already at hand (for example from a test's `loginViaApi`),
`browser_evaluate` on the app's origin does the same:
`() => { localStorage.setItem('token', '…'); localStorage.setItem('refreshToken', '…'); location.reload(); }`.

## Don't

- Don't log in through `LoginPage` to get a session. `loginAs` is only for tests of the login form itself, which run with `skipAutoLogin`.
- Don't write session files (`playwright/.auth`) or add a setup project. Sessions are in memory.
- Don't inject `clientSessionId`. The app creates it.
- Don't record sign-in in HARs. The HAR allowlist excludes it on purpose.
