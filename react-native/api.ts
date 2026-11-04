/**
 * Every network call the app makes. There are two kinds:
 *
 * - Camera-only mode: `createIdentificationSession` calls the Petify API with
 *   the **Client key**. A Client key may open a capture session and upload
 *   images; everything else answers 403 `PETNOWB2B10014`.
 * - Server mode: `ExampleServer` calls the example server, which holds the
 *   Secret key and talks to Petify. Your app should work this way: it asks
 *   *your* server for a session and sends the images there.
 */
import {PETIFY_API_BASE_URL} from './config';

export type Purpose = 'identify' | 'register';

/** A capture session the camera runs on. */
export interface Session {
  id: string;
  purpose: Purpose;
}

/** One pet the identification found, best first. */
export interface Candidate {
  petId: string;
  /** Similarity, 0–100. A hint for ranking, not the decision. */
  score: number;
  /** The server's decision for this candidate. */
  isMatch: boolean;
}

/** How a Petify job ended; TIMEOUT when the server stopped waiting for it. */
export type JobStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT';

const JSON_TIMEOUT_MS = 15_000;
const UPLOAD_TIMEOUT_MS = 60_000;
/** Register and identify wait for the Petify job; the server polls it for up to 30 s. */
const JOB_TIMEOUT_MS = 60_000;

/**
 * `fetch` with a timeout. Returns the parsed JSON body (or null); a status of
 * 400 or more throws `HTTP <status> <code>: <message>`, from either the Petify
 * envelope (`{errors:[{code, message}]}`) or the example server (`{error, message}`).
 */
async function request(url: string, init: RequestInit, timeoutMs: number): Promise<any> {
  const abort = new AbortController();
  const timer = setTimeout(() => abort.abort(), timeoutMs);
  try {
    const response = await fetch(url, {...init, signal: abort.signal});
    const text = await response.text();
    let body: any = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      // Not JSON (a proxy's error page, say); the status still says enough.
    }
    if (response.status >= 400) {
      const error = body?.errors?.[0] ?? body ?? {};
      const code = error.code ?? error.error;
      const message = error.message ?? error.detail;
      throw new Error(
        `HTTP ${response.status}` + (code ? ` ${code}` : '') + (message ? `: ${message}` : ''),
      );
    }
    return body;
  } catch (e) {
    if (abort.signal.aborted) {
      throw new Error(`No answer after ${timeoutMs / 1000} s`);
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------- camera-only

/**
 * Camera-only mode: opens an identification session with the Client key.
 * This call is allowed for a Client key; in production your server creates
 * sessions (as `ExampleServer.createSession` does) and the app gets only the ID.
 */
export async function createIdentificationSession(clientKey: string): Promise<Session> {
  const body = await request(
    `${PETIFY_API_BASE_URL}/v2/capture-sessions`,
    {
      method: 'POST',
      headers: {'x-petnow-api-key': clientKey, 'Content-Type': 'application/json'},
      // Dog only. For cats send species "CAT", and pass species="CAT" to <CameraView>.
      body: JSON.stringify({species: 'DOG', purpose: 'PET_IDENTIFICATION'}),
    },
    JSON_TIMEOUT_MS,
  );
  return {id: body.data.id, purpose: 'identify'};
}

// ---------------------------------------------------------------- server mode

/** The example server's API (see server/README.md). */
export class ExampleServer {
  constructor(
    private readonly url: string,
    private readonly token: string,
  ) {}

  private call(path: string, init: RequestInit = {}, timeoutMs = JSON_TIMEOUT_MS) {
    return request(
      `${this.url}${path}`,
      {...init, headers: {...init.headers, Authorization: `Bearer ${this.token}`}},
      timeoutMs,
    );
  }

  /** For "register" the server also creates the pet the session is for. */
  async createSession(purpose: Purpose): Promise<Session> {
    const body = await this.call('/sessions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({purpose, species: 'DOG'}),
    });
    return {id: body.sessionId, purpose};
  }

  /** One captured image, as multipart field `file`. The SDK hands out file paths. */
  upload(sessionId: string, kind: 'fingerprints' | 'appearances', path: string) {
    const form = new FormData();
    form.append('file', {
      uri: path.startsWith('file://') ? path : `file://${path}`,
      type: 'image/jpeg',
      name: path.split('/').pop() || 'capture.jpg',
    } as unknown as Blob);
    return this.call(`/sessions/${sessionId}/${kind}`, {method: 'POST', body: form}, UPLOAD_TIMEOUT_MS);
  }

  /** Adds the uploaded nose images to the pet. Resolves to `{status, petId}`. */
  register(sessionId: string): Promise<{status: JobStatus; petId: string}> {
    return this.call(`/sessions/${sessionId}/register`, {method: 'POST'}, JOB_TIMEOUT_MS);
  }

  /** Searches your pets. Resolves to `{status, candidates}`. */
  identify(sessionId: string): Promise<{status: JobStatus; candidates: Candidate[]}> {
    return this.call(`/sessions/${sessionId}/identify`, {method: 'POST'}, JOB_TIMEOUT_MS);
  }

  /** Forgets the session; for a registration that did not succeed, the server deletes its pet. */
  deleteSession(sessionId: string): Promise<void> {
    return this.call(`/sessions/${sessionId}`, {method: 'DELETE'});
  }
}
