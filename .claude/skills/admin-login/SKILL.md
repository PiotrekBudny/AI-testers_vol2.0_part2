---
name: admin-login
description: "How to act as the admin user (ROLE_ADMIN) on aitesters.byst.re: logging in via the API, writing admin tests, calling admin-only endpoints, and the rules for changing live data. Use it when: (1) writing or changing a test that needs admin privileges, such as the /admin pages (dashboard, products, orders, inventory, coupons, reviews, returns, purchasing, gift cards, VAT rates, currencies, payments, webhooks), /warehouse, or the admin-only menu links; (2) a test must create, change or delete shop data (products, orders, coupons, inventory, users) or set up data through an admin endpoint; (3) driving the app as admin through Playwright MCP, for example to check something only an admin can see; (4) adding admin page objects or an admin API helper; (5) an API call returns 403 for the client account. Builds on the api-login skill (loginViaApi, mcp-login.mjs); read that for the general login mechanics."
---

# Admin login

The admin account logs in exactly like the client: over the API, never through
the login form (see the **api-login** skill). What's different is what it can
see and change, and what it may change on the **shared live shop**.

## Verified facts (2026-11-26)

- **Credentials:** `ADMIN_USERNAME`, `ADMIN_PASSWORD` and `ADMIN_DISPLAY_NAME` in `.env`. On CI, `ADMIN_PASSWORD` is a repository secret and the other two are variables. `.github/workflows/ci.yml` already passes all three. Never print them or put them in tool arguments.
- **API sign-in:** `POST /api/v1/users/signin` returns 200 with `roles: ["ROLE_ADMIN"]`, `mfaRequired: false` and both tokens. `GET /api/v1/users/me` confirms `ROLE_ADMIN`. The navigation's `username-profile-link` shows `ADMIN_DISPLAY_NAME`.
- **Extra UI for admins**, compared with the client:
  - Menu links `desktop-menu-warehouse` (`/warehouse`) and `desktop-menu-admin` (`/admin`).
  - On the home page, an extra `home-users-button`.
- **`/admin`** ("Admin Dashboard – Awesome Testing", root `admin-dashboard-page`):
  - Section tabs `admin-section-<overview|products|orders|inventory|coupons|reviews|returns|purchasing>`, linking to `/admin/<section>` (overview is `/admin`).
  - Metric cards `admin-dashboard-<products|orders|pending>-card` with `-count`, plus `admin-dashboard-revenue-amount`.
  - Recent orders `admin-dashboard-order-<id>`, with `-id-`, `-date-`, `-amount-` and `-status-<id>` variants.
  - Low stock `admin-dashboard-low-stock` / `admin-dashboard-no-low-stock`.
  - Settings links `admin-dashboard-<gift-cards|vat-rates|currencies|payments|webhooks>-link`, to `/admin/gift-cards`, `/admin/vat-rates`, `/admin/currencies`, `/admin/payments` and `/admin/webhooks`.
  - Order ids in test ids are generated data: reach orders by position or through a stable parent, never hard-code `-12`.
- **API access** (GET, client vs admin): `/api/v1/admin/coupons`, `/api/v1/admin/inventory` and `/api/v1/orders/admin` return client **403**, admin 200. `/api/v1/users` returns 200 for **both**, even though Swagger calls it admin-only.
- **Admin-only areas in Swagger:**
  - Everything under `/api/v1/admin/*`.
  - `POST /api/v1/products`, plus `PUT` and `DELETE /api/v1/products/{id}`.
  - `PUT /api/v1/orders/{id}/status` and `GET /api/v1/orders/admin`.
  - `PUT` and `DELETE /api/v1/users/{username}`.
  - Payment service: `GET /api/v1/admin/payments`. Warehouse service: `/api/v1/admin/{suppliers,purchase-orders,returns}`.
  - Check the exact contract before using an endpoint: `curl -s https://awesome.byst.re/v3/api-docs` (main), `/payment/v3/api-docs` and `/warehouse/v3/api-docs`.

Not mapped in code yet: `NavigationBar` has no `warehouse`/`admin` links, and
there's no admin page object. Add them when a test first needs them (see below).

## Writing admin tests

- One file per area: **`tests/admin<Area>.spec.ts`**, for example `adminDashboard.spec.ts` or `adminProducts.spec.ts`. Set the role once at the top, and never mix client and admin tests in one file. The example assumes an `AdminDashboardPage` with its fixture, which doesn't exist yet (see Page objects below):

  ```ts
  import { expect, test } from '../src/fixtures/test';

  test.use({ userRole: 'admin' });

  test('admin sees the admin dashboard', async ({ adminDashboardPage }) => {
    await adminDashboardPage.goto();

    await expect(adminDashboardPage.headings.title).toHaveText('Admin Dashboard');
  });
  ```

- `loginViaApi` then signs in as admin (cached per worker, per role, separately from the client) and yields `loginViaApi.user` with the admin's `displayName`.
- The first admin test should also prove the session: no redirect to `/login`, and `navigation.links.profile` shows `ADMIN_DISPLAY_NAME`. That's the admin twin of `tests/auth.spec.ts`.
- **Page objects:** follow CLAUDE.md.
  - Add `src/pages/adminDashboardPage.ts` (`readonly url = '/admin'`, extends `BasePage`, `getByTestId` locators grouped as `headings`, `sectionLinks`, `metrics` and so on) and its fixture in `src/fixtures/test.ts`.
  - Admin sub-pages get their own classes (`AdminProductsPage`, `/admin/products`, …).
  - Add `warehouse` and `admin` to `NavigationBar.menuLinks`. They're visible only for admins.
- **Mocks:** reads on admin pages can use the fake or recorded mocks like any page. Record admin endpoints with the **har-to-mock** skill using `--role admin`, and replay them in an admin spec, since `serve()` checks the role.

## Calling admin endpoints from a test (setup and cleanup)

Use Playwright's `request` fixture with the admin token from `loginViaApi`. Its
`baseURL` matches the browser's:

```ts
const headers = { authorization: `Bearer ${loginViaApi?.token}` };
const response = await request.post('/api/v1/products', { headers, data: product });
expect(response.ok()).toBe(true);
```

Check the success status and the request body in Swagger before asserting
an exact code. No admin write has been exercised from a test yet.

When a second test needs the same calls, move them into an API class next to
`AuthApi` (for example `src/api/adminProductsApi.ts`), constructed with the
`APIRequestContext` and the session. Model types go in `src/models/`.

## Live writes: rules (decided by the user)

Admin tests **may** create, change and delete data on the live shop, but only
data they create themselves:

1. **Unique, recognisable names:** every created object gets a prefix like `e2e-${Date.now()}-${random}` in its name, code or title. Never reuse fixed names, because parallel workers and other people share the shop.
2. **Create first, then act on your own object.** To test editing or deleting a product, create one via the API in setup, then edit or delete *that* one. **Never modify or delete pre-existing data** (seed products, other users' orders, existing coupons, real accounts).
3. **Always clean up**, also when the test fails: delete what was created in a fixture teardown, or in `test.afterEach` with the ids collected during the test. Prefer the API for cleanup, even when the test created the object through the UI.
4. **If it can't be undone, ask the user first.** That includes:
   - `POST /api/v1/email` (sends real email)
   - user deletion and `right-to-be-forgotten`
   - gift cards (can only be disabled)
   - order status changes and cancellation
   - payments and refunds
   - webhook tests and redeliveries
   - CSV product import
   - VAT rate and currency changes, which affect every visitor's prices
5. Mind the readers of live data: a live product created by an admin test can show up in `productsPageLive` for a moment. That spec compares against the real response, so it stays correct, but don't write tests that assume a fixed live product count.

## Playwright MCP as admin

1. `node .claude/skills/api-login/mcp-login.mjs admin`, then `browser_run_code_unsafe` with `filename: ".playwright-mcp/api-login.js"`, then delete that file (full procedure in the api-login skill). Success: the reload lands on `/` and `username-profile-link` shows the admin's display name.
2. **Reading is free:** browse `/admin/*` and `/warehouse`, inspect with `browser_evaluate` / `browser_snapshot`, preferring `data-testid`.
3. **Every write needs the user's explicit OK first:** a form submit, a delete button, a status change, issuing a gift card, a direct admin API call. Say what will change and wait. When approved, follow the live-write rules above (your own prefixed data, cleaned up afterwards).
4. The client session in the same MCP browser is replaced by the admin one. Run `mcp-login.mjs client` to switch back.

## Don't

- Don't log in as admin through the login form, and don't store an admin session file.
- Don't use the admin account for tests that a client can do: admin specs are only for admin-only behaviour.
- Don't hard-code generated ids (order `-12`, product ids of created data) in locators or assertions.
- Don't leave created data behind, and don't touch data you didn't create.
