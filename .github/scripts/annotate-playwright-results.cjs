const fs = require('node:fs');

const resultsFile = process.argv[2] ?? 'test-results/results.json';
const title = 'Playwright results';

if (!fs.existsSync(resultsFile)) {
  console.log(
    `::warning title=${title}::No test results found in ${resultsFile}`,
  );
  process.exit(0);
}

const {
  stats: { expected, unexpected, flaky, skipped, duration },
  errors = [],
} = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
const total = expected + unexpected + flaky + skipped;
const level =
  unexpected > 0 || errors.length > 0
    ? 'error'
    : flaky > 0
      ? 'warning'
      : 'notice';
const seconds = (duration / 1000).toFixed(1);
const runErrors =
  errors.length > 0
    ? ` (${errors.length} run error${errors.length === 1 ? '' : 's'})`
    : '';

console.log(
  `::${level} title=${title}::${total} tests: ${expected} passed, ${unexpected} failed, ${flaky} flaky, ${skipped} skipped (${seconds} s)${runErrors}`,
);
