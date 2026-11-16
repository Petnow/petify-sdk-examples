/**
 * The example's configuration, from `.env` (see `.env.example` and env.js).
 * Babel inlines these values into the bundle when Metro builds it, so restart
 * Metro after editing `.env`.
 */
declare const process: {
  env: {
    PETIFY_API_KEY?: string;
    EXAMPLE_SERVER_URL?: string;
    EXAMPLE_SERVER_TOKEN?: string;
  };
};

/**
 * A **Client key (app)** from the Petify Console. It is the SDK licence, and it
 * may also open a capture session and upload images — nothing more. Never put
 * a Secret key in an app: anything shipped in an app can be read out of it.
 */
export const PETIFY_API_KEY = (process.env.PETIFY_API_KEY ?? '').trim();

/** The Petify API the console issues keys for. */
export const PETIFY_API_BASE_URL = 'https://api.petify.petnow.io';

const serverUrl = (process.env.EXAMPLE_SERVER_URL ?? '').trim().replace(/\/+$/, '');
const serverToken = (process.env.EXAMPLE_SERVER_TOKEN ?? '').trim();

/**
 * The example server (`server/` in the examples repository), which holds the
 * Secret key and runs the server side of registration and identification.
 * Null = **camera-only mode**: the app captures, but nothing is uploaded.
 */
export const EXAMPLE_SERVER: {url: string; token: string} | null =
  serverUrl && serverToken ? {url: serverUrl, token: serverToken} : null;

/** Set when only one of the two server variables is, which is a typo, not a choice. */
export const EXAMPLE_SERVER_HALF_SET = Boolean(serverUrl) !== Boolean(serverToken);
