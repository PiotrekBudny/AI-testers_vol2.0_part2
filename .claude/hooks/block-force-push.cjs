const separators = new Set(['&&', '||', ';', '|', '&']);
const safeForceFlags = new Set(['--force-with-lease', '--force-if-includes']);

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

function tokenize(command) {
  return command
    .replace(/(&&|\|\||[;|&])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token.replace(/^['"]|['"]$/g, ''));
}

function isForceFlag(token) {
  const [flag] = token.split('=');
  if (safeForceFlags.has(flag)) {
    return false;
  }
  if (flag === '--force') {
    return true;
  }
  return /^-[a-zA-Z]*f[a-zA-Z]*$/.test(flag);
}

function forceFlagInPush(command) {
  const tokens = tokenize(command);
  for (let index = 0; index < tokens.length; index++) {
    if (tokens[index] !== 'git') {
      continue;
    }
    let cursor = index + 1;
    while (cursor < tokens.length && tokens[cursor].startsWith('-')) {
      cursor += tokens[cursor] === '-C' || tokens[cursor] === '-c' ? 2 : 1;
    }
    if (tokens[cursor] !== 'push') {
      continue;
    }
    for (let arg = cursor + 1; arg < tokens.length; arg++) {
      if (separators.has(tokens[arg])) {
        break;
      }
      if (isForceFlag(tokens[arg])) {
        return tokens[arg];
      }
    }
  }
  return null;
}

readStdin().then((raw) => {
  const command = JSON.parse(raw || '{}').tool_input?.command ?? '';
  const flag = forceFlagInPush(command);
  if (flag === null) {
    process.exit(0);
  }
  process.stderr.write(
    `Blocked: "git push ${flag}" rewrites remote history. Use --force-with-lease (optionally with --force-if-includes) instead, or ask the user to run the force push themselves.\n`,
  );
  process.exit(2);
});
