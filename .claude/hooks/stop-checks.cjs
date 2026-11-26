const { spawnSync } = require('node:child_process');

function readStdin() {
  return new Promise((resolve) => {
    let data = '';
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', (chunk) => {
      data += chunk;
    });
    process.stdin.on('end', () => resolve(data));
  });
}

function runScript(name) {
  const result = spawnSync(`npm run ${name}`, {
    cwd: process.env.CLAUDE_PROJECT_DIR ?? process.cwd(),
    encoding: 'utf8',
    shell: true,
  });
  return {
    ok: result.status === 0,
    output: `${result.stdout ?? ''}${result.stderr ?? ''}`.trim(),
  };
}

readStdin().then((raw) => {
  const alreadyBlocked = JSON.parse(raw || '{}').stop_hook_active === true;
  for (const name of ['typecheck', 'check']) {
    const { ok, output } = runScript(name);
    if (ok) {
      continue;
    }
    if (alreadyBlocked) {
      process.stdout.write(
        JSON.stringify({
          systemMessage: `npm run ${name} still fails after one fix attempt; stopping anyway so you can look:\n${output}`,
        }),
      );
      process.exit(0);
    }
    process.stderr.write(`npm run ${name} failed:\n${output}\n`);
    process.exit(2);
  }
  process.exit(0);
});
