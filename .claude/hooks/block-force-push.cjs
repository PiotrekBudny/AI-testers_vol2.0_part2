const separators = new Set(['&&', '||', ';', '|', '&']);
const safeForceFlags = new Set(['--force-with-lease', '--force-if-includes']);
const optionsWithValue = new Set([
  '-C',
  '-c',
  '--git-dir',
  '--work-tree',
  '--namespace',
  '--super-prefix',
  '--config-env',
]);
const envAssignment = /^[A-Za-z_][A-Za-z0-9_]*=/;

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
  const tokens = [];
  let current = '';
  let quote = null;
  let started = false;
  const flush = () => {
    if (started) {
      tokens.push(current);
    }
    current = '';
    started = false;
  };
  for (let index = 0; index < command.length; index++) {
    const char = command[index];
    if (quote !== null) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      started = true;
      continue;
    }
    if (char === '\n' || char === '\r') {
      flush();
      tokens.push(';');
      continue;
    }
    if (/\s/.test(char)) {
      flush();
      continue;
    }
    const pair = command.slice(index, index + 2);
    if (pair === '&&' || pair === '||') {
      flush();
      tokens.push(pair);
      index++;
      continue;
    }
    if (char === ';' || char === '|' || char === '&') {
      flush();
      tokens.push(char);
      continue;
    }
    current += char;
    started = true;
  }
  flush();
  return tokens;
}

function forceArgument(token) {
  if (token.startsWith('+') && token.length > 1) {
    return token;
  }
  const [flag] = token.split('=');
  if (safeForceFlags.has(flag)) {
    return null;
  }
  if (flag === '--force' || /^-[a-zA-Z]*f[a-zA-Z]*$/.test(flag)) {
    return token;
  }
  return null;
}

function forceInPush(command) {
  const tokens = tokenize(command);
  for (let index = 0; index < tokens.length; index++) {
    if (index !== 0 && !separators.has(tokens[index - 1])) {
      continue;
    }
    let start = index;
    while (start < tokens.length && envAssignment.test(tokens[start])) {
      start++;
    }
    if (tokens[start] !== 'git') {
      continue;
    }
    let cursor = start + 1;
    while (cursor < tokens.length && tokens[cursor].startsWith('-')) {
      cursor += optionsWithValue.has(tokens[cursor]) ? 2 : 1;
    }
    if (tokens[cursor] !== 'push') {
      continue;
    }
    for (let arg = cursor + 1; arg < tokens.length; arg++) {
      if (separators.has(tokens[arg])) {
        break;
      }
      const forced = forceArgument(tokens[arg]);
      if (forced !== null) {
        return forced;
      }
    }
  }
  return null;
}

readStdin().then((raw) => {
  const command = JSON.parse(raw || '{}').tool_input?.command ?? '';
  const forced = forceInPush(command);
  if (forced === null) {
    process.exit(0);
  }
  process.stderr.write(
    `Blocked: "git push ${forced}" rewrites remote history. Use --force-with-lease (optionally with --force-if-includes) instead, or ask the user to run the force push themselves.\n`,
  );
  process.exit(2);
});
