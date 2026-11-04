import type {CameraResult, DetectionPurpose, Species} from '@petify/react-native-camera-ui';

import type {
  PetnowBackend,
  PetnowCandidate,
  PetnowVerification,
} from '../petnowBackend';

/**
 * ⚠️ DEMO ONLY — {@link PetnowBackend} is the seam you should build against;
 * this is the implementation that skips your server so the example runs on its
 * own.
 *
 * It needs a **Secret** API key: registration, identification, verification
 * and the pet list are Server API calls, which a Client (app) key may not make.
 * A Secret key belongs on your server — shipping it in an app exposes it. The
 * example calls the Server API straight from the device only so the whole flow
 * (register / identify / verify) can be tried without standing up a backend.
 *
 * The endpoints used here are the Petify Server API v2:
 * ```
 * POST /v2/capture-sessions               {species, purpose[, petId]} -> {data:{id}}
 * POST /v2/pets                           {species, metadata}         -> {data:{id}}
 * POST /v2/fingerprints:upload?sessionId=  multipart "file"           -> {data:{id}}
 * POST /v2/appearances:upload?sessionId=   multipart "file"           -> {data:{id}}
 * POST /v2/pets/{petId}:addFingerprints   {sessionId}                 -> {data:{jobId}}
 * GET  /v2/fingerprint-addition-jobs/{id}                             -> {data:{status}}
 * POST /v2/pets:identify                  {sessionId}                 -> {data:{jobId}}
 * GET  /v2/identification-jobs/{id}                                   -> {data:{status,pets[]}}
 * POST /v2/pets/{petId}:verify            {sessionId}                 -> {data:{jobId}}
 * GET  /v2/verification-jobs/{id}                                     -> {data:{status,isVerified,score}}
 * ```
 */
export class DemoBackend implements PetnowBackend {
  constructor(
    private readonly apiKey: string,
    /** The Petify Server API: `https://api.petify.petnow.io`. */
    private readonly baseUrl: string,
  ) {}

  private get headers(): Record<string, string> {
    return {'x-petnow-api-key': this.apiKey};
  }

  // -- Sessions and pets ------------------------------------------------------

  /**
   * `POST /v2/pets` — the pet record fingerprints are attached to. Tagged as
   * this example's, so the example only ever offers to delete its own pets.
   */
  async createPet(species: Species): Promise<string> {
    const data = await this.postJson('/v2/pets', {
      species,
      metadata: JSON.stringify(EXAMPLE_TAG),
    });
    return data.id as string;
  }

  /**
   * `PATCH /v2/pets/{petId}` — the pet's free-form metadata, where this demo
   * keeps the name. `metadata` is a JSON **string** on the wire, and a PATCH
   * replaces it whole, so the tag is written again.
   */
  async setName(petId: string, name: string): Promise<void> {
    const response = await this.request(this.url(`/v2/pets/${petId}`), {
      method: 'PATCH',
      headers: {...this.headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({metadata: JSON.stringify({...EXAMPLE_TAG, name})}),
    });
    await this.envelope(response);
  }

  /**
   * `POST /v2/capture-sessions`. Registration and verification are scoped to a
   * pet; omitting `petId` for those fails with `PETNOWB2B20011`
   * (NoPetIdCaptureSessionError).
   *
   * One session backs one job — call this per capture attempt, including
   * retakes, or the second job fails with `PETNOWB2B20014`.
   */
  async createCaptureSession(args: {
    species: Species;
    purpose: DetectionPurpose;
    petId?: string | null;
  }): Promise<string> {
    const data = await this.postJson('/v2/capture-sessions', {
      species: args.species,
      purpose: args.purpose,
      ...(args.petId ? {petId: args.petId} : {}),
    });
    return data.id as string;
  }

  /**
   * `DELETE /v2/pets/{petId}` — removes the pet and, with it, the fingerprints
   * registered against it. There is no fingerprint-only endpoint, and this
   * cannot be undone from the API.
   */
  async deletePet(petId: string): Promise<void> {
    const response = await this.request(this.url(`/v2/pets/${petId}`), {
      method: 'DELETE',
      headers: this.headers,
    });
    if (response.status >= 400) {
      await this.envelope(response);
    }
  }

  /** `GET /v2/pets` — the account's pets, sorted newest first here (the API does not order them). */
  async listPets(): Promise<DemoPet[]> {
    const response = await this.request(this.url('/v2/pets'), {headers: this.headers});
    const data = await this.envelope(response);
    const pets = Array.isArray(data) ? data.map(toDemoPet) : [];
    return pets.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  // -- Upload -----------------------------------------------------------------

  /**
   * Uploads every captured image into `sessionId`: fingerprints (nose) and
   * appearances (face).
   */
  async uploadCapture(sessionId: string, result: CameraResult): Promise<void> {
    for (const path of result.fingerprintImages) {
      await this.upload('/v2/fingerprints:upload', sessionId, path);
    }
    for (const path of result.appearanceImages) {
      await this.upload('/v2/appearances:upload', sessionId, path);
    }
  }

  // -- Jobs -------------------------------------------------------------------

  /** Attaches the session's fingerprints to `petId`; completes the registration. */
  async addFingerprints(petId: string, sessionId: string): Promise<string> {
    const jobId = await this.startJob(`/v2/pets/${petId}:addFingerprints`, sessionId);
    const data = await this.pollJob(`/v2/fingerprint-addition-jobs/${jobId}`);
    return (data.status as string) ?? 'UNKNOWN';
  }

  /** 1:N search across the account's pets. */
  async identify(sessionId: string): Promise<PetnowCandidate[]> {
    const jobId = await this.startJob('/v2/pets:identify', sessionId);
    const data = await this.pollJob(`/v2/identification-jobs/${jobId}`);
    const pets = Array.isArray(data.pets) ? data.pets : [];
    return pets.map((pet: Record<string, unknown>) => ({
      petId: (pet.id as string) ?? '',
      score: typeof pet.score === 'number' ? pet.score : undefined,
    }));
  }

  /**
   * 1:1 check against `petId`. `isVerified` is the server's decision — the
   * score alone is not a verdict.
   */
  async verify(args: {petId: string; sessionId: string}): Promise<PetnowVerification> {
    const jobId = await this.startJob(`/v2/pets/${args.petId}:verify`, args.sessionId);
    const data = await this.pollJob(`/v2/verification-jobs/${jobId}`);
    return {
      isMatch: data.isVerified === true,
      score: typeof data.score === 'number' ? data.score : undefined,
    };
  }

  // -- PetnowBackend ----------------------------------------------------------
  //
  // The interface methods, expressed with the calls above. In your app these
  // bodies become one HTTP call each, to your own server.

  async resolvePetId(args: {
    species: Species;
    purpose: DetectionPurpose;
  }): Promise<string | null> {
    return args.purpose === 'PET_IDENTIFICATION' ? null : this.createPet(args.species);
  }

  async completeRegistration(args: {petId: string; sessionId: string}): Promise<boolean> {
    return (await this.addFingerprints(args.petId, args.sessionId)) === 'SUCCESS';
  }

  // -- Plumbing ---------------------------------------------------------------

  private url(path: string): string {
    return `${this.baseUrl}${path}`;
  }

  /**
   * `fetch` with a deadline. Without one a dead network leaves the guide
   * spinning for as long as the OS keeps the socket, which on a phone can be
   * minutes.
   */
  private async request(
    url: string,
    timeoutOrInit?: number | RequestInit,
    maybeInit?: RequestInit,
  ): Promise<Response> {
    const timeoutMs = typeof timeoutOrInit === 'number' ? timeoutOrInit : REQUEST_TIMEOUT_MS;
    const init = (typeof timeoutOrInit === 'number' ? maybeInit : timeoutOrInit) ?? {};
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, {...init, signal: controller.signal});
    } catch (e) {
      if (controller.signal.aborted) {
        throw new Error(`No answer from the server within ${timeoutMs / 1000} s`);
      }
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  private async startJob(path: string, sessionId: string): Promise<string> {
    const data = await this.postJson(path, {sessionId});
    return data.jobId as string;
  }

  private async pollJob(
    path: string,
    {maxAttempts = 30, intervalMs = 1000} = {},
  ): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await this.request(this.url(path), {headers: this.headers});
      const data = (await this.envelope(response)) as Record<string, unknown>;
      if (data.status === 'SUCCESS' || data.status === 'FAILED') {
        return data;
      }
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
    return {status: 'TIMEOUT'};
  }

  private async postJson(
    path: string,
    body: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const response = await this.request(this.url(path), {
      method: 'POST',
      headers: {...this.headers, 'Content-Type': 'application/json'},
      body: JSON.stringify(body),
    });
    return (await this.envelope(response)) as Record<string, unknown>;
  }

  private async upload(path: string, sessionId: string, filePath: string): Promise<void> {
    const form = new FormData();
    // The field name is `file`; anything else is rejected.
    form.append('file', {
      uri: filePath.startsWith('file://') ? filePath : `file://${filePath}`,
      type: 'image/jpeg',
      name: filePath.split('/').pop() ?? 'capture.jpg',
    } as unknown as Blob);
    const response = await this.request(this.url(`${path}?sessionId=${sessionId}`), UPLOAD_TIMEOUT_MS, {
      method: 'POST',
      headers: this.headers,
      body: form,
    });
    await this.envelope(response);
  }

  /** Unwraps `{data: …}`, turning an error response into a readable error. */
  private async envelope(response: Response): Promise<unknown> {
    const text = await response.text();
    let json: Record<string, unknown> | null = null;
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      json = null;
    }
    if (response.status >= 400) {
      // `{"errors": [{"code": "PETNOWB2B10014", …}]}` — the code is what the
      // error-code reference and support can act on.
      const errors = json?.errors;
      const first = Array.isArray(errors) ? (errors[0] as unknown) : undefined;
      const code =
        typeof first === 'string'
          ? first
          : (first as {code?: unknown} | undefined)?.code;
      throw new Error(`HTTP ${response.status}${typeof code === 'string' ? ` ${code}` : ''}`);
    }
    return json?.data;
  }
}

const REQUEST_TIMEOUT_MS = 15_000;
/** An image upload on a slow connection takes longer than a JSON call. */
const UPLOAD_TIMEOUT_MS = 60_000;

/** What `createPet` writes into `metadata`, and `fromExample` looks for. */
const EXAMPLE_TAG = {createdBy: 'petify-sdk-example'};

export interface DemoPet {
  id: string;
  name?: string;
  species?: string;
  /**
   * Registered by this example. Only these are offered for deletion: the key
   * may belong to an account with real pets in it.
   */
  fromExample: boolean;
  /** ISO 8601, for ordering. */
  createdAt: string;
  /**
   * False until `:addFingerprints` succeeds. A pet without fingerprints can not
   * be verified or identified against — the record exists because the capture
   * session has to be scoped to a pet before the camera opens, so an abandoned
   * capture leaves one behind.
   */
  hasFingerprint: boolean;
}

/** A pet's display name: its name, else a short form of its id. */
export function petLabel(pet: DemoPet): string {
  return pet.name ?? `${pet.id.split('-')[0]}…`;
}

function toDemoPet(json: Record<string, unknown>): DemoPet {
  const metadata = decodeMetadata(json.metadata);
  const name = metadata.name;
  return {
    id: json.id as string,
    name: typeof name === 'string' && name.length > 0 ? name : undefined,
    species: json.species as string | undefined,
    fromExample: metadata.createdBy === EXAMPLE_TAG.createdBy,
    createdAt: typeof json.createdAt === 'string' ? json.createdAt : '',
    hasFingerprint: json.hasFingerprint === true,
  };
}

/** `metadata` comes back as a JSON string (`"{}"` when empty). */
function decodeMetadata(metadata: unknown): Record<string, unknown> {
  let decoded = metadata;
  if (typeof decoded === 'string') {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return {};
    }
  }
  return decoded && typeof decoded === 'object' ? (decoded as Record<string, unknown>) : {};
}
