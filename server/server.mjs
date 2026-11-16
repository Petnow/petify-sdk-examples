// Petify SDK example server: a DEVELOPMENT EXAMPLE, not a production server.
//
// The example apps hold a Client key (app), which may only create capture
// sessions and upload images. Registering, verifying and identifying pets needs a
// Secret key (server), and a Secret key must never ship inside an app. This
// server holds the Secret key and exposes the few calls the apps need, which
// is the production architecture in miniature: in your product this logic
// belongs in your own backend, behind your own user authentication.
//
// Development only: plain HTTP on your local network, no persistence (sessions
// live in memory), no rate limiting. Every request except GET /health needs
// `Authorization: Bearer <EXAMPLE_SERVER_TOKEN>`; the token stops other devices
// on the same Wi-Fi from using your Secret key.
//
// Run: node server.mjs (Node.js 22+, no dependencies). Configuration: server/.env
// or environment variables (environment variables win). See README.md.

import http from 'node:http';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

// ---------------------------------------------------------------- configuration

// server/.env is optional. loadEnvFile never overrides a variable that is already set.
try {
  process.loadEnvFile(path.join(import.meta.dirname, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}
const setting = (name, fallback = '') => process.env[name] || fallback;

const SECRET_KEY = setting('PETIFY_SECRET_KEY');
const API_BASE_URL = setting('PETIFY_API_BASE_URL', 'https://api.petify.petnow.io').replace(/\/+$/, '');
const HOST = setting('HOST', '0.0.0.0');
const PORT = Number(setting('PORT', '8787'));
const TOKEN_GENERATED = !setting('EXAMPLE_SERVER_TOKEN');
const TOKEN = setting('EXAMPLE_SERVER_TOKEN') || crypto.randomBytes(16).toString('hex');

if (!SECRET_KEY) {
  console.error('PETIFY_SECRET_KEY is not set. Copy .env.example to .env and add a Secret key (server).');
  process.exit(1);
}
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error(`PORT must be a number from 1 to 65535, not "${setting('PORT')}".`);
  process.exit(1);
}

const JSON_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;
const POLL_INTERVAL_MS = 1_000;
const POLL_LIMIT_MS = 30_000;
const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const PET_METADATA = JSON.stringify({ createdBy: 'petify-sdk-example' });

// sessionId -> { purpose: 'identify' | 'register' | 'verify', petId?, registered? }. In memory only.
const sessions = new Map();

// ---------------------------------------------------------------- helpers

class HttpError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function sendJson(res, status, body) {
  if (body === undefined) { res.writeHead(status).end(); return; }
  const text = JSON.stringify(body);
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'content-length': Buffer.byteLength(text) });
  res.end(text);
}

// Petify errors carry only a code: {errors:[{code, details?}]}. A few readable messages for the
// codes this example meets most; the full list is in the Petify error-code reference.
const ERROR_MESSAGES = {
  PETNOWB2B10000: 'The API key is invalid or deactivated',
  PETNOWB2B10005: 'The account has reached the pet limit of its plan',
  PETNOWB2B10010: 'API access for the account is suspended',
  PETNOWB2B10014: 'This route needs a Secret key (server), not a Client key (app)',
  PETNOWB2B20000: 'No pet has this ID, or the pet was deleted',
  PETNOWB2B20010: 'No capture session has this ID',
  PETNOWB2B20012: 'The capture session has no fingerprint image or no appearance image yet',
  PETNOWB2B20014: 'Another job already used this capture session',
};

// Pass Petify's HTTP status and first error code through to the app.
async function petifyError(response) {
  const body = await response.json().catch(() => null);
  const first = body?.errors?.[0];
  const code = first?.code || `HTTP_${response.status}`;
  const message = ERROR_MESSAGES[code]
    || (first?.details ? JSON.stringify(first.details) : `Petify returned HTTP ${response.status}`);
  return new HttpError(response.status, code, message);
}

function networkError(err) {
  if (err?.name === 'TimeoutError') return new HttpError(504, 'petify_timeout', 'Petify did not answer in time');
  return new HttpError(502, 'petify_unreachable', `Could not reach Petify: ${err?.cause?.code || err?.cause?.message || err?.message}`);
}

// One JSON call to the Petify Server API with the Secret key. Returns `data` from the envelope.
async function petify(method, path, body) {
  let response;
  try {
    response = await fetch(API_BASE_URL + path, {
      method,
      headers: { 'x-petnow-api-key': SECRET_KEY, ...(body && { 'content-type': 'application/json' }) },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(JSON_TIMEOUT_MS),
    });
  } catch (err) { throw networkError(err); }
  if (!response.ok) throw await petifyError(response);
  if (response.status === 204) return null;
  return (await response.json()).data;
}

// Poll a job every second until SUCCESS/FAILED; give up after 30 s.
async function pollJob(path) {
  const deadline = Date.now() + POLL_LIMIT_MS;
  while (Date.now() < deadline) {
    const job = await petify('GET', path);
    if (job.status === 'SUCCESS' || job.status === 'FAILED') return job;
    await sleep(POLL_INTERVAL_MS);
  }
  return { status: 'TIMEOUT' };
}

async function readAll(req, limit) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'body_too_large', `Request body is larger than ${limit} bytes`);
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

async function readJson(req) {
  const body = await readAll(req, 16 * 1024);
  if (body.length === 0) return {};
  try { return JSON.parse(body.toString('utf8')); } catch {
    throw new HttpError(400, 'invalid_json', 'Request body is not valid JSON');
  }
}

function knownSession(id) {
  const session = sessions.get(id);
  if (!session) {
    throw new HttpError(404, 'unknown_session',
      'This server does not know this session (sessions live in memory; was the server restarted?)');
  }
  return session;
}

function authorized(req) {
  const given = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1] || '';
  const hash = (s) => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(hash(given), hash(TOKEN));
}

// ---------------------------------------------------------------- handlers

// Petify: GET /v2/pets. The pets this example registered (metadata createdBy, with a
// fingerprint), newest first, for the apps' "verify a pet" list. Your own backend keeps
// its own pet records instead of listing every pet in the account.
async function listPets(req, res) {
  const pets = (await petify('GET', '/v2/pets')) || [];
  const ours = pets
    .filter((pet) => pet.hasFingerprint && createdByExample(pet.metadata))
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
    .slice(0, 20)
    .map((pet) => ({ petId: pet.id, createdAt: pet.createdAt }));
  sendJson(res, 200, { pets: ours });
}

function createdByExample(metadata) {
  try { return JSON.parse(metadata || '{}').createdBy === 'petify-sdk-example'; } catch { return false; }
}

// Petify: POST /v2/pets (register only), POST /v2/capture-sessions.
async function createSession(req, res) {
  const { purpose, species = 'DOG', petId } = await readJson(req);
  if (purpose !== 'identify' && purpose !== 'register' && purpose !== 'verify') {
    throw new HttpError(400, 'invalid_request', 'purpose must be "identify", "register" or "verify"');
  }
  if (species !== 'DOG' && species !== 'CAT') {
    throw new HttpError(400, 'invalid_request', 'species must be "DOG" or "CAT"');
  }

  if (purpose === 'identify') {
    const session = await petify('POST', '/v2/capture-sessions', { species, purpose: 'PET_IDENTIFICATION' });
    sessions.set(session.id, { purpose });
    return sendJson(res, 201, { sessionId: session.id });
  }

  if (purpose === 'verify') {
    if (typeof petId !== 'string' || !/^[0-9a-fA-F-]{36}$/.test(petId)) {
      throw new HttpError(400, 'invalid_request', 'verify needs the petId of a registered pet');
    }
    const session = await petify('POST', '/v2/capture-sessions', { species, purpose: 'PET_VERIFICATION', petId });
    sessions.set(session.id, { purpose, petId });
    return sendJson(res, 201, { sessionId: session.id, petId });
  }

  const pet = await petify('POST', '/v2/pets', { species, metadata: PET_METADATA });
  try {
    const session = await petify('POST', '/v2/capture-sessions', { species, purpose: 'PET_PROFILE_REGISTRATION', petId: pet.id });
    sessions.set(session.id, { purpose, petId: pet.id, registered: false });
    return sendJson(res, 201, { sessionId: session.id, petId: pet.id });
  } catch (err) {
    await petify('DELETE', `/v2/pets/${pet.id}`).catch(() => {}); // don't leave an empty pet behind
    throw err;
  }
}

// Petify: POST /v2/fingerprints:upload or /v2/appearances:upload (body passed through unparsed).
async function uploadImage(req, res, sessionId, kind) {
  knownSession(sessionId);
  const contentType = req.headers['content-type'] || '';
  if (!contentType.startsWith('multipart/form-data')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send the image as multipart/form-data with the field "file"');
  }
  // Send a Content-Length: Petify may drop chunked upload bodies ("No file was submitted").
  // Stream when the app sent a length; otherwise buffer the (small) image first.
  const length = req.headers['content-length'];
  const body = length ? req : await readAll(req, MAX_UPLOAD_BYTES);
  let response;
  try {
    response = await fetch(`${API_BASE_URL}/v2/${kind}:upload?sessionId=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
      body,
      duplex: 'half',
      headers: { 'content-type': contentType, 'x-petnow-api-key': SECRET_KEY, ...(length && { 'content-length': length }) },
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    });
  } catch (err) { throw networkError(err); }
  if (!response.ok) throw await petifyError(response);
  await response.body?.cancel();
  sendJson(res, 204);
}

// Petify: POST /v2/pets/{petId}:addFingerprints, then GET /v2/fingerprint-addition-jobs/{jobId}.
async function register(req, res, sessionId) {
  const session = knownSession(sessionId);
  if (session.purpose !== 'register') {
    throw new HttpError(400, 'wrong_purpose', `This session was created to ${session.purpose}, not to register`);
  }
  const { jobId } = await petify('POST', `/v2/pets/${session.petId}:addFingerprints`, { sessionId });
  const job = await pollJob(`/v2/fingerprint-addition-jobs/${jobId}`);
  if (job.status === 'SUCCESS') session.registered = true;
  sendJson(res, 200, { status: job.status, petId: session.petId });
}

// Petify: POST /v2/pets/{petId}:verify, then GET /v2/verification-jobs/{jobId}.
// isVerified and score are null when the job failed.
async function verify(req, res, sessionId) {
  const session = knownSession(sessionId);
  if (session.purpose !== 'verify') {
    throw new HttpError(400, 'wrong_purpose', `This session was created to ${session.purpose}, not to verify`);
  }
  const { jobId } = await petify('POST', `/v2/pets/${session.petId}:verify`, { sessionId });
  const job = await pollJob(`/v2/verification-jobs/${jobId}`);
  sendJson(res, 200, { status: job.status, petId: session.petId, isVerified: job.isVerified ?? null, score: job.score ?? null });
}

// Petify: POST /v2/pets:identify, then GET /v2/identification-jobs/{jobId}.
async function identify(req, res, sessionId) {
  const session = knownSession(sessionId);
  if (session.purpose !== 'identify') {
    throw new HttpError(400, 'wrong_purpose', `This session was created to ${session.purpose}, not to identify`);
  }
  const { jobId } = await petify('POST', '/v2/pets:identify', { sessionId });
  const job = await pollJob(`/v2/identification-jobs/${jobId}`);
  const candidates = (job.pets || []).map((pet) => ({ petId: pet.id, score: pet.score, isMatch: pet.isMatch }));
  sendJson(res, 200, { status: job.status, candidates });
}

// Petify: DELETE /v2/pets/{petId}, only for a registration that did not succeed.
async function deleteSession(req, res, sessionId) {
  const session = sessions.get(sessionId);
  if (session?.purpose === 'register' && !session.registered) {
    try {
      await petify('DELETE', `/v2/pets/${session.petId}`);
    } catch (err) {
      if (err.status !== 404) throw err; // already gone is fine
    }
  }
  sessions.delete(sessionId);
  sendJson(res, 204);
}

// ---------------------------------------------------------------- routing

async function route(req, res) {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (req.method === 'GET' && pathname === '/health') return sendJson(res, 200, { ok: true });
  if (!authorized(req)) throw new HttpError(401, 'unauthorized', 'Missing or wrong Authorization: Bearer token');

  if (req.method === 'GET' && pathname === '/pets') return listPets(req, res);
  if (req.method === 'POST' && pathname === '/sessions') return createSession(req, res);
  const match = /^\/sessions\/([0-9a-fA-F-]{36})(?:\/(fingerprints|appearances|register|verify|identify))?$/.exec(pathname);
  if (match) {
    const [, id, action] = match;
    if (req.method === 'DELETE' && !action) return deleteSession(req, res, id);
    if (req.method === 'POST' && action === 'fingerprints') return uploadImage(req, res, id, 'fingerprints');
    if (req.method === 'POST' && action === 'appearances') return uploadImage(req, res, id, 'appearances');
    if (req.method === 'POST' && action === 'register') return register(req, res, id);
    if (req.method === 'POST' && action === 'verify') return verify(req, res, id);
    if (req.method === 'POST' && action === 'identify') return identify(req, res, id);
  }
  throw new HttpError(404, 'not_found', `No route for ${req.method} ${pathname}`);
}

const server = http.createServer(async (req, res) => {
  const started = Date.now();
  res.on('finish', () => {
    const path = req.url.split('?')[0];
    console.log(`${req.method} ${path} ${res.statusCode} ${Date.now() - started}ms`);
  });
  try {
    await route(req, res);
  } catch (err) {
    // Unexpected errors are logged here and answered without their details.
    const known = err instanceof HttpError ? err : new HttpError(500, 'internal_error', 'Internal server error');
    if (known !== err) console.error(err);
    if (!res.headersSent) sendJson(res, known.status, { error: known.code, message: known.message });
    if (!req.complete) req.resume(); // drain an unread upload body
  }
});

server.on('error', (err) => {
  console.error(err.code === 'EADDRINUSE'
    ? `Port ${PORT} is already in use. Stop the other process or set PORT.`
    : `Could not start the server: ${err.message}`);
  process.exit(1);
});

// Ctrl+C or a process manager: stop accepting requests and let running ones finish
// (a job poll takes up to 30 s). A second Ctrl+C stops at once.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, () => {
    console.log(`${signal} received, finishing open requests (Ctrl+C again to stop now)`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), POLL_LIMIT_MS + JSON_TIMEOUT_MS).unref();
  });
}

server.listen(PORT, HOST, () => {
  console.log(`Petify SDK example server on http://${HOST}:${PORT} -> ${API_BASE_URL}`);
  const lan = Object.values(os.networkInterfaces()).flat()
    .filter((a) => a && a.family === 'IPv4' && !a.internal && !a.address.startsWith('169.254.'))
    .map((a) => `http://${a.address}:${PORT}`);
  if (HOST === '127.0.0.1' || HOST === 'localhost') {
    console.log('Listening on this machine only. Set HOST=0.0.0.0 to reach it from a phone.');
  } else if (lan.length) {
    console.log('From a phone on the same network use:');
    for (const url of lan) console.log(`  ${url}`);
  } else {
    console.log('No LAN IPv4 address found. Connect this machine to the same network as the phone.');
  }
  console.log('Put that URL and the token into the example app config (see README.md).');
  if (TOKEN_GENERATED) {
    console.log(`Generated token: ${TOKEN}`);
    console.log('Set EXAMPLE_SERVER_TOKEN to keep it across restarts.');
  }
});
