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
(`page.route`), plus a few tests against the live API. Current scope:
the login form, the product list (search, errors, network errors), the
product details page and the cart.

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
  components/cartItemRow.ts                 CartItemRow (one cart-item-{id} row on /cart)
  components/navigationBar.ts               NavigationBar (top menu, logged out and in)
  components/productCard.ts                 ProductCard (one product-item in the list)
  components/toast.ts                       Toast (notification viewport)
  api/authApi.ts                            AuthApi: POST /api/v1/users/signin
  api/savedAuthState.ts                     creates and shares one saved session per role and origin
  config/testTags.ts                        featureTags, dataTags, tagPattern, tagPolicyViolations
  config/timing.ts                          NO_MORE_REQUESTS_WINDOW_MS (settle window for "nothing more sent")
  config/users.ts                           getUser('client' | 'admin') from env
  enums/productCategory.ts                  ProductCategory enum
  generators/productGenerator.ts            faker-based Product generator
  formatters/price.ts                       formatUsd: en-US USD price text as the app shows it
  models/product.ts                         Product (one search hit), ProductDetails
  models/auth.ts                            LoginRequest, LoginResponse, ApiSession
  models/cart.ts                            Cart, CartItem (cart API shapes used so far)
  models/productSearchResponse.ts           response, facets, price range types
  pages/basePage.ts                         abstract BasePage (url, goto, shared components)
  pages/cartPage.ts                         CartPage (/cart)
  pages/dashboardPage.ts                    DashboardPage (/ after login)
  pages/forgotPasswordPage.ts               ForgotPasswordPage (/forgot-password, url + title only)
  pages/loginPage.ts                        LoginPage page object (/login)
  pages/productDetailsPage.ts               ProductDetailsPage (/products/{id}, open(product))
  pages/productsPage.ts                     ProductsPage (/products)
  pages/registerPage.ts                     RegisterPage (/register, url + title only)
  assertions/settle.ts                      expectToStay: poll, wait a window, check again
  assertions/signInTraffic.ts               SignInTraffic: sign-in requests sent, accepted, rejected
  assertions/productSearchTraffic.ts        ProductSearchTraffic: real search response is OK
  fixtures/test.ts                          test/expect with page object + mock fixtures
  har/harFile.ts                            HAR types, read/write, sanitizeHar, pathAndQuery
  har/recording.ts                          Recording type, readRecording, harFromRecording
  mocks/apiErrorMock.ts                     error responses (4xx/5xx) for any apiRoutes endpoint
  mocks/apiRoutes.ts                        apiPaths (endpoint paths), route globs, ApiEndpoint
  mocks/cartMock.ts                         stateful fake cart: GET/DELETE /cart, POST /cart/items, PUT/DELETE /cart/items/{id}
  mocks/fakeProductDetailsMock.ts           fake GET /products/{id} + empty reviews
  mocks/fakeProductSearchMock.ts            fake product search (generated products)
  mocks/harReplayMock.ts                    replays a recording as a HAR (routeFromHAR)
  mocks/livePatchedMock.ts                  generic LivePatchedMock<T>: route.fetch + transform + fulfill
  mocks/livePatchedProductDetailsMock.ts    real GET /products/{id}, patched (stockQuantity)
  mocks/livePatchedProductSearchMock.ts     real product search, patched on the fly
  mocks/networkErrorMock.ts                 aborts requests (no response) and counts attempts
  mocks/recorded/productSearch.json         committed recording of GET /api/v1/products/search
  types/locators.ts                         Locators<K> type for locator groups
hars/                                       raw HARs from the har-to-mock skill, git-ignored
tests/                                      Playwright specs (testDir)
  auth.spec.ts                              saved API session accepted by the app; logged-out redirect
  adminAuth.spec.ts                         saved admin API session accepted by the app
  loginPage.spec.ts                         login form (empty storageState): sign-in, validation, links
  productsPage.spec.ts                      /products: all products, empty, long texts, out of stock
  productsPageSearch.spec.ts                /products search box: by name, by description, no results, ✕
  productsPageApiErrors.spec.ts             /products negative: search 404/500, Retry, /me 401
  productsPageNetworkErrors.spec.ts         /products: connection drop, recovery after 2 aborts
  cartPage.spec.ts                          /cart: add/update/remove, seeded, two products, Update rules, clear, links
  cartPageApiErrors.spec.ts                 /cart negative: PUT 500, DELETE 500, dropped connection on update
  productDetailsPage.spec.ts                /products/{id}: details, 404, cart 500, out of stock, clicks
  productsPageHar.spec.ts                   /products: replay of the productSearch recording
  productsPageLivePatched.spec.ts           /products: real search, first product patched
  productDetailsPageLivePatched.spec.ts     /products/{id}: real product, stockQuantity patched to 0
  productsPageLive.spec.ts                  /products against the real API, no mocks (HAR source)
playwright.config.ts
merge.config.ts                             reporters for merging CI shard blob reports
global-setup.ts                             private temporary directory for saved sessions
```

Imports are extensionless. Anything in `src/` is imported through the `@/`
alias (`@/*` → `./src/*` in `tsconfig.json` `paths`), for example
`import { test } from '@/fixtures/test'` in specs and
`import type { Product } from '@/models/product'` in `src/`. Only imports
from the same folder stay relative (`./basePage`, `./apiRoutes`).

- There's one alias, `@/`, on purpose: per-folder names like `@types/*`
  would clash with npm scopes (`@types/node`).
- TypeScript 7 has no `baseUrl`, so `paths` resolve relative to
  `tsconfig.json`. Playwright 1.65 reads the same `paths` (verified), so
  there's no extra loader or bundler config.

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
- `npm test` runs Playwright (every project, so the whole suite once).
  `npm run test:<category>` runs one category (`test:auth`,
  `test:products`, `test:product-details`, `test:cart`, `test:mocked`,
  `test:live`, `test:negative`). `npm run typecheck` runs `tsc --noEmit`,
  `npm run check` runs `biome check --write --unsafe`, and `npm run format`
  runs `biome format --write`.
- Biome 2: 2-space indent, single quotes, recommended rules (for example, it
  forbids classes with only static members, so use instance methods).
  `biome.json` excludes `.claude/skills/**/SKILL.md`, because Biome's
  Markdown formatter breaks YAML frontmatter (it inserts a blank line
  after the opening `---` and turns a leading `+` into a list).
- The Husky pre-commit hook runs `lint-staged` (Biome on staged
  `ts/js/json/md`), then `typecheck`, then the full `npm test`.
- CI (`.github/workflows/ci.yml`) runs on push/PR to `main`, and manually
  on any branch through `workflow_dispatch`. Its jobs (actions:
  `checkout@v7`, `setup-node@v7`, `upload-artifact@v7`,
  `download-artifact@v8`):
  - `Lint & typecheck`: `biome ci .` and typecheck.
  - `Playwright shard 1/4` … `4/4`: a matrix (`fail-fast: false`) that
    runs `npm test -- --shard=i/4` on Chromium, following
    <https://playwright.dev/docs/test-sharding>. `fullyParallel` is on,
    so tests (not files) are split evenly (12/12/12/11 at 47 tests). Each
    shard runs `global-setup.ts` and signs in on its own. Each uploads
    its `blob-report/` as `blob-report-<i>` (kept 1 day).
  - `Playwright tests` (the merge job): `needs` the shards and runs
    unless the run was cancelled, even when shards failed or were
    skipped. It downloads every `blob-report-*` into `all-blob-reports/`,
    runs `npx playwright merge-reports --config=merge.config.ts
    ./all-blob-reports` (html into `playwright-report/`, json into
    `test-results/results.json`), annotates, uploads
    `playwright-report/` (kept 30 days), and finally **fails when the
    shard jobs' result isn't `success`**. It keeps the old job name, so
    the ruleset's required check still matches, and a skipped required
    check would count as passing, which is why it never gets skipped.
  - To change the shard count, edit both `shardIndex` and `shardTotal`
    in the matrix.
  - Verified locally: four `CI=1 … --shard=i/4 --reporter=blob` runs
    merged with `merge.config.ts` into one report of 47 tests.
- In the merge job, unless the run was cancelled, the "Annotate test
  results" step runs `.github/scripts/annotate-playwright-results.cjs`
  on the merged JSON, so there is one annotation for all shards.
  It reads the totals in `test-results/results.json` and writes one
  annotation on the run, titled "Playwright results", like
  `4 tests: 4 passed, 0 failed, 0 flaky, 0 skipped (13.3 s)`:
  - `error` level when any test failed or the JSON report has run errors
    (including global setup failures before tests start). Otherwise,
    `warning` when any test was flaky and `notice` for a clean run.
  - A `warning` when the file is missing (no blob reports arrived, for
    example because lint failed and the shards were skipped).
  - It takes an optional results file path for trying it out locally.
- The GitHub ruleset "main: require CI" (Settings → Rules) makes
  `Lint & typecheck` and `Playwright tests` (the merge job, not the
  shards) required checks for merging into `main`, and the PR branch
  must be up to date with `main`.
  - Required checks match job `name:`s exactly, so renaming a job in
    `ci.yml` means updating the ruleset too, or PRs wait forever.
  - Repository admins can bypass it, which is the only way to push to
    `main` directly.
  - PRs from forks get no secrets, so their Playwright job fails.
- The Playwright step gets the account settings from the GitHub repository:
  `CLIENT_PASSWORD` and `ADMIN_PASSWORD` are **secrets**, while `BASE_URL`,
  `*_USERNAME` and `*_DISPLAY_NAME` are plain **variables**. A new env
  variable must be added both there and to the step's `env:`.
- The repository is public, and so are its workflow artifacts. A Playwright
  trace records `fill()` values, so a trace of a login contains the
  password in plain text. Therefore traces are **off on CI** and
  `on-first-retry` locally. Don't turn on traces, videos or anything else
  that records typed input on CI while the report is uploaded.
- `tsconfig.json` is type-check only: `module: nodenext`, `types: ["node"]`,
  `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`.
- `.gitattributes` forces LF line endings.
- `package.json` has `"type": "commonjs"` and `"private": true`.
- `.mcp.json` registers the Playwright MCP server (`@playwright/mcp@latest`,
  deliberately unpinned as a dev-only tool, launched via `cmd /c npx` because
  of Windows) for exploring the live UI from Claude Code. Claude Code asks
  each user to approve project MCP servers on first use. The server writes
  snapshots and console logs to `.playwright-mcp/` (git-ignored).
- `.claude/settings.json` holds a shared allowlist of read-only commands
  and two Claude Code hooks:
  - **Stop** (`.claude/hooks/stop-checks.cjs`): runs `npm run typecheck`,
    then `npm run check`, at the end of each turn. On the first failure it
    exits 2 with the output on stderr, so Claude must fix it before it can
    stop. When it already blocked once (`stop_hook_active`) and the checks
    still fail, it lets the stop through and shows the errors to the user
    as a `systemMessage`, so an unfixable error (for example in a file the
    user is editing) can't loop forever. `check` runs Biome with
    `--write --unsafe`, so it may reformat files.
  - **PreToolUse** on `Bash|PowerShell`, only for `git *` (the hook's `if`
    field): `.claude/hooks/block-force-push.cjs` blocks `--force`, `-f`
    (also in clusters such as `-uf`), `--force=…` and `+refspec` pushes
    (`origin +main`), and allows `--force-with-lease` and
    `--force-if-includes`. It skips git's global options and their values
    (`git -C dir`, `--git-dir .git`, `--work-tree .`), leading `VAR=value`
    assignments (`GIT_TRACE=1 git push -f`), and treats `&&`, `||`, `;`,
    `|`, `&` and new lines as command separators
    (`git status && git push -f`). It ignores quoted text
    (`git commit -m "… git push -f …"` passes). Verified live: the `git *`
    filter also fires for env-prefixed and multi-line commands.
- `.claude/skills/` holds project skills. **api-login** covers API
  authentication in tests and in Playwright MCP. Its `mcp-login.mjs`
  signs in from `.env` and writes a one-off, git-ignored
  `.playwright-mcp/api-login.js` for `browser_run_code_unsafe`, so the
  password never appears in MCP tool arguments. **har-to-mock** captures
  real traffic locally into recordings for HAR replay tests (see
  `HarReplayMock` below). **admin-login** covers acting as `ROLE_ADMIN` in
  tests and in Playwright MCP, including the live-write rules.
  **mock-api-errors** covers negative scenarios with `ApiErrorMock`
  (4xx/5xx, the 401 refresh rule, exploring errors through MCP).

## Playwright config

- `dotenv` loads `.env` (`quiet: true`). `.env.example` (committed) lists
  the variables: `BASE_URL`, then `CLIENT_USERNAME`, `CLIENT_PASSWORD`,
  `CLIENT_DISPLAY_NAME` and the same three `ADMIN_*` variables (a regular
  customer account and an admin account). The real values go in `.env`
  (git-ignored). A shell variable wins over `.env`, because dotenv doesn't
  override variables that are already set.
- `getUser(role)` in `src/config/users.ts` reads the account variables when
  called, not at import. It throws a clear error if one is missing, so
  specs that never log in run without them. Use
  `loginPage.loginAs(getUser('client'))` in login form tests.
- `baseURL` is `process.env.BASE_URL`, falling back to `https://aitesters.byst.re`.
- On CI: `retries: 2`, `forbidOnly`, and the `list` and `blob` reporters
  (`list` prints each test in the shard's job log, `blob` writes
  `blob-report/` for merging). `merge.config.ts` holds the reporters of
  the merged report: `html` and `json` (`test-results/results.json`,
  which feeds the CI results annotation). Locally:
  `list` plus `html` with `open: 'never'`, because an auto-opened report
  would block the pre-commit hook.
- `trace`: `off` on CI (see the CI notes on public artifacts), `on-first-retry`
  locally. Desktop Chrome is set in the top-level `use`, and the projects
  split the suite by category (see Test categories).
- HAR recording is the `harRecording` option fixture, set in the config
  to `!isCI`, so it's **on locally only**. The config is typed
  `defineConfig<Options>` to accept it.
  - The fixture overrides the built-in `contextOptions` with `recordHar`,
    so every test (and every retry) writes its own
    `test-results/<test>/network.har` and attaches it to the HTML report
    (skipped when no file was written, for example when the context never
    opened, and when the sanitized HAR has no entries, for example login
    form tests, whose only call, `users/signin`, is not on the allowlist).
  - `harUrlFilter` is an **allowlist**: `/api/v1/` `products`, `cart`,
    `currencies` and `users/me` only. Auth endpoints (sign-in, a token
    refresh, register) are never recorded, so passwords and refresh tokens
    stay out. Add an endpoint there when a test needs it in the HAR.
  - After the context closes, the fixture runs `sanitizeHar` on the file
    before attaching it. So the attachments have no bearer token, session
    id or cookies, which was verified on all 8 attachments. Response bodies
    stay, for example the `users/me` profile. Still don't turn it on for
    CI while the report is uploaded.

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

## Test categories (tags and projects)

- Every spec wraps its tests in **top-level** `test.describe` blocks with
  tags. Describes are **never nested**, so a file with several groups (for
  example `tests/loginPage.spec.ts`) has several top-level describes.
- Every test carries exactly **one feature tag**, set on its describe:
  `@auth`, `@products`, `@product-details` or `@cart`.
- It also carries exactly **one data tag**. `@live`: the test checks real
  backend data. `@mocked`: the endpoints under test are mocked or
  replayed, **but authenticated tests still use real API login and page
  bootstrap (`users/me`, `cart`, `currencies`)**. `@mocked` and `@live`
  together cover the whole suite.
- The auto fixture `tagPolicy` (`src/fixtures/test.ts`, rules in
  `src/config/testTags.ts`) fails any test that doesn't have exactly one
  feature tag and exactly one data tag, naming what's missing. Verified
  with a throwaway spec: two feature tags and a missing data tag both fail.
- Optional tags: `@negative` (error and validation scenarios; set per test
  when only some tests in a describe are negative), `@search`,
  `@network` and `@har`.
- **Projects** in `playwright.config.ts` are built from the feature tags
  (`grep: /@cart(?![\w-])/` and so on), so they partition the suite: a full
  run executes each test once, and `--project=cart` runs one feature. The
  lookahead keeps `@products` from matching `@product-details`.
- The `untagged` project (`grepInvert` of all feature tags) makes sure a
  test with no feature tag still runs, so `tagPolicy` fails it instead of
  it silently dropping out of every feature project. When everything is
  tagged it's empty, and `--project=untagged` on its own then prints
  "No tests found" and exits 1: that's the correct state, not an error.
- Cross-cutting runs use `--grep`: `--grep @live`, `--grep @negative`,
  `--grep "@cart.*@negative"`. A new feature tag needs an entry in
  `featureTags` in `src/config/testTags.ts` (shared by the config and
  `tagPolicy`) and a `test:<feature>` script.
- Verified: 10 auth + 17 products + 7 product-details + 12 cart + 0
  untagged = 46 tests, the same as the whole suite.

## Page objects

- One class per view in `src/pages/`, constructed with `new XPage(page)`,
  exposing `readonly` locators plus action methods (`login`).
- Every page extends the abstract `BasePage`. It holds `page`, the shared
  components, `cartCounter` (the nav cart icon, which renders on every
  page; `expectCartCount(n)` expects its text, empty at 0), `goto()`, which opens `this.url`, and `expectToBeOpen()`,
  which checks the URL **path** (the query is ignored, for example
  `?returnTo=`) and the page title.
- Each page declares its exact URL path and its title in its own class:
  `readonly url = '/login'`, `readonly title = 'Sign in – Awesome Testing'`.
  Paths are relative to `baseURL`, so `BASE_URL` still picks the
  environment. Don't override `goto()` per page.
- Parts shared across views (navigation, toasts) live in
  `src/components/`, each scoped to its root test id. `BasePage` creates
  them, so every page has `.navigation` and `.toast`.
- Tests get page objects through Playwright fixtures: import `test` and
  `expect` from `src/fixtures/test.ts`, not from `@playwright/test`, and
  take `loginPage`, `dashboardPage`, `productsPage` as test arguments. Every
  new page object gets a fixture there.

### Rule: no assertions in tests

- Specs contain no `expect(...)` calls. A test arranges, acts and calls
  named `expect…` methods, so it reads as the scenario.
- Where an assertion goes:
  - **UI state**: a method on the page object or component that owns
    the elements (`loginPage.expectRequiredErrors(['password'])`,
    `navigation.expectLoggedOut()`, `toast.expectToShow(title, text)`,
    `productsPage.expectInStockCount(2)`).
  - **What a mock received or served**: a method on that mock
    (`cartMock.expectAddedItems(...)`,
    `livePatchedProductSearchMock.expectServedWithoutErrors(1)`,
    `harReplayMock.expectMatchesRecording(...)`).
  - **Real network traffic** with no mock: an assertion class in
    `src/assertions/`. It starts listening in its constructor, so its
    fixture must be requested before the action. `SignInTraffic`
    (`expectAccepted` 200, `expectRejected` 422, `expectNoneSent(ms)`,
    which waits the window before checking) and
    `ProductSearchTraffic` (`expectOkWithProducts()` returns the body,
    `expectAnInStockProduct()` returns a real product with stock).
- Name methods `expect` + what is true afterwards, written from the
  user's view: `expectToWelcome(displayName)`, `expectToShowLoggedOutForm()`.
- Compose instead of repeating: `expectToShowLoggedOutForm()` uses
  `expectToBeOpen()` and `navigation.expectLoggedOut()`.
- Waiting is not asserting: use `locator.waitFor()` when a test only needs
  the page to be ready.
- "Nothing more was sent" needs a window: `expectToStay(page, read,
  expected, ms, message)` (`src/assertions/settle.ts`) polls until the
  value matches, waits `ms`, and checks again. Every `…ToStay` method and
  `SignInTraffic.expectNoneSent` use it, and specs pass
  `NO_MORE_REQUESTS_WINDOW_MS` (`src/config/timing.ts`, 1.5 s).
- No `if`/`throw` in specs: get typed products from
  `ProductGenerator.generateCatalogue(count, overrides)` (`{ products,
  first, second }`), and keep transforms in the mock
  (`livePatchedProductSearchMock.patchFirstProduct(changes)`).

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
  name when it reads better (`menuLinks`). Keys are short
  camelCase names without the kind suffix: `buttons.signIn`, not
  `signInButton`.
- A single locator of its kind stays a plain field (`form`, `root`,
  `heading`, `searchInput`, `welcomeHeading`). When removing locators
  leaves a group with one key, turn it into a plain field.
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
- Login form links: "Forgot password?" (`login-forgot-link`) and
  "Register" (`login-register-link`) are `<button>`s, not anchors. They
  open `/forgot-password` ("Forgot password – Awesome Testing") and
  `/register` ("Create account – Awesome Testing").
- `tests/loginPage.spec.ts` is the only spec that uses the UI login form,
  with empty `storageState` for the whole file. Its successful login signs in
  for real as the client. The rejected-login test uses a random unknown
  username, so failed attempts never count against the shared accounts.
  Its scenarios: valid credentials land on the dashboard; invalid ones
  show the `Error` toast and `LoginPage.expectToShowLoggedOutForm()` (URL
  path, title, form, enabled Sign in, logged-out navigation); empty fields
  show the required errors, stay on the form and send **no** `users/signin`
  request. `SignInTraffic` records the requests; `expectRejected()` in the
  invalid-credentials test counts exactly one, which shows the recording
  works.
- Opening a page behind login while logged out redirects to
  `/login?returnTo=<path>` (for example `returnTo=%2Fproducts`).
- After a successful login the app lands on `/` ("Home – Awesome Testing",
  test ids `home-*`), modelled as `DashboardPage`. The page load calls
  `GET /api/v1/users/me`, `/api/v1/cart` and `/api/v1/currencies`. The
  display name is the navigation's `username-profile-link`. The heading
  shows only the first name (`Welcome, Alice!`).
- Navigation: `links.login`/`links.register` show only when logged out.
  `links.cart` and `links.profile` (leads to `/profile`) show only when
  logged in, as do the desktop menu links, selects and logout button
  (not modelled; no test uses them). Mapped for the desktop layout as a
  client; admins may see more links.
- Products page (`/products`, "Products – Awesome Testing"), modelled as
  `ProductsPage`:
  - Every product card repeats the same test ids (`product-item`,
    `product-name`, …), with no id in them. `ProductCard` is scoped to one
    card. Get one with `productsPage.product(name)` (exact name match) or
    `productsPage.productAt(index)`.
  - Category test ids use a slug of the name: lowercase, spaces become `-`,
    `&` is kept (`products-category-home-&-kitchen`,
    `products-category-count-home-&-kitchen`). Not modelled yet; build the
    id from the `ProductCategory` enum when a test needs it.
  - The sort `<select>` uses hyphens (`price-asc`), while the API's `sort`
    parameter uses underscores (`price_asc`). Sorting and the price/rating
    filters aren't modelled yet (no test uses them).
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
  - With no results and no search query: `products-count-summary` reads
    `0 products match` and `product-search-summary` `No matching products`.
    `no-products-message` reads only `No products found`,
    `products-categories-empty` reads `No categories match`, and the
    in-stock count is `0`. There is no `product-list`, pagination or
    `reset-search-button`. `ProductsPage.expectNoProducts()` checks all of
    this.
  - With no results for a search query, `no-products-message` also says
    "Try adjusting your search or" and `reset-search-button` ("Clear
    filters") appears. `ProductsPage.expectNoSearchResults()` checks this
    plus the shared empty texts.
  - Search box (`product-search`, max 100 characters) is debounced: typing
    "Bionic" key by key sent one request,
    `products/search?page=0&size=12&q=Bionic`, and the URL becomes
    `/products?q=Bionic`. The real API matches `q` against name **and**
    description, ignoring case ("Bionic" appears only in the iPhone's
    description).
  - `clear-search` (✕, `aria-label="Clear search"`) shows inside the search
    box once it has text. Clicking it empties the box, drops `?q=` from the
    URL and shows the full list again. `reset-search-button` does the same.
  - With one match the count reads `1 product matches` (singular).
  - Long texts: `product-name` has `line-clamp-2` and
    `product-description` `line-clamp-3` (ellipsis, overflow hidden), and
    the full text stays in the DOM. Unbroken words wrap
    (`overflow-wrap: break-word`). Cards keep the same size whatever the
    text length, and price and Add to Cart don't move.
    `ProductCard.expectLongTextsTruncated()`, `expectNoHorizontalOverflow()`
    and `expectSameSizeAs(other)` check this.
  - Add to Cart sends `POST /api/v1/cart/items` with
    `{"productId": <id>, "quantity": <n>}` and gets the cart back
    (`{username, items, totalPrice, totalItems}`). The toast reads
    `Added to cart` / `<n> × <name> added to your cart`. The card's
    quantity stays at what was chosen.
  - On an out-of-stock card the Add to Cart button is `disabled`. A forced
    click sends no request.
  - Intercepting every non-GET request (`page.route('**/*')`) stopped Add to
    Cart from sending anything. Mock only the exact endpoint
    (`CartMock` routes only the cart endpoints).
  - A search `404` shows the error state at once, after one request. A
    `500` is retried with backoff (4 requests at about 0/1/3/7 s, showing
    `product-list-loading` "Loading products..." meanwhile). The error
    state is `error-message` (`role="alert"`, "Error loading products")
    plus `product-list-retry` ("Retry"); the count summary stays
    "Searching the catalogue". Retry sends a new search.
    `ProductsPage.expectLoadError()` (waits up to 15 s),
    `expectStillLoading()` and `retryLoading()` cover it.
  - A dropped connection (`route.abort()`, no response at all) looks
    exactly like a `500` in the UI: the same 4 attempts at about
    0/1/3/7 s, the same loading state and the same error state. Only the
    traffic differs: a `500` produces a response, while an abort produces
    `requestfailed` and **no response**. The error text depends on the
    abort code: `net::ERR_FAILED` for the default `failed`,
    `net::ERR_INTERNET_DISCONNECTED` for `internetdisconnected`. Clicking Retry
    after either starts a **full new cycle of 4 attempts**. So the app
    retries 5xx and network failures, but not 4xx.
  - A `401` from `GET /api/v1/users/me` makes the app call
    `POST /api/v1/users/refresh`. When that fails too, it clears `token`
    and `refreshToken` and lands on `/login` (no `returnTo`, no toast, no
    logout request).
  - The "WebMCP · Agent interface" panel (`shop-tool-*`) on the page isn't
    modelled.
  - `ProductSearchResponseBuilder` output renders correctly on this page
    (checked with a throwaway mocked test).
- Product details page (`/products/{id}`, title `<name> – Awesome Testing`),
  modelled as `ProductDetailsPage`. All facts were verified through
  Playwright MCP:
  - **URL and title:** both depend on the product, so `url`/`title` are
    getters. `open(product)` sets them and calls `goto()`;
    `openById(id)` is for unknown ids (no title).
  - **Requests on load:** `GET /api/v1/products/{id}` plus `wishlist` and
    `products/{id}/reviews/summary`, `/reviews?page=0&size=10`,
    `/reviews/mine`. The details body has no `averageRating` or
    `reviewCount` (`ProductDetails`).
  - **Elements:**
    - `product-back-link` "← Back to Products"
    - `product-title` (h1), `product-price` (`formatUsd`),
      `product-description`, `product-category`
    - `product-stock` "`<n>` in stock"
    - `product-image` (`alt` = name); not rendered when `imageUrl` is null
    - quantity: `decrease-quantity` (disabled at 1), `quantity-value`,
      `increase-quantity` (disabled at quantity == `stockQuantity`)
    - `add-to-cart` "Add to Cart"
    - `wishlist-toggle` "Save to wishlist" (a real write, never clicked)
  - **Section titles** have textContent `Description`, `Category`,
    `Availability` and `Quantity`, shown uppercase via CSS.
  - **404 on the details request:** one request, no retries. Only
    `product-not-found` (`role="alert"`) renders: h1 "Product not found",
    "This product does not exist or may have been removed." and
    `product-not-found-back-link` "Back to Products" (→ `/products`).
    The title becomes `Product not found – Awesome Testing` and there's
    no toast.
  - **`stockQuantity: 0`:** `product-stock` reads "Out of stock" and the
    whole `product-quantity-section` is gone. `add-to-cart` "Add to Cart"
    is visible but disabled, and a forced click sends nothing.
    `wishlist-toggle` stays enabled.
  - **Add to Cart in flight:** while the POST is pending the button reads
    "Adding to Cart..." and is disabled, so extra clicks (normal, forced,
    `dispatchEvent`) send nothing: exactly one POST.
  - **Product already in the cart** (the app reads `GET /api/v1/cart`):
    the button reads **"Update Cart"**, the quantity selector shows the
    cart quantity, and a click sends **`PUT /api/v1/cart/items/{id}`**
    `{quantity}` with the selected quantity. That _sets_ the quantity, so
    clicking it again at the same quantity changes nothing. Only a product
    that isn't in the cart gets `POST /cart/items`. (Earlier specs saw a
    POST on every click only because the real `GET /cart` stayed empty
    while the POSTs were mocked.) `expectInCart(quantity)` checks this.
  - **Cart 500:** one POST, no retry. Toast `Error` / "Failed to update
    cart. Please try again.". The button goes back to "Add to Cart",
    enabled, and the quantity is kept.
  - **Unknown id with the real reviews API:** the reviews calls return 404
    and `reviews-error` (`role="alert"`) shows "Unable to load reviews.".
    `FakeProductDetailsMock` serves empty reviews to avoid this.
- Cart page (`/cart`, "Cart – Awesome Testing"), modelled as `CartPage`
  with one `CartItemRow` per item (`cartPage.item(productId)`). All facts
  were mapped from a real HAR and MCP:
  - **Requests:** the page reads `GET /api/v1/cart` (on every page load
    and again after every write, often twice). Items hold only
    `productId` and `quantity`, so the page fetches
    `GET /api/v1/products/{id}` for names and prices.
  - **Row test ids carry the product id:** `cart-item-{id}`, `-name-`,
    `-price-`, `-decrease-`, `-quantity-`, `-increase-`, `-update-`,
    `-total-`, `-remove-`.
  - **Summary:** `cart-summary-items-count`, `cart-summary-total-price`,
    `cart-checkout-button` "Proceed to Checkout", `cart-clear-button`
    "Clear Cart". The coupon, gift card and loyalty panels aren't
    modelled.
  - **Changing the quantity:** + and − only change the shown number.
    **Update** (`cart-item-update-{id}`) is **absent** until the shown
    quantity differs from the cart, and disappears again when it matches.
    − is disabled at 1 and + at `stockQuantity`. Nothing is sent until
    Update (`PUT /cart/items/{id}`), after which the toast reads
    `Cart updated` / "`<name>` quantity set to `<n>`".
    `CartItemRow.changeQuantityWithoutSaving`, `saveQuantity`,
    `setQuantity` (both steps), `expectUnsavedQuantity`,
    `expectSavedQuantity` and `expectQuantityLimits` cover it.
  - **Remove:** `DELETE /cart/items/{id}`, toast `Removed from cart` /
    "`<name>` has been removed from your cart". With no items left the page
    shows `cart-empty` and "Browse Products".
  - **Clear Cart** opens a **native `confirm()`**: "Are you sure you want
    to clear your cart?". Accepting sends `DELETE /api/v1/cart` and shows
    the toast `Cart cleared` / "All items have been removed from your
    cart". Dismissing sends nothing. `CartPage.clearCart('accept' |
    'dismiss')` answers it, and `expectClearConfirmationAsked()` checks
    the message.
  - **Errors:** a failed `PUT` (500 or a dropped connection) shows toast
    `Error` / "Failed to update cart. Please try again." and the shown
    quantity **goes back** to the saved one. A failed `DELETE` shows
    `Error` / "Failed to remove from cart. Please try again." and the row
    stays. Neither is retried (`tests/cartPageApiErrors.spec.ts`).
  - **Toasts stack:** several can be visible at once, so
    `Toast.expectToShow(title, description)` looks for the **one**
    toast (`li`) that has both texts.
  - **Cart counter:** the nav cart icon (`desktop-cart-icon`, on every
    page) shows `totalItems` as text (units, not lines), empty at 0. Its
    `aria-label` reads `Cart, 1 item`. `BasePage.cartCounter` /
    `expectCartCount(n)`.

## Mocking conventions

- **`ProductGenerator`** (`new ProductGenerator(seed?)`) has its own Faker
  instance; a seed makes the data reproducible (dates are still relative to
  today).
  - `generateProduct(overrides)`: fields that depend on each other are
    derived _after_ overrides are applied:
    - `reviewCount: 0` gives a null rating, and `averageRating: null` gives
      0 reviews.
    - `updatedAt` is never earlier than `createdAt`. When it would be,
      it reuses the `createdAt` string verbatim, so the microsecond
      digits aren't truncated by a `Date` round trip.
    - The rating is the average of generated 1-5 star reviews.
    - `imageUrl` is picked from the known server images.
  - `generateProducts(count, overrides)` gives ids `count..1`, sorted
    newest-first by `createdAt`; `id` cannot be overridden.
  - `generateCatalogue(count, overrides)` returns the same list plus a
    typed `first` and `second` (count must be at least 2).
- Login goes through the real API once per role and origin in a run (see API login
  below). The mocks cover only the endpoints a test asks for.
- Four kinds of mock for products (search and details). The class name starts with the
  kind, and each fixture and file is the class name in camelCase
  (`FakeProductSearchMock` → `fakeProductSearchMock`):

  | Kind         | Class / fixture                                                 | Calls the real API?   | Data                      |
  | ------------ | --------------------------------------------------------------- | --------------------- | ------------------------- |
  | Fake         | `FakeProductSearchMock`                                         | No                    | generated by Faker        |
  | HAR replay   | `HarReplayMock`                                                 | No (capture is local) | real, committed recording |
  | Live patched | `LivePatchedProductSearchMock`, `LivePatchedProductDetailsMock` | Yes, every request    | real, with a transform    |
  | None (live)  | no mock fixture requested                                       | Yes                   | real, unchanged           |

  `HarReplayMock` isn't tied to product search: `serve(name)` replays any
  recording.
  Route globs live in `apiRoutes` (`src/mocks/apiRoutes.ts`), not on a
  mock class, so the mocks don't depend on each other. Endpoint paths
  live once in `apiPaths` in the same file. `AuthApi`, `SignInTraffic`
  and `ProductSearchTraffic` use them, and the string globs are built
  from them. Only the skills' `.mjs` scripts repeat `/api/v1/users/signin`,
  because plain Node can't import the TS module.
- No mock is `auto`: a test that doesn't request one hits the real API.
  `tests/productsPageLive.spec.ts` does this on purpose. It waits for
  the real `GET /api/v1/products/search` response and checks the cards
  against its `content`, so it doesn't depend on fixed seed data.
  Locally its HAR (`users/me`, `cart`, `currencies`,
  `products/search?page=0&size=12`) is a real-traffic source for building
  HAR mocks. It runs on CI too, against the live API, without a HAR.
- **`HarReplayMock`** (fixture `harReplayMock`) replays committed
  **recordings**, never a HAR from git and never the live API:
  - A recording is `src/mocks/recorded/<name>.json` (`Recording` in
    `src/har/recording.ts`): the `capture` settings (`page`, `route`,
    `role`) and `entries` with `method`, `url` (path + query), `status`,
    `contentType` and the parsed `body`. No headers, cookies or tokens.
  - `serve(name)` builds a HAR from it (`harFromRecording`) for the test's
    `baseURL` origin in `test-results/<test>/har-work/`. It then calls
    `page.routeFromHAR` for `capture.route` with `notFound: 'abort'`, and
    returns the recording. Replay matches URL (with query) and method
    strictly. Building per origin makes a recording work on any
    `BASE_URL`.
  - `waitForReplayedResponse(method, url)`: start it before the
    navigation and await it after. A request missing from the recording
    is aborted and never produces a response, so the helper races
    `requestfailed` and fails at once, naming the URL.
    `expectMatchesRecording(recording, response)` checks status and body.
    `singleEntry` / `findEntry` read entries, and
    `waitForReplayedResponse` takes the entry's `url` (path + query).
    `serve()` fails when the recording's `capture.role` differs from the
    test's `userRole`.
  - Verified: a `CI=1` run with no raw HAR present passed. The replayed
    search had no Cloudflare `cf-ray` header, so it never reached the
    server.
  - Recordings are captured and refreshed **locally** with the
    **har-to-mock** skill (`.claude/skills/har-to-mock/SKILL.md`,
    `node .claude/skills/har-to-mock/capture.mjs <name>`). It also writes
    the raw, cleaned `hars/<name>.har`, which is git-ignored. Its
    procedure, safety rules and the way to add a new recording live
    there. There's no capture spec or project.
  - Don't hand-edit recordings to shape data (a refresh overwrites
    them). Use `LivePatchedProductSearchMock` or the fake mock.
- **Live patched mocks** use the docs' "modify API responses" pattern:
  `route.fetch()` the real response, apply `register(transform)`, then
  `route.fulfill({ response, json })`. The logic lives in the generic
  `LivePatchedMock<T>` (`src/mocks/livePatchedMock.ts`, constructed with
  an `ApiEndpoint`), with `lastServed()`, `lastReal()` and the async
  `expectServedWithoutErrors(n, settleMs = 1000)`. It waits until `n`
  responses were served **or failed**, so a real-API error fails at once
  with its message. Then it waits `settleMs` and checks that there are
  still no errors and exactly `n` served. Two subclasses:
  - **`LivePatchedProductSearchMock`** (fixture
    `livePatchedProductSearchMock`): `patchFirstProduct(changes)` and
    `expectOnlyFirstProductPatched()`.
  - **`LivePatchedProductDetailsMock`** (fixture
    `livePatchedProductDetailsMock`): `patchStockQuantity(n)` and
    `expectOnlyStockQuantityPatched(n)`.
    `tests/productDetailsPageLivePatched.spec.ts` takes a real in-stock
    product from the live search
    (`productSearchTraffic.expectAnInStockProduct()`), opens its details
    page with only `stockQuantity` patched to 0, and checks the
    out-of-stock state. No generated product and no static recording; it
    needs the real backend.

  Shared rules:
  - The transform gets a clone, so it may change it in place.
  - `realResponses[i]` and `servedResponses[i]` always belong to the same
    request, because both are pushed only after `route.fulfill` succeeded.
    So they list only responses the page actually got. `lastServed()`
    returns the last served one.
  - Only the fetch and the transform are inside the `try`, and the route
    is completed exactly once. Errors go into `errors`:
    - When the real response isn't OK or the transform throws, it serves
      the real response unchanged.
    - When `route.fetch()` itself fails (network), it aborts the request.
    - A failing final `route.fulfill` (for example, the page closed)
      isn't retried. Its error is the route handler's own.
  - So the page never hangs on a pending request, and `lastServed()`
    reports the errors.
  - `tests/productsPageLivePatched.spec.ts` also asserts that exactly one
    search was served and that `errors` is empty.
- **API login and saved storageState**: tests never log in through the UI form,
  except `tests/loginPage.spec.ts`, which tests the form itself.
  `global-setup.ts` makes a private temporary directory unique to the run
  and removes it during teardown. The `storageState` fixture calls
  `AuthApi.signIn` on first use for each role and origin and saves
  `token` and `refreshToken` as localStorage entries. Tests share that
  file across workers. `test.use({ storageState: { cookies: [],
  origins: [] } })` skips session creation, so tests that never sign in
  can run without account credentials. Tokens expire after one hour.
  The **api-login** skill
  (`.claude/skills/api-login/SKILL.md`) covers tests, roles, and Playwright MCP.
- **`FakeProductSearchMock`** (fixture `fakeProductSearchMock`): the
  fixture creates it with 8 generated products and registers the route before the test
  body runs. Its data can be changed afterwards:
  - Replace `fakeProductSearchMock.products` or change it in place, or use
    `updateProduct(id, changes)`. That method uses `Object.assign`, so it
    doesn't re-derive dependent fields like the generator does.
  - Every request builds its response from the current `products` with
    `ProductSearchResponseBuilder`, using the request's `page` and `size`.
    So changes apply to the next request, even after the page has loaded.
  - It filters by `q` like the real API: a case-insensitive substring of
    `name` or `description`. It doesn't filter by `category`, price,
    rating or stock, or sort. It serves matches in their given order.
  - It records each request's `q` (`null` when absent) in
    `receivedQueries`. `expectLastSearchedFor(query)` polls the last one.
- **`CartMock`** (fixture `cartMock`, requested only by tests that touch
  the cart) is a **stateful** fake cart, so tests never change the shared
  account's real cart.
  - Each test gets its own instance, so its own empty item map; nothing is
    shared between tests.
  - It serves `GET /api/v1/cart` from that state, and updates it on
    `POST /cart/items` (adds to the quantity), `PUT /cart/items/{id}`
    (sets it; 0 removes), `DELETE /cart/items/{id}` and `DELETE /cart`.
    PUT or DELETE of an item that isn't in the cart answers 404
    `{"message":"Cart item not found"}`. These match the real backend,
    verified through MCP with cleanup; the 404 for PUT is assumed.
  - Every write answers with the whole cart: `{username, items:
    [{productId, quantity}], totalPrice, totalItems}`. Prices come from
    `fakeProductSearchMock.products` plus `fakeProductDetailsMock.product`;
    an item whose product is in neither throws a clear error instead of
    being priced at $0.
  - `seed(items)` starts a test with items. It throws at once for a
    product the mocks don't know, and a POST for an unknown product gets a
    500 with the same message, instead of a hanging request. `cart()` returns the current
    cart, `expectCartItems(items)` polls the state, and `addedItems` /
    `updatedItems` log the POST / PUT bodies (`expectAddedItems`,
    `expectUpdatedItems`).
  - A test that clicks Add to Cart must take this fixture, or make
    `cartItems` fail through `apiErrorMock`.
  - `expectAddedItems(items)` polls `addedItems`. For "nothing sent" or
    "exactly N", use `expectAddedItemsToStay(items, ms)`, which also
    checks that nothing more arrives within `ms`.
  - `holdResponses()` holds every write until the returned function is
    called. Calling it again while holding returns the same release.
    The change is applied only on release, so a `GET /cart` during
    the hold still returns the old cart. Tests use it for the "Adding to Cart..." pending state without
    sleeping. Fixture teardown releases held responses, so a failing test
    never leaves a route handler hanging.
- **`FakeProductDetailsMock`** (fixture `fakeProductDetailsMock`):
  registers before the test body.
  - Serves `product` (generated, `stockQuantity` 5-50, `id` 10,000 or
    more so it never clashes with the search mock's ids) for
    `GET /api/v1/products/{id}` (also with a trailing `/` or a query),
    minus the rating fields. Unknown ids get 404 `Product not found`.
    `alsoServe(products)` adds more products by id. Only the `cartMock`
    fixture calls it, with `fakeProductSearchMock.products`, because the
    cart page fetches the details of every cart line. So requesting
    `fakeProductDetailsMock` alone doesn't pull in a fake search.
  - Serves empty reviews (summary, list, mine) for any product id.
  - `updateProduct(changes)` uses `Object.assign`.
  - The `productDetails` and `productReviews` routes in `apiRoutes` are
    RegExps (`page.route` accepts both), so they never match `search`.
- **`ApiErrorMock`** (fixture `apiErrorMock`, not `auto`): makes any
  `apiRoutes` endpoint answer with an error status
  (`respondWithError(endpoint, status, { times?, message? })`), with a
  backend-like body `{status, error, message, path, timestamp}`.
  `rejectSession()` makes `users/me`, `users/refresh` and `users/logout`
  return 401, so none of them reaches the server.
  `expectRequestCount(endpoint, n)` polls how many errors it served,
  `expectRequestCountToStay(endpoint, n, ms)` also checks that no more
  arrive within `ms` (no retries), and `waitForRequestCount(endpoint, n)`
  waits until at least `n` were served (for example, the first retry). A
  test that mocks a 401 must also mock `tokenRefresh`, so the shared
  refresh token never reaches the real refresh endpoint. Procedure,
  behaviour and MCP exploration steps live in the **mock-api-errors**
  skill.
- **`NetworkErrorMock`** (fixture `networkErrorMock`, not `auto`):
  `abort(endpoint, { times?, errorCode? })` makes any `apiRoutes`
  endpoint fail with **no response** (`route.abort`, default `failed`;
  the tests use `internetdisconnected`).
  - `abortedCount`, `waitForAbortedCount` and `expectAbortedCountToStay`
    count the aborted attempts.
  - Never wait for a response of an aborted request:
    `page.waitForResponse` never resolves, and
    `HarReplayMock.waitForReplayedResponse` fails at once on the
    `requestfailed` event. Assert the UI and the attempt counts instead.
  - **Fail N times, then recover:** register the serving route first
    (`harReplayMock.serve(...)` or a fake mock fixture), then
    `abort(endpoint, { times: N })`. Playwright tries the last-registered
    route first, and after N attempts the abort route is removed.
- **`ProductSearchResponseBuilder`**:
  - `withProducts` takes _all_ matching products.
  - `withPageNumber`/`withPageSize` set the page (default page size 12).
  - `build()` slices `content` and derives the totals and facets from all
    products. With no products set, it generates 8.
- Category is typed as the `ProductCategory` enum on purpose. If the backend
  adds categories, update the enum.

## Open questions / known gaps

- The shop requires login: opening `/` redirects to `/login` ("Sign in –
  Awesome Testing"). Tests log in for real with credentials from `.env`
  (`CLIENT_*` / `ADMIN_*`: username, password, display name). On CI they
  come from repository secrets and variables.
- Admin API login works (verified: 200, `ROLE_ADMIN`, no MFA), and so does
  admin in Playwright MCP via `mcp-login.mjs admin`. The admin UI isn't
  modelled in code yet: no `warehouse`/`admin` menu links in
  `NavigationBar`, no admin page objects; `adminAuth.spec.ts` only checks the saved session. The
  **admin-login** skill (`.claude/skills/admin-login/SKILL.md`) has the
  mapped test ids, the admin-only endpoints and the agreed rules for admin
  tests (separate `tests/admin*.spec.ts`, live writes only on self-created
  prefixed data with cleanup, MCP writes only with the user's OK).
- The builder derives facets from exactly the given products. It doesn't yet
  model "facets ignore the category filter" for category-filtered mocks.
- Image paths are taken from a real response but haven't been checked
  individually.
- Tests of one role share its saved `token` and `refreshToken` across workers.
  Whether the backend rotates refresh tokens is unknown. A real refresh or
  logout could invalidate the saved session for other tests in the run.
  Current tests do neither; 401 tests mock refresh. Runs normally take seconds,
  while the JWT lasts one hour. If rotation becomes a problem, use separate
  accounts or sessions for tests that change authentication state.
- A rare uncaptured flake: twice, one full parallel run had one failing
  test (once with the UI-login setup, once right after the switch to API
  login). Neither error was saved. Each time the following runs all passed,
  including 28/28 with `--repeat-each=4`. Locally `retries` is 0 and the
  trace is `on-first-retry`, so a one-off failure leaves no trace. To
  catch it, run with `--retries=1` (records a trace) or
  `--reporter=line` and keep the output.

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
