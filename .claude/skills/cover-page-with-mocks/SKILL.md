---
name: cover-page-with-mocks
description: "End-to-end workflow for covering a new page of aitesters.byst.re with mock-driven Playwright tests: read the OpenAPI spec, explore the live page safely through Playwright MCP (API login, every write blocked or mocked), record the facts, then build models, apiRoutes entries, a stateful mock that composes the existing ones, page objects, fixtures, a feature tag and the scenario set (happy path, validation, loading, empty state, conflict, server failure, network failure). Use it when: (1) the user asks to cover, test or plan tests for a page or view that has no specs yet (for example /checkout, /profile, /orders, /wishlist); (2) adding a stateful fake for a new backend area (orders, wishlist, reviews) that must build on CartMock or another mock; (3) exploring a page whose actions write data, where nothing may reach the real backend. Builds on api-login (MCP login), mock-api-errors (ApiErrorMock, NetworkErrorMock) and the conventions in CLAUDE.md. Not for refreshing a recording (har-to-mock) or for admin pages that need real writes (admin-login)."
---

# Cover a page with mocks

The live shop is shared and **read-only for us**: exploring and testing a page
must never create an order, change the real cart or write anything else. The
reference result of this workflow is `/checkout` (`src/mocks/checkoutMock.ts`,
`src/pages/checkoutPage.ts`, `tests/checkoutPage*.spec.ts`). Read those
alongside this procedure.

## 1. Read what exists first

- CLAUDE.md: "Page objects" (rules: no assertions in specs, `data-testid`,
  locator groups), "App facts" for neighbouring pages and "Mocking
  conventions".
- `src/api/endpoints.ts` (endpoints), `src/fixtures/mocks.ts` and `pages.ts` (fixtures
  and their dependencies) and the mocks the page will need. List what can be
  reused before planning anything new: product data
  (`FakeProductSearchMock`, `FakeProductDetailsMock`), the cart
  (`CartMock`: `seed`, `cart()`, `lines()`, `clear()`, `holdResponses()`,
  `holdReads()`), holds (`ResponseHold`), failures (`ApiErrorMock`,
  `NetworkErrorMock`) and settling (`expectToStay`).

## 2. Read the API spec

```bash
S=<scratchpad>/spec; mkdir -p "$S"
curl -s https://awesome.byst.re/v3/api-docs -o "$S/main.json"
curl -s https://awesome.byst.re/payment/v3/api-docs -o "$S/payment.json"
curl -s https://awesome.byst.re/warehouse/v3/api-docs -o "$S/warehouse.json"
```

Filter paths and print operations with `node -e` (`require` the JSON, walk
`paths`, print `summary`, `description`, parameters, request body and every
response code). Then print the `components.schemas` the page uses. Note for
each endpoint: status codes and what they mean, error body shapes
(`ErrorDto` `{message}` vs `ValidationErrorsDto` keyed by field), validation
patterns and lengths, headers (for example `Idempotency-Key`).

## 3. Explore the live page safely (Playwright MCP)

1. Sign in over the API (never the form):
   `node .claude/skills/api-login/mcp-login.mjs client`, run
   `.playwright-mcp/api-login.js` with `browser_run_code_unsafe`
   (`filename`), then delete the script.
2. **Before navigating to the page**, install the safety net:
   `browser_run_code_unsafe` with
   `filename: ".claude/skills/cover-page-with-mocks/mcp-safety-net.js"`. Every
   non-GET `/api/**` call then gets 418 and is logged in `page.__blocked`.
   Routes registered later win, so a fake you add afterwards still handles
   its own write before the net does.
3. Fake the reads the page needs with `page.route` (for example `GET /cart`
   with real product ids from a `GET` search), because the shared account's
   real data is usually empty. Fake each write you want to see succeed or
   fail with `route.fulfill`. Never `fallback` a write to the server.
4. State between calls: each `browser_run_code_unsafe` call runs in its own
   scope, so `globalThis` is **not** shared. Keep state on `page`
   (`page.__state = {...}`), which persists.
5. Map the page:
   - Dump test ids with `browser_evaluate`
     (`[...document.querySelectorAll('main [data-testid]')]` with tag,
     attributes, `innerText`, input `value`). Look for **duplicated** ids
     and ids with entity ids in them (`checkout-item-{id}`).
   - Record every API request on load and after each action
     (`browser_network_requests` with `filter: "/api/"`).
   - Validation: empty submit, whitespace-only, malformed values; check
     error texts, `aria-invalid` and that nothing was sent.
   - Pending states: make the fake wait on a promise stored on `page`,
     read the UI, try forced clicks and `dispatchEvent`, then release.
   - Failures: for each write, serve 400 (both body shapes), 404, 409,
     500 and 503 with a **distinctive `message`**, and `route.abort()`.
     Note whether the UI shows the backend message or its own text, where
     it shows it (toast or inline `role="alert"`), whether it retries and
     what happens on a second submit (same idempotency key?).
   - Empty state and redirects: serve an empty read.
6. Check the result of the session: `page.__blocked` lists anything the
   net stopped. Close the browser when done.

## 4. Record the facts

Write what you learned into CLAUDE.md ("App facts for page objects") before
or with the code: URLs and titles, requests on load, test ids (and the
duplicated ones to avoid), exact texts, validation rules, retry behaviour,
and traps (for example an endpoint that reads the real backend state).

## 5. Build

- **Types** from the spec in `src/models/<area>.ts`, only the fields the app
  reads, with `| null` for nullable ones.
- **Endpoints** in `apiPaths`/`apiRoutes` (RegExp when a glob could match a
  sibling path). Each key is automatically an `ApiEndpoint`, so
  `ApiErrorMock` and `NetworkErrorMock` can fail it with no change.
- **Stateful mock** `src/mocks/<area>Mock.ts`:
  - Compose, don't duplicate: take the mocks it builds on as constructor
    arguments (fixture dependencies) and use only their public methods.
    Never route an endpoint another mock already owns. If something is
    missing, add a small public method to the owning mock (as `lines()` and
    `clear()` were added to `CartMock` for checkout).
  - Imitate the backend's side effects (an order empties the cart) and its
    business errors (409 from a `limitStock`-style setter), and log what it
    received.
  - Use `ResponseHold` for pending states and release it in fixture
    teardown.
  - Expose `waitFor…()` methods that poll and return served values, so
    specs never recompute what the mock decided, plus `expect…` methods
    and `expect…ToStay(n, ms)` for "nothing (more) was sent".
- **Page objects and components** following the CLAUDE.md rules
  (`BasePage`, `url`/`title`, grouped `Locators<…>`, shared key types such
  as `AddressField`, messages as constants in the page object).
- **Fixtures** in `src/fixtures/pages.ts` (page objects) and `src/fixtures/mocks.ts` (mocks; claim the endpoints with `endpointOwners`).
- **Tag**: a new feature in `featureTags` (`src/config/testTags.ts`)
  gets its project automatically; add a `test:<feature>` script to
  `package.json`. Tests also get `@mocked`, plus `@negative` / `@network`
  where they apply.

## 6. Scenario checklist

| Scenario | How |
| --- | --- |
| Happy path | Seed the data, check the page, act, check the next page and the mock's state (`expectPlacedOrder`, `expectCartItems([])`). |
| Client validation | Empty, whitespace-only and malformed input; field errors and `aria-invalid`; `expectReceivedOrdersToStay(0, NO_MORE_REQUESTS_WINDOW_MS)`. |
| Server validation | A one-off 400 with a field-keyed body from the mock. |
| Loading | Hold the page's read (`cartMock.holdReads()`) and the write (`mock.holdResponses()`); assert the loading or pending UI, then release. |
| Empty state | The default empty mock; assert the redirect or empty UI. |
| Conflict | A business rule in the mock (409) and the state kept. |
| Server failure | `apiErrorMock.respondWithError(endpoint, 500, { message })`, the message shown, `expectRequestCountToStay(endpoint, 1, …)` (no retry). |
| Network failure | `networkErrorMock.abort(endpoint, { times: 1 })`, the generic error, then a retry that succeeds; check idempotency where the API has it. |

## 7. Rules while writing tests

- No `expect` in specs, no `if`/`throw` in specs.
- **No hard waits**: holds for pending states, `expect.poll` / web-first
  assertions for state, and `expectToStay` with `NO_MORE_REQUESTS_WINDOW_MS`
  for "nothing more sent". Never `waitForTimeout` in specs or page objects.
- A test that triggers a write must request the mock that serves it (or make
  the endpoint fail through `apiErrorMock` / `networkErrorMock`).

## 8. Verify

1. `npm run typecheck` and `npm run check`.
2. `npx playwright test --project=<feature> --repeat-each=5` (flakiness).
3. `CI=1 npx playwright test --project=<feature>`.
4. Safety: scan the tests' `network.har` files from a local run (none are
   written on CI) and tabulate each endpoint in three groups. "No `cf-ray`"
   alone doesn't mean mocked, because a request with no response has no
   headers at all:
   - **real**: has a `cf-ray` header
   - **no response**: status 0 or below. Allowed only for an abort the
     test caused on purpose (`networkErrorMock`, `loseNextResponse`).
   - **mocked**: has a status and only `content-type` and
     `content-length` headers (or none, for a 204)

   Every write and every faked read must be mocked. `users/me` and
   `currencies` show as real, which proves the check can see real
   traffic. Add the endpoint to `harUrlFilter` first if it isn't recorded.
5. `npm test`, and update the verified counts in CLAUDE.md.
