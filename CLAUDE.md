# Project rules

## Keep this file current

This file is the single source of project knowledge. Whenever a change
affects anything described here (structure, tooling, config, conventions,
API facts, open questions), update this file in the same commit as the change
(or use a separate `docs` commit). When an open question gets answered, move
the answer into the relevant section.

## Project overview

Playwright + TypeScript end-to-end tests for the shop at
<https://aitesters.byst.re>, driven by mocked backend responses
(`page.route`). Current scope: the **product list** only.

- API docs (Swagger UI): <https://awesome.byst.re/swagger-ui/index.html>;
  raw spec at `https://awesome.byst.re/v3/api-docs` (fetch with `curl`).
  Payment and warehouse services have separate specs under
  `/payment/v3/api-docs` and `/warehouse/v3/api-docs`.
- Credentials are never committed; they go in `.env` (git-ignored). Ask the
  user for them when needed.

## Layout

```
src/
  builders/productSearchResponseBuilder.ts  full search response (paging + facets)
  components/footer.ts                      Footer (shared on every view)
  components/navigationBar.ts               NavigationBar (top menu, logged out and in)
  components/productCard.ts                 ProductCard (one product-item in the list)
  components/toast.ts                       Toast (notification viewport)
  config/users.ts                           getUser('client' | 'admin') from env
  enums/productCategory.ts                  ProductCategory enum
  enums/productSortOption.ts                sort <select> option values in the UI
  generators/productGenerator.ts            faker-based Product generator
  models/product.ts                         Product (one search hit)
  models/productSearchResponse.ts           response, facets, price range types
  pages/basePage.ts                         abstract BasePage (url, goto, shared components)
  pages/dashboardPage.ts                    DashboardPage (/ after login)
  pages/loginPage.ts                        LoginPage page object (/login)
  pages/productsPage.ts                     ProductsPage (/products)
  fixtures/test.ts                          test/expect with page object + mock fixtures
  mocks/productSearchMock.ts                route mock for GET /api/v1/products/search
  types/locators.ts                         Locators<K> type for locator groups
tests/                                      Playwright specs (testDir)
  productsPage.spec.ts                      all mocked products shown on /products
playwright.config.ts
```

Imports between `src/` files are relative and extensionless.

## Rule: no comments in code

- Don't write comments (`//`, `/* */`, `/** */`) in source, test or config
  files. Make the code say it through names and types instead.
- Knowledge that would have gone into a comment (app behaviour, API quirks,
  reasons for a choice) goes into this file.

## Tooling and commands

- Node `24.15.0` and npm `11.12.1`, pinned in `.nvmrc` and `engines` with
  `engine-strict=true`. Never bypass nvm or engine checks.
- `.npmrc` has `save-exact=true`: every dependency is pinned to an exact
  version, with no `^` or `~`.
- `npm test` runs Playwright, `npm run typecheck` runs `tsc --noEmit`,
  `npm run check` runs `biome check --write --unsafe`, and `npm run format`
  runs `biome format --write`.
- Biome 2: 2-space indent, single quotes, recommended rules (for example, it
  forbids classes with only static members, so use instance methods).
- The Husky pre-commit hook runs `lint-staged` (Biome on staged
  `ts/js/json/md`), then `typecheck`, then the full `npm test`.
- CI (`.github/workflows/ci.yml`) runs on push/PR to `main`: `biome ci .` and
  typecheck, then Playwright on Chromium, and uploads `playwright-report/`.
- `tsconfig.json` is type-check only: `module: nodenext`, `types: ["node"]`,
  `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `.gitattributes` forces LF line endings.
- `package.json` has `"type": "commonjs"` and `"private": true`.
- `.mcp.json` registers the Playwright MCP server (`@playwright/mcp@latest`,
  deliberately unpinned as a dev-only tool, launched via `cmd /c npx` because
  of Windows) for exploring the live UI from Claude Code. Claude Code asks
  each user to approve project MCP servers on first use. The server writes
  snapshots and console logs to `.playwright-mcp/` (git-ignored).
- `.claude/settings.json` holds a shared allowlist of read-only commands.

## Playwright config

- `dotenv` loads `.env` (`quiet: true`). `.env.example` (committed) lists
  the variables: `BASE_URL`, then `CLIENT_USERNAME`, `CLIENT_PASSWORD`,
  `CLIENT_DISPLAY_NAME` and the same three `ADMIN_*` variables (a regular
  customer account and an admin account). The real values go in `.env`
  (git-ignored).
- `getUser(role)` in `src/config/users.ts` reads the account variables when
  called, not at import. It throws a clear error if one is missing, so
  specs that never log in run without them (CI has none set). Use
  `loginPage.loginAs(getUser('client'))`.
- `baseURL` is `process.env.BASE_URL`, falling back to `https://aitesters.byst.re`.
- On CI: `retries: 2`, `forbidOnly`, and the `html` reporter. Locally:
  `list` plus `html` with `open: 'never'`, because an auto-opened report
  would block the pre-commit hook.
- `trace: 'on-first-retry'`. The single project is `mockingTests` (Desktop Chrome).

## API facts: `GET /api/v1/products/search`

- Requires a bearer token (`401` without one). This doesn't matter for
  mocked tests.
- Query parameters: `q`, `category` (repeatable or comma-separated),
  `minPrice`, `maxPrice`, `minRating` (1-5), `inStock`, `sort`
  (`relevance|newest|price_asc|price_desc|name_asc|rating_desc`), `page`
  (0-based), `size` (1-100, **API default 20; the frontend requests 12**).
  Invalid parameters produce a `400` keyed by parameter name.
- Default sort: `newest` without `q`, `relevance` with `q`.
- Response: `content`, `pageNumber`, `pageSize`, `totalElements`,
  `totalPages`, `facets`.
- Product fields: `id`, `name`, `description`, `price`, `stockQuantity`,
  `category` (any string in the spec), `imageUrl` (nullable),
  `createdAt`/`updatedAt` (server-local, no offset, microseconds, for example
  `2026-11-25T03:01:09.271445`), `averageRating` (nullable; average of
  approved reviews rounded half-up to 1 decimal; null without reviews),
  `reviewCount`.
- Facets cover products matching every filter **except category**:
  - `categories`: `{value, count}`, sorted by count descending, then by value.
  - `priceRange`: `{min, max}`, both `null` when nothing matches.
  - `inStockCount`: products with stock above zero.
- Known categories (seed data): Electronics, Audio, Books, Computers, Gaming,
  Home & Kitchen, Wearables.
- Known image paths: `/images/{iphone,samsung,mac,ps5,ninja,cleancode,applewatch,sony}.png`.

## Page objects

- One class per view in `src/pages/`, constructed with `new XPage(page)`,
  exposing `readonly` locators plus action methods (`login`).
- Every page extends the abstract `BasePage`. It holds `page`, the shared
  components and `goto()`, which opens `this.url`.
- Each page declares its exact URL path in its own class:
  `readonly url = '/login'`. Paths are relative to `baseURL`, so
  `BASE_URL` still picks the environment. Don't override `goto()` per page.
- Parts shared across views (navigation, footer, toasts) live in
  `src/components/`, each scoped to its root test id. `BasePage` creates
  them, so every page has `.navigation`, `.footer` and `.toast`.
- Tests get page objects through Playwright fixtures: import `test` and
  `expect` from `src/fixtures/test.ts`, not from `@playwright/test`, and
  take `loginPage`, `dashboardPage`, `productsPage` as test arguments. Every
  new page object gets a fixture there.

### Rule: prefer `data-testid` locators

- Always locate with `page.getByTestId(...)` when the element has a
  `data-testid`. The app has stable test ids on practically every element
  (for example `login-username-input`, `login-submit-button`).
- Only without a test id, fall back to `getByRole` / `getByLabel` /
  `getByText`, in that order.
- Never use CSS classes (they're hashed or Tailwind utilities) or XPath.
- Scope a component's locators to its root (`this.root.getByTestId(...)`).
- Don't use generated ids (for example `toast-<timestamp>-<random>`). Reach
  the element through a stable parent instead.

### Rule: group locators of the same kind

- When a page object has more than one locator of the same kind, put them
  in a named group instead of separate fields: `buttons`, `links`,
  `inputs`, `selects`, `errors`, `headings`, `texts`, or a more specific
  name when it reads better (`menuLinks`, `features`). Keys are short
  camelCase names without the kind suffix: `buttons.signIn`, not
  `signInButton`.
- A single locator of its kind stays a plain field (`form`, `root`,
  `userEmail`, `closeButton`).
- Type groups with `Locators<'a' | 'b'>` from `src/types/locators.ts` and
  assign them in the constructor. Field initializers can't use `this.page`
  (TS2729, because of parameter properties), and the declared keys make
  TypeScript flag missing or misspelled entries.
- When two groups share keys (one card and one button per feature), define a
  key type once (`type Feature = ...`) and reuse it.

### App facts for page objects

- Toasts render in `toast-viewport`. Each toast `li` has a generated id
  (`toast-<timestamp>-<random>`), so use `toast-title`/`toast-description`
  inside the viewport.
- Login form: an empty submit shows `Username is required` / `Password is
  required` and sets `aria-invalid`. Wrong credentials make
  `POST /api/v1/users/signin` return `422`, with the toast `Error` /
  `Invalid username/password`.
- After a successful login the app lands on `/` ("Home – Awesome Testing",
  test ids `home-*`), modelled as `DashboardPage`. The page load calls
  `GET /api/v1/users/me`, `/api/v1/cart` and `/api/v1/currencies`. The
  display name is the navigation's `username-profile-link`. The heading
  shows only the first name (`Welcome, Alice!`).
- Navigation: `links.login`/`links.register` show only when logged out.
  `links.cart`, `links.profile` (leads to `/profile`), `menuLinks`,
  `selects` and `buttons` show only when logged in. It's mapped for the
  desktop layout as a client; admins may see more links.
- Products page (`/products`, "Products – Awesome Testing"), modelled as
  `ProductsPage`:
  - Every product card repeats the same test ids (`product-item`,
    `product-name`, …), with no id in them. `ProductCard` is scoped to one
    card. Get one with `productsPage.product(name)` (exact name match) or
    `productsPage.productAt(index)`.
  - Category test ids use a slug of the name: lowercase, spaces become `-`,
    `&` is kept (`products-category-home-&-kitchen`,
    `products-category-count-home-&-kitchen`). Use `categoryCheckbox(cat)` /
    `categoryCount(cat)` with the `ProductCategory` enum.
  - The sort `<select>` uses hyphens (`price-asc`), while the API's `sort`
    parameter uses underscores (`price_asc`). `ProductSortOption` holds the
    UI values.
  - The URL's `?page=` is 1-based (`?page=2` is the second page), while the
    API's `page` is 0-based. Pagination (`product-pagination-prev/-status/-next`,
    status `Page 2 of 3`) only renders when there is more than one page.
  - An out-of-stock card shows `product-out-of-stock` ("Out of stock"), has
    no quantity controls, and its Add to Cart button is disabled.
  - Rated products show `★ 4.5 (2)` in `product-rating`, unrated ones
    `No reviews yet`.
  - `ProductCard.expectToShow(product)` checks a card against a `Product`:
    name, link `/products/{id}`, description, price, category, rating,
    image `alt`/`src` (`src` only when `imageUrl` isn't null), and stock
    state.
  - `ProductsPage.expectToShowProducts(products)` checks the card count,
    then each card in order by position (`productAt`), so duplicate
    generated names don't matter. Cards show in the order the mock serves.
  - `tests/productsPage.spec.ts` checks 12 unseeded generated products.
    It passed 10 repeated runs (120 random products):
    - Prices use `en-US` USD formatting (`$1,299.99`). Confirmed, since
      about half the generated prices are over $1,000.
    - Ratings with one decimal for whole numbers (`★ 4.0 (3)`) and the
      out-of-stock state are rare in random data, so they may not have
      come up.
  - With no results: `product-search-summary` reads `No matching products`,
    and `no-products-message` and `reset-search-button` ("Clear filters")
    appear. `clear-search` (✕) shows inside the search box once it has text.
  - When the search request returns `500`, the list stays on
    `product-list-loading` ("Loading products...") for at least 2 s,
    probably while the app retries. No error state has been seen.
  - The "WebMCP · Agent interface" panel (`shop-tool-*`) on the page isn't
    modelled.
  - `ProductSearchResponseBuilder` output renders correctly on this page
    (checked with a throwaway mocked test).

## Mocking conventions

- **`ProductGenerator`** (`new ProductGenerator(seed?)`) has its own Faker
  instance; a seed makes the data reproducible (dates are still relative to
  today).
  - `generateProduct(overrides)`: fields that depend on each other are
    derived _after_ overrides are applied:
    - `reviewCount: 0` gives a null rating, and `averageRating: null` gives
      0 reviews.
    - `updatedAt` is never earlier than `createdAt`.
    - The rating is the average of generated 1-5 star reviews.
    - `imageUrl` is picked from the known server images.
  - `generateProducts(count, overrides)` gives ids `count..1`, sorted
    newest-first by `createdAt`; `id` cannot be overridden.
- Tests log in for real. Only the product search endpoint is mocked.
- **`loggedInUser`** is an `auto` fixture, so it runs before every test
  without being requested. It logs in through `LoginPage` as
  `getUser(userRole)` and waits until the navigation's profile link shows
  the display name. A test then opens its page directly with `goto()`
  (for example `productsPage.goto()`), not through the dashboard.
  - `userRole` is an option fixture: `'client'` (default), `'admin'`
    (unverified, see open questions), or `null` to stay logged out.
    Set it per file or `describe` with `test.use({ userRole: ... })`.
    Login page tests must use `null`.
  - It yields the `User`, or `null` when logged out. Request it only when
    the test needs the user's data.
  - It's `auto` because a test that asked for it only to trigger login
    would trip Biome's `noUnusedFunctionParameters`.
- **`ProductSearchMock`** (fixture `productSearchMock`): the fixture creates
  it with 8 generated products and registers the route before the test
  body runs. Its data can be changed afterwards:
  - Replace `productSearchMock.products` or change it in place, or use
    `updateProduct(id, changes)`. That method uses `Object.assign`, so it
    doesn't re-derive dependent fields like the generator does.
  - Every request builds its response from the current `products` with
    `ProductSearchResponseBuilder`, using the request's `page` and `size`.
    So changes apply to the next request, even after the page has loaded.
  - It doesn't filter by `q`, `category`, price, rating or stock, or sort.
    It serves `products` in their given order.
- **`ProductSearchResponseBuilder`**:
  - `withProducts`/`withGeneratedProducts` take _all_ matching products.
  - `withPageNumber`/`withPageSize` set the page (default page size 12).
  - `build()` slices `content` and derives the totals and facets from all
    products. With no products set, it generates 8.
- Category is typed as the `ProductCategory` enum on purpose. If the backend
  adds categories, update the enum.

## Open questions / known gaps

- The shop requires login: opening `/` redirects to `/login` ("Sign in –
  Awesome Testing"). Tests log in for real with credentials from `.env`
  (`CLIENT_*` / `ADMIN_*`: username, password, display name). CI has no
  `.env` and the workflow passes no credentials yet, so specs that log in
  will fail on CI until GitHub secrets are added to `ci.yml`.
- The admin account hasn't been mapped. Logging in with it via Playwright MCP
  sent no sign-in request (cause unknown), so admin-only navigation links or
  dashboard parts are missing from the page objects.
- The builder derives facets from exactly the given products. It doesn't yet
  model "facets ignore the category filter" for category-filtered mocks.
- Image paths are taken from a real response but haven't been checked
  individually.

## Commit messages: Conventional Commits

All commit messages must follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

Format:

```
<type>(<optional scope>): <description>

<optional body>

<optional footer(s)>
```

### Types

| Type       | Use for                                                         |
| ---------- | --------------------------------------------------------------- |
| `feat`     | New test, page object, fixture or helper                        |
| `fix`      | Fixing a broken or flaky test or helper                         |
| `test`     | Changing existing tests without adding a new capability         |
| `refactor` | Restructuring code without changing behaviour                   |
| `chore`    | Dependencies, tooling, config (`package.json`, `tsconfig.json`) |
| `ci`       | CI pipeline changes                                             |
| `docs`     | Documentation only (README, CLAUDE.md, comments)                |
| `style`    | Formatting only, no logic change                                |
| `perf`     | Making tests or tooling faster                                  |
| `build`    | Build system or Playwright config (`playwright.config.ts`)      |
| `revert`   | Reverting a previous commit                                     |

### Rules

- `type` is lowercase and required.
- `scope` is optional and names the area changed, e.g. `config`, `mocking`, `deps`, or a feature or page name.
- Write `description` in the imperative mood ("add", not "added" or "adds"), start it lowercase, don't end it with a period, and keep the whole first line at 72 characters or fewer.
- Leave a blank line between the subject and the body. Use the body to explain _what_ and _why_, not _how_.
- For breaking changes, add `!` after the type or scope (`feat(config)!: ...`) and a `BREAKING CHANGE: <explanation>` footer.
- Reference issues in the footer: `Refs: #123` or `Closes: #123`.
- Make one logical change per commit.

### Examples

```
feat(mocking): add API route mock for login endpoint
fix(tests): wait for network idle before asserting title
chore(deps): add typescript as dev dependency
build(config): limit projects to mockingTests on Chromium
docs: add commit message convention to CLAUDE.md
refactor(fixtures)!: rename authPage fixture to loginPage

BREAKING CHANGE: tests using `authPage` must switch to `loginPage`.
```
