/**
 * Where your app ends and PetNow begins.
 *
 * The SDK runs on the device and gives you images. Everything else — creating a
 * pet, opening a capture session, uploading, registering, identifying,
 * verifying — is a **server** conversation, authenticated with your tenant API
 * key. That key must live on your server: anything shipped in an app can be
 * extracted from it.
 *
 * So your app talks to *your* backend, and your backend to PetNow. This file is
 * that seam; `YourServerBackend` is the shape to copy. (`demo/demoBackend.ts`
 * is a demo implementation that calls PetNow directly so the example can run
 * without a server. Do not ship that.)
 */
import type {CameraResult, DetectionPurpose, Species} from '@petify/react-native-camera-ui';

/** A pet the search came back with, best match first. */
export interface PetnowCandidate {
  petId: string;
  /**
   * Similarity, when your server passes it through. Useful for ranking and
   * debugging — not for deciding. Confirm a candidate with `verify`.
   */
  score?: number;
}

/** The result of a 1:1 check. */
export interface PetnowVerification {
  /** The server's decision. Use this. */
  isMatch: boolean;
  score?: number;
}

/** The five things a capture flow needs from a server. */
export interface PetnowBackend {
  /**
   * Registration and verification are scoped to a pet, so your server creates
   * (or looks up) the pet first — `POST /v2/pets`. Identification is not:
   * return null there.
   */
  resolvePetId(args: {
    species: Species;
    purpose: DetectionPurpose;
  }): Promise<string | null>;

  /**
   * `POST /v2/capture-sessions` — returns the session UUID the SDK needs. A
   * registration or verification session must carry `petId`, or PetNow answers
   * `PETNOWB2B20011` (NoPetIdCaptureSessionError).
   *
   * Call this **once per capture attempt**, not once per pet. A session backs
   * exactly one job: a second registration, identification or verification on
   * it fails with `PETNOWB2B20014` (CaptureSessionAlreadyUsedError). So a
   * retake gets a new session — with the same `petId`, so retrying does not
   * strand an empty pet.
   */
  createCaptureSession(args: {
    species: Species;
    purpose: DetectionPurpose;
    petId?: string | null;
  }): Promise<string>;

  /**
   * Sends the captured files up. The SDK writes them to the app's cache
   * directory, so upload before the OS reclaims the space.
   */
  uploadCapture(sessionId: string, result: CameraResult): Promise<void>;

  /** `:addFingerprints` — what makes a pet verifiable. */
  completeRegistration(args: {
    petId: string;
    sessionId: string;
  }): Promise<boolean>;

  /** 1:N search — `POST /v2/pets:identify`. */
  identify(sessionId: string): Promise<PetnowCandidate[]>;

  /** 1:1 check — `POST /v2/pets/{petId}:verify`. */
  verify(args: {petId: string; sessionId: string}): Promise<PetnowVerification>;
}

/**
 * The shape to copy into your app: one call per endpoint you expose.
 *
 * Your server holds the PetNow API key and makes the PetNow calls noted in each
 * method. What your own endpoints look like is up to you — the point is that
 * the app never sees the key, and the PetNow call order stays on the server
 * where you can test it.
 */
export class YourServerBackend implements PetnowBackend {
  constructor(private readonly baseUrl: string) {}

  resolvePetId(): Promise<string | null> {
    // POST ${this.baseUrl}/pets → your server calls `POST /v2/pets`
    throw new Error('Point this at your own endpoint');
  }

  createCaptureSession(): Promise<string> {
    // POST ${this.baseUrl}/capture-sessions
    //   → your server calls `POST /v2/capture-sessions` and returns the UUID
    throw new Error('Point this at your own endpoint');
  }

  uploadCapture(): Promise<void> {
    // POST ${this.baseUrl}/capture-sessions/:id/images (multipart)
    //   → your server forwards to `/v2/fingerprints:upload` and
    //     `/v2/appearances:upload`
    throw new Error('Point this at your own endpoint');
  }

  completeRegistration(): Promise<boolean> {
    // POST ${this.baseUrl}/pets/:id/register
    //   → your server calls `:addFingerprints` and polls the job
    throw new Error('Point this at your own endpoint');
  }

  identify(): Promise<PetnowCandidate[]> {
    // POST ${this.baseUrl}/identify
    //   → your server calls `/v2/pets:identify` and polls the job
    throw new Error('Point this at your own endpoint');
  }

  verify(): Promise<PetnowVerification> {
    // POST ${this.baseUrl}/pets/:id/verify
    //   → your server calls `:verify` and polls the job
    throw new Error('Point this at your own endpoint');
  }
}
