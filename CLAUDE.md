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
  enums/productCategory.ts                  ProductCategory enum
  generators/productGenerator.ts            faker-based Product generator
  models/product.ts                         Product (one search hit)
  models/productSearchResponse.ts           response, facets, price range types
tests/                                      Playwright specs (testDir)
playwright.config.ts
```

Imports between `src/` files are relative and extensionless.

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

## Playwright config

- `dotenv` loads `.env` (`quiet: true`). `.env.example` lists the variables,
  and both files are currently empty.
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
- **`ProductSearchResponseBuilder`**:
  - `withProducts`/`withGeneratedProducts` take _all_ matching products.
  - `withPageNumber`/`withPageSize` set the page (default page size 12).
  - `build()` slices `content` and derives the totals and facets from all
    products. With no products set, it generates 8.
- Category is typed as the `ProductCategory` enum on purpose. If the backend
  adds categories, update the enum.

## Open questions / known gaps

- `tests/example.spec.ts` is still Playwright's starter example (it hits
  playwright.dev). Replace it with the first real mocked product-list test.
- Unknown whether the product list UI requires login. Credentials would go
  in `.env`.
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
