---
name: har-to-mock
description: "Capture real API traffic into a git-ignored HAR and turn it into a committable, sanitized JSON recording (src/mocks/recorded/<name>.json) that HAR replay tests serve. Use it when: (1) refreshing a recording because the live data or API response changed, or a HAR replay test fails with 'The recording has no entry for it'; (2) adding a new recorded endpoint or page for a HAR replay test; (3) the user asks to capture, record or refresh a HAR or a mock from the real app; (4) a test fails with 'No recording at src/mocks/recorded/...'. Not for generated fake data (FakeProductSearchMock), for patching live responses (LivePatchedProductSearchMock) or for error responses (mock-api-errors skill)."
---

# HAR to mock

HAR replay tests never call the live API and never read a HAR from git. They
replay **recordings**: committed, sanitized JSON files in
`src/mocks/recorded/`. This skill captures fresh traffic and rewrites them.
It's run locally; CI only replays.

| Output | Path | Git | Contents |
| --- | --- | --- | --- |
| Raw HAR | `hars/<name>.har` | ignored (`/hars/*.har`) | Full Playwright HAR. Auth headers, `x-client-session-id` and cookies are stripped. For local inspection only. |
| Recording | `src/mocks/recorded/<name>.json` | **committed** | `name`; `capture` (`page`, `route`, `role`); `entries` with `method`, `url` (path + query), `status`, `contentType` and the parsed `body`. No headers, cookies, tokens or timings. |

## Refresh an existing recording

```bash
node .claude/skills/har-to-mock/capture.mjs productSearch
```

1. The script reads `page`, `route` and `role` from the existing JSON. It signs in via the API from `.env`, opens the page in Chromium with the session already in localStorage, and records every request that matches `route`.
2. Check the printed entries, for example `GET 200 /api/v1/products/search?page=0&size=12`.
3. Review `git diff src/mocks/recorded/<name>.json`. Expect only data changes. Look closely at anything personal and at every `"[redacted]"`.
4. Run the replay spec, for example `npx playwright test productsPageHar`. If a test asserts values that changed in the recording, update the test.
5. Commit the JSON. Never commit `hars/*.har`.

A refresh with unchanged live data writes a byte-identical file (verified), because it's formatted with Biome and has no timestamps. Entries keep request order, with duplicates of the same method + URL collapsed.

## Add a new recording

1. Pick a camelCase name and capture it:
   ```bash
   node .claude/skills/har-to-mock/capture.mjs <name> --page <path> --route "<glob>" [--role client]
   ```
   - `--page`: the app page that triggers the request, for example `products` or `products/7`. In **Git Bash**, write it **without** the leading slash, because Git Bash rewrites `/products` into a Windows path. The script detects that and says so. PowerShell accepts `/products`.
   - `--route`: the Playwright URL glob to record, for example `"**/api/v1/products/search**"`. Prefer a glob from `src/mocks/apiRoutes.ts`.
   - `--role`: which `.env` account signs in (defaults to `client`).
2. Write the replay spec as `tests/<something>Har.spec.ts`, using `tests/productsPageHar.spec.ts` as the pattern:
   - `const recording = await harReplayMock.serve('<name>')` builds a HAR from the JSON for the test's `baseURL` origin and routes `recording.capture.route` from it, with `notFound: 'abort'`.
   - Start `harReplayMock.waitForReplayedResponse(entry.method, entry.url)` before the navigation and await it after. It matches path **and query**, like replay does, and fails at once, naming the URL, when a request isn't in the recording.
   - `harReplayMock.expectMatchesRecording(recording, response)` checks the status and the body: JSON bodies with `toEqual`, string bodies (non-JSON or empty) as text.
   - `serve()` fails when the recording's `capture.role` differs from the test's `userRole`. For a recording captured with `--role admin`, add `test.use({ userRole: 'admin' })`.
   - Use `singleEntry(recording)` for one-request recordings, or `findEntry(recording, method, url)`.
   - Read expected values from `entry.body` (cast it to the model type), never by hard-coding live data.
3. Commit the JSON and the spec together.

## Safety rules (enforced by the script)

- Auth traffic (`users/signin`, `users/refresh`, `/auth/`) is refused twice: once in the `--route` glob, and once for every URL actually recorded. A broad glob such as `"**/api/**"` that catches a token refresh fails the capture with "Narrow --route", and nothing is saved.
- In bodies, it replaces the values of `token`, `refreshToken`, `accessToken`, `challengeToken`, `password` and `email` with `"[redacted]"`. `null` stays `null`, so replay never invents values. If a new endpoint returns other personal data, extend `sensitiveBodyKeys` in `capture.mjs` before committing.
- Credentials and `BASE_URL` are loaded with `dotenv`, like the tests: quotes are stripped, and a shell variable wins over `.env`. The password is never printed and never goes into tool arguments.
- It records into a temporary HAR in the OS temp folder. `hars/<name>.har` and the recording are written only after a fully successful capture, and the temporary file is always deleted. When the app redirects to `/login`, nothing matched `route`, sign-in failed, the host is unreachable, or a JSON body doesn't parse, the script exits with code 1 and both files stay untouched (verified with a wrong `--route`).
- A matched response with an empty body (for example, a 204) is stored as `""`, not parsed.

## Don't

- Don't commit `hars/*.har`, and don't make tests read them. Tests read only `src/mocks/recorded/*.json`.
- Don't add a capture spec or project to the Playwright config. Capturing is this local script.
- Don't hand-edit a recording to shape test data. The next refresh overwrites it. Use `LivePatchedProductSearchMock` or `FakeProductSearchMock` for edge cases.
- Don't record through Playwright MCP. It has no HAR recording of its own; this script is the way.
