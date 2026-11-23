# Project rules

## Commit messages: Conventional Commits

All commit messages must follow [Conventional Commits 1.0.0](https://www.conventionalcommits.org/en/v1.0.0/).

Format:

```
<type>(<optional scope>): <description>

<optional body>

<optional footer(s)>
```

### Types

| Type       | Use for                                                        |
|------------|----------------------------------------------------------------|
| `feat`     | New test, page object, fixture or helper                       |
| `fix`      | Fixing a broken or flaky test or helper                        |
| `test`     | Changing existing tests without adding a new capability        |
| `refactor` | Restructuring code without changing behaviour                  |
| `chore`    | Dependencies, tooling, config (`package.json`, `tsconfig.json`) |
| `ci`       | CI pipeline changes                                            |
| `docs`     | Documentation only (README, CLAUDE.md, comments)               |
| `style`    | Formatting only, no logic change                               |
| `perf`     | Making tests or tooling faster                                 |
| `build`    | Build system or Playwright config (`playwright.config.ts`)     |
| `revert`   | Reverting a previous commit                                    |

### Rules

- `type` is lowercase and required.
- `scope` is optional and names the area changed, e.g. `config`, `mocking`, `deps`, or a feature or page name.
- Write `description` in the imperative mood ("add", not "added" or "adds"), start it lowercase, don't end it with a period, and keep the whole first line at 72 characters or fewer.
- Leave a blank line between the subject and the body. Use the body to explain *what* and *why*, not *how*.
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
