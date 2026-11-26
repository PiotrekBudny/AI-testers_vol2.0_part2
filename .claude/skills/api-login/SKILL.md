---
name: api-login
description: "How this project authenticates: API login on demand with saved client/admin storageState files. Use when changing authentication, writing tests that need a role or a logged-out browser, adding accounts, testing session invalidation, or driving authenticated pages through Playwright MCP."
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
| `globalSetup` | `global-setup.ts` | Creates a private temporary directory for the run, passes its path to workers, and removes it during teardown. |
| `savedAuthStateFor(role, baseURL)` | `src/api/savedAuthState.ts` | Signs in on demand and saves state once per role and origin. A lock and atomic rename let workers share the file. |
| `storageState` override | `src/fixtures/test.ts` | Selects the saved file for `userRole`, which defaults to client. Each test gets a new context from that file. |

App facts:

- The session lives only in localStorage (`token`, `refreshToken`).
- The app generates `clientSessionId` itself (a UUID, sent as `x-client-session-id`), so it's never injected.
- The JWT is valid for 1 hour.
- A run only needs the credentials used by the selected tests. The saved state is scoped to the run and has no automatic renewal.
- The API returns tokens in JSON, so the fixture saves them in the localStorage part of storageState. Saving only the request context's cookies would not authenticate the browser.
- The API contract is in Swagger: `LoginDto` → `LoginResponseDto` at `https://awesome.byst.re/v3/api-docs`.

## A new test that needs a logged-in user

Nothing to set up: the saved client state is the default. Import `test` from the
fixtures and open the page directly. Assert through page object `expect…`
methods, never `expect()` in the spec (CLAUDE.md).

```ts
import { test } from '@/fixtures/test';

test('client sees the products page', async ({ productsPage }) => {
  await productsPage.goto();

  await productsPage.expectToBeOpen();
});
```

- Use `getUser(userRole)` when a test needs the account's username or display name.
- Select admin with `test.use({ userRole: 'admin' })`; see `tests/adminAuth.spec.ts`.
- Open the target page with its page object's `goto()`, not through the dashboard or `/login`.
- Locate with `getByTestId` through page objects, as CLAUDE.md requires.

## A test that must stay logged out

For login form tests and redirect checks:

```ts
test.describe('login form', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('visitor is sent to the login form', async ({
    productsPage,
    loginPage,
  }) => {
    await productsPage.goto();

    await loginPage.expectToShowLoggedOutForm();
  });
});
```

An explicit empty storageState overrides the role-based file fixture. `tests/auth.spec.ts` is the reference.

## A test that logs out or invalidates its token

Tests of a role share its saved tokens across workers. A test that performs
real logout or invalidates authentication must obtain its own API session
and use it in a separate context, without overwriting the shared file.
Renewing a shared file after logout would not repair contexts already running.

A test that **mocks a 401** (an expired session) can use the saved state, as
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
4. Select the role per file or `describe`: `test.use({ userRole: 'warehouse' })`.
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

If tokens are already at hand (for example from a saved storageState file),
`browser_evaluate` on the app's origin does the same:
`() => { localStorage.setItem('token', '…'); localStorage.setItem('refreshToken', '…'); location.reload(); }`.

## Don't

- Don't log in through `LoginPage` to get a session. `loginAs` is only for tests of the login form itself, which use empty storageState.
- Don't commit session files or add a setup project. Use the existing global setup.
- Don't inject `clientSessionId`. The app creates it.
- Don't record sign-in in HARs. The HAR allowlist excludes it on purpose.
