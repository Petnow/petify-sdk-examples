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
 * The values are a Client key (app) and, optionally, the example server's URL
 * and token. Never put a Secret key here: whatever is inlined ships in the app.
 */
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

/** The variables the bundle is allowed to inline. */
const INLINED_VARS = ['PETIFY_API_KEY', 'EXAMPLE_SERVER_URL', 'EXAMPLE_SERVER_TOKEN'];

const ENV_FILE = path.join(__dirname, '.env');

/**
 * Reads .env into process.env. A variable already set in the shell wins, so
 * `PETIFY_API_KEY=<another key> npm start` still overrides the file.
 */
function loadEnv() {
  let text = '';
  try {
    text = fs.readFileSync(ENV_FILE, 'utf8');
  } catch {
    // No .env: the home screen says the key is missing.
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
