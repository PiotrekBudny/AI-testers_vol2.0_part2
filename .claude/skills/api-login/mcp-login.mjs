import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const outputFile = '.playwright-mcp/api-login.js';

function readEnv() {
  return Object.fromEntries(
    readFileSync('.env', 'utf8')
      .split(/\r?\n/)
      .filter((line) => /^[A-Z_]+=/.test(line))
      .map((line) => {
        const separator = line.indexOf('=');
        return [line.slice(0, separator), line.slice(separator + 1).trim()];
      }),
  );
}

const env = readEnv();
const role = (process.argv[2] ?? 'client').toUpperCase();
const origin = new URL(env.BASE_URL || 'https://aitesters.byst.re').origin;
const username = env[`${role}_USERNAME`];
const password = env[`${role}_PASSWORD`];
if (!username || !password) {
  console.error(`Missing ${role}_USERNAME or ${role}_PASSWORD in .env`);
  process.exit(1);
}

const response = await fetch(`${origin}/api/v1/users/signin`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ username, password }),
});
if (!response.ok) {
  console.error(`API sign-in as ${username} failed with ${response.status}`);
  process.exit(1);
}
const { token, refreshToken, mfaRequired } = await response.json();
if (mfaRequired || !token || !refreshToken) {
  console.error(`API sign-in as ${username} returned no tokens`);
  process.exit(1);
}

mkdirSync('.playwright-mcp', { recursive: true });
writeFileSync(
  outputFile,
  `async (page) => {
  await page.goto(${JSON.stringify(`${origin}/login`)});
  await page.evaluate(([token, refreshToken]) => {
    localStorage.setItem('token', token);
    localStorage.setItem('refreshToken', refreshToken);
  }, ${JSON.stringify([token, refreshToken])});
  await page.reload();
  return page.url();
}
`,
);
console.log(
  `Signed in as ${username}; run ${outputFile} with browser_run_code_unsafe, then delete it`,
);
