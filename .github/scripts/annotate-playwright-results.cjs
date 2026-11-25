const fs = require('node:fs');

const resultsFile = process.argv[2] ?? 'test-results/results.json';
const title = 'Playwright results';

if (!fs.existsSync(resultsFile)) {
  console.log(
    `::warning title=${title}::No test results found in ${resultsFile}`,
  );
  process.exit(0);
}

const { expected, unexpected, flaky, skipped, duration } = JSON.parse(
  fs.readFileSync(resultsFile, 'utf8'),
).stats;
const total = expected + unexpected + flaky + skipped;
const level = unexpected > 0 ? 'error' : flaky > 0 ? 'warning' : 'notice';
const seconds = (duration / 1000).toFixed(1);

console.log(
  `::${level} title=${title}::${total} tests: ${expected} passed, ${unexpected} failed, ${flaky} flaky, ${skipped} skipped (${seconds} s)`,
);
