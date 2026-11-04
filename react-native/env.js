/**
 * Build-time configuration for the example, read from a file so you can run
 * it without remembering a shell variable:
 *
 *   cp .env.example .env     # then paste your API key
 *
 * `babel.config.js` calls loadEnv() before
 * `transform-inline-environment-variables` bakes the values into the bundle,
 * and `metro.config.js` mixes fingerprint() into the transform cache key.
 * That second part is not optional: Metro's own cache key covers only the
 * transformer's source — not this file, not .env — so without it, editing
 * .env would leave the previous key in the bundle and the failure looks like
 * a server problem.
 *
 * This is a convenience for running a sample. A shipping app should not carry
 * an API key in its bundle: fetch it from your own server at runtime and hand
 * it to `usePetnowCamera({apiKey})`, the same way this file's value reaches it.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** The variables the bundle is allowed to inline. */
const INLINED_VARS = ['PETIFY_API_KEY'];

const ENV_FILE = path.join(__dirname, '.env');

/**
 * Reads .env into process.env. A variable already set in the shell wins, so
 * `PETIFY_API_KEY=<other tenant> npm start` still overrides the file.
 */
function loadEnv() {
  let text = '';
  try {
    text = fs.readFileSync(ENV_FILE, 'utf8');
  } catch {
    // No .env: the key gets typed on the first screen instead.
  }
  for (const line of text.split('\n')) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!match) {
      continue; // blank, or a # comment
    }
    const [, name, rawValue] = match;
    if (process.env[name] !== undefined) {
      continue;
    }
    process.env[name] = rawValue.trim().replace(/^(['"])(.*)\1$/, '$2');
  }
}

/** Changes whenever a value that gets inlined changes. */
function fingerprint() {
  loadEnv();
  const values = INLINED_VARS.map(
    name => `${name}=${process.env[name] ?? ''}`,
  ).join('\n');
  return crypto.createHash('sha1').update(values).digest('hex').slice(0, 12);
}

module.exports = {INLINED_VARS, loadEnv, fingerprint};
