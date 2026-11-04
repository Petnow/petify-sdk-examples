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
 * The tenant API key authenticates your backend to PetNow; shipping it in a
 * mobile app exposes it. The example calls the B2B API straight from the device
 * only so the whole flow (register / identify / verify) can be tried without
 * standing up a backend first.
 *
 * The endpoints used here are the PetNow B2B v2 contract:
 * ```
 * POST /v2/capture-sessions               {species, purpose[, petId]} -> {data:{id}}
 * POST /v2/pets                           {species}                   -> {data:{id}}
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

  /** `POST /v2/pets` — the pet record fingerprints are attached to. */
  async createPet(species: Species): Promise<string> {
    const data = await this.postJson('/v2/pets', {species});
    return data.id as string;
  }

  /**
   * `PATCH /v2/pets/{petId}` — the pet's free-form metadata, where this demo
   * keeps the profile name. `metadata` is a JSON **string** on the wire.
   */
  async updateMetadata(petId: string, metadata: Record<string, unknown>): Promise<void> {
    const response = await fetch(this.url(`/v2/pets/${petId}`), {
      method: 'PATCH',
      headers: {...this.headers, 'Content-Type': 'application/json'},
      body: JSON.stringify({metadata: JSON.stringify(metadata)}),
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
    const response = await fetch(this.url(`/v2/pets/${petId}`), {
      method: 'DELETE',
      headers: this.headers,
    });
    if (response.status >= 400) {
      await this.envelope(response);
    }
  }

  /** `GET /v2/pets` — the tenant's pets, newest first as returned by the server. */
  async listPets(): Promise<DemoPet[]> {
    const response = await fetch(this.url('/v2/pets'), {headers: this.headers});
    const data = await this.envelope(response);
    return Array.isArray(data) ? data.map(toDemoPet) : [];
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

  /** 1:N search across the tenant's pets. */
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

  private async startJob(path: string, sessionId: string): Promise<string> {
    const data = await this.postJson(path, {sessionId});
    return data.jobId as string;
  }

  private async pollJob(
    path: string,
    {maxAttempts = 30, intervalMs = 1000} = {},
  ): Promise<Record<string, unknown>> {
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const response = await fetch(this.url(path), {headers: this.headers});
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
    const response = await fetch(this.url(path), {
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
    const response = await fetch(this.url(`${path}?sessionId=${sessionId}`), {
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
      const errors = json?.errors;
      const code = Array.isArray(errors) ? errors[0] : undefined;
      throw new Error(`HTTP ${response.status}${code ? ` — ${code}` : ''}`);
    }
    return json?.data;
  }
}

export interface DemoPet {
  id: string;
  name?: string;
  species?: string;
  /**
   * False until `:addFingerprints` succeeds. A pet without fingerprints can not
   * be verified or identified against — the record exists because the capture
   * session has to be scoped to a pet before the camera opens, so an abandoned
   * capture leaves one behind.
   */
  hasFingerprint: boolean;
}

/** A pet's display name: the profile name, else a short form of its id. */
export function petLabel(pet: DemoPet): string {
  return pet.name ?? `${pet.id.split('-')[0]}…`;
}

function toDemoPet(json: Record<string, unknown>): DemoPet {
  return {
    id: json.id as string,
    name: metadataName(json.metadata),
    species: json.species as string | undefined,
    hasFingerprint: json.hasFingerprint === true,
  };
}

/** `metadata` comes back as a JSON string (`"{}"` when empty). */
function metadataName(metadata: unknown): string | undefined {
  let decoded = metadata;
  if (typeof decoded === 'string') {
    try {
      decoded = JSON.parse(decoded);
    } catch {
      return undefined;
    }
  }
  if (decoded && typeof decoded === 'object') {
    const name = (decoded as Record<string, unknown>).name;
    if (typeof name === 'string' && name.length > 0) {
      return name;
    }
  }
  return undefined;
}
