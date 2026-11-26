---
name: mock-api-errors
description: "How to test negative scenarios by mocking API error responses (4xx/5xx) with ApiErrorMock and broken connections (route.abort, no response) with NetworkErrorMock: a 404 or 500 from product search, a dropped connection with recovery after retries, a 401 from /api/v1/users/me, and any new endpoint or status. Use it when: (1) writing or changing a test where the backend fails (not found, unauthorized, forbidden, server error, service unavailable) or the network fails (offline, connection reset, timeout); (2) adding an endpoint to apiRoutes so it can fail in a test; (3) asserting an error state, a Retry button, a redirect to login or the app's retry/backoff behaviour; (4) exploring through Playwright MCP how the app reacts to a failing endpoint; (5) touching src/mocks/apiErrorMock.ts, src/mocks/networkErrorMock.ts, src/mocks/apiRoutes.ts, tests/productsPageApiErrors.spec.ts or tests/productsPageNetworkErrors.spec.ts. Not for successful fake data (FakeProductSearchMock), recordings (har-to-mock) or patched live responses (LivePatchedProductSearchMock)."
---

# Mock API errors

Negative scenarios never break the real backend. A test makes one endpoint
answer with an error status through `ApiErrorMock` (fixture `apiErrorMock`),
and every other endpoint keeps working, mocked or live.

| Piece | File | Role |
| --- | --- | --- |
| `apiRoutes`, `ApiEndpoint` | `src/mocks/apiRoutes.ts` | The only place with endpoint globs. `ApiEndpoint` is its key type (`productSearch`, `cartItems`, `currentUser`, `tokenRefresh`, `logout`). |
| `ApiErrorMock` | `src/mocks/apiErrorMock.ts` | `respondWithError(endpoint, status, { times?, message? })`, `rejectSession()`, `expectRequestCount(endpoint, n)`, `expectRequestCountToStay(endpoint, n, ms)`, `waitForRequestCount(endpoint, atLeast)`, `requestCount(endpoint)`. |
| `NetworkErrorMock` | `src/mocks/networkErrorMock.ts` | `abort(endpoint, { times?, errorCode? })`, `abortedCount`, `waitForAbortedCount(endpoint, atLeast)`, `expectAbortedCount(endpoint, n)`, `expectAbortedCountToStay(endpoint, n, ms)`. |
| `apiErrorMock`, `networkErrorMock` fixtures | `src/fixtures/test.ts` | Not `auto`. Request them only in tests that need an error. |
| Error states in the UI | `src/pages/productsPage.ts` | `expectLoadError()`, `expectStillLoading()`, `retryLoading()`. |
| Reference specs | `tests/productsPageApiErrors.spec.ts`, `tests/productsPageNetworkErrors.spec.ts`, `tests/productDetailsPage.spec.ts` | Search 404/500, Retry recovery, 401 on `/me`; dropped connection, recovery after 2 aborts; details 404, cart POST 500. |

The error body imitates the backend: `{status, error, message, path, timestamp}`,
where `error` is the reason phrase (`Not Found`). `ApiErrorStatus` lists
the allowed statuses. Add one there (with its reason phrase) when needed.

## Write a negative test

```ts
test('client sees load error when product search returns 404', async ({
  productsPage,
  apiErrorMock,
}) => {
  await apiErrorMock.respondWithError('productSearch', 404);

  await productsPage.goto();

  await productsPage.expectLoadError();
  await apiErrorMock.expectRequestCount('productSearch', 1);
});
```

1. Register the error **before** the navigation or action that calls the endpoint.
2. Assert the UI through page object `expect…` methods and the traffic through `apiErrorMock.expectRequestCount`. No `expect()` in specs.
3. Put negative tests in a separate spec per page: `tests/<page>ApiErrors.spec.ts`.

## Fail once, then recover

`{ times: 1 }` removes the error route after one request. Playwright tries
the most recently registered route first, so a mock fixture that registered
earlier (for example `fakeProductSearchMock`) serves the next request:

```ts
await apiErrorMock.respondWithError('productSearch', 404, { times: 1 });
await productsPage.goto();
await productsPage.expectLoadError();
await productsPage.retryLoading();
await productsPage.expectToShowProducts(fakeProductSearchMock.products);
```

Without a fallback mock the next request goes to the real API.

## Network errors: no response at all

An HTTP error status still produces a response. A broken connection
doesn't: `NetworkErrorMock.abort()` calls `route.abort(errorCode)`, so the
request ends in `requestfailed` and **no response ever arrives**.

- **Never wait for a response of an aborted request.** `page.waitForResponse`
  hangs until the timeout, and `HarReplayMock.waitForReplayedResponse`
  fails at once, because it treats any `requestfailed` as a missing
  recording entry. Assert the UI and `networkErrorMock`'s attempt counts.
- `errorCode` defaults to `failed`. The `requestfailed` error text follows
  the code: `failed` gives `net::ERR_FAILED`, `internetdisconnected` gives
  `net::ERR_INTERNET_DISCONNECTED`. The UI was verified with `failed` (MCP)
  and `internetdisconnected` (the specs), and it's the same for both.
- Check the loading state right after the **first** abort (the next try
  comes about 1 s later). Later backoff gaps are timing-dependent on a
  slow runner.
- Put these tests in `tests/<page>NetworkErrors.spec.ts`.

```ts
test('client sees load error when the connection drops', async ({
  productsPage,
  networkErrorMock,
}) => {
  await networkErrorMock.abort('productSearch', {
    errorCode: 'internetdisconnected',
  });

  await productsPage.goto();

  await networkErrorMock.waitForAbortedCount('productSearch', 1);
  await productsPage.expectStillLoading();
  await productsPage.expectLoadError();
  await networkErrorMock.expectAbortedCountToStay('productSearch', 4, 1_500);
});
```

### Retry policy: fail N times, then recover

Register the serving route **first**, then the abort with `times`. After N
aborted attempts the abort route is removed, and the next retry reaches
the serving route:

```ts
const recording = await harReplayMock.serve('productSearch');
const recorded = singleEntry(recording).body as ProductSearchResponse;
await networkErrorMock.abort('productSearch', { times: 2 });

await productsPage.goto();

await productsPage.expectToShowProducts(recorded.content);
await networkErrorMock.expectAbortedCountToStay('productSearch', 2, 1_500);
```

The recording's URL matches every retry, because they all request
`?page=0&size=12`. A fake mock fixture (`fakeProductSearchMock`) works as
the serving route too.

## 401 rule: never let a 401 reach the real refresh

On a 401 the app calls `POST /api/v1/users/refresh` with the worker's
**shared** refresh token. A real refresh could rotate it and break the
next test in that worker (see the api-login skill). So:

- For a 401 on any endpoint, mock `tokenRefresh` (and `logout`) too. `rejectSession()`
  does all three for `/me`; the test asserts `expectRequestCount('logout', 0)`.
- A 401 test may clear the context's localStorage, which is harmless: each
  test gets a new context from the cached session. It must not call the
  real logout. If it does, follow the api-login `renew` rule.

## App behaviour (verified through Playwright MCP)

- **Search 404**: one request and no retries. The list area shows
  `error-message` (`<p role="alert">`, "Error loading products") and
  `product-list-retry` ("Retry"). `products-count-summary` stays "Searching
  the catalogue". No list, no pagination, no in-stock count.
- **Search 500**: the app retries with backoff, sending 4 requests at about
  0 s, 1 s, 3 s and 7 s. Until then `product-list-loading` reads "Loading
  products...". After the last one it shows the same error state as a 404.
  `expectLoadError()` waits up to `SEARCH_RETRY_WINDOW_MS` (15 s) for it.
- **Search with a dropped connection** (`route.abort`): identical to a 500
  in the UI and in timing (4 attempts at about 0/1/3/7 s, then the same
  error state). The traffic differs: `requestfailed` (`net::ERR_FAILED`
  for the default code; the text depends on `errorCode`) and no response. So the app retries 5xx and network
  failures, but not 4xx.
- **Retry** starts a full new cycle (up to 4 attempts with the same
  backoff). When one succeeds, the cards render and the error disappears.
- **Details 404** (`productDetails`, a RegExp route): one request, no
  retries. Only `product-not-found` (`role="alert"`) renders, with h1
  "Product not found", "This product does not exist or may have been
  removed." and "Back to Products". The title is `Product not found –
  Awesome Testing`. `ProductDetailsPage.expectNotFound()`.
- **Cart POST 500** (`cartItems`): one POST, no retry. Toast `Error` /
  "Failed to update cart. Please try again.". "Add to Cart" is enabled
  again and the quantity is kept. Use `apiErrorMock` *instead of*
  `cartMock` for that endpoint.
- **`/me` 401** (opening `/products`): `users/me` → `POST users/refresh`
  (mocked 401) → the app clears `token` and `refreshToken` and lands on
  `/login` (without `returnTo`). There's no toast and no logout request.
  `/cart` is still called once with the old token.

## Explore a new error through Playwright MCP

1. Log in with the api-login skill (`mcp-login.mjs`, run the script, delete it).
2. Use `browser_run_code_unsafe` with `page.route(glob, route => route.fulfill({ status, json }))`,
   navigate, wait, and read `data-testid`s, `[role="alert"]` elements, the URL
   and the request timings from a `page.on('request')` listener.
3. **Always `await page.unrouteAll()` at the end.** Routes outlive the
   snippet, and a leftover `/me` 401 logs every later login out.
4. When mocking a 401, mock `**/api/v1/users/refresh` too (see the 401 rule).
5. Write the findings into this skill and the facts into CLAUDE.md, then add
   page object methods and the test.

## Add an endpoint

1. Add its glob to `apiRoutes` (`'**/api/v1/...'`, with a trailing `**` when
   it has a query string). Never write a glob inline in a mock or test.
2. Explore its error behaviour through MCP (above).
3. Add `expect…` methods to the page object that owns the error UI.
4. If a HAR should record it, add it to `harUrlFilter` in the fixtures.
