# Example server

A small development server that lets the example apps register, verify and
identify pets without a Secret key on the phone.

The apps hold a **Client key (app)**. A Client key may create capture sessions
and upload images, nothing else. Registering, verifying and identifying need a **Secret
key (server)**, and a Secret key must never ship inside an app. This server
holds the Secret key and exposes the few calls the apps need. It is the
production architecture in miniature: in your product, the same logic lives in
your own backend.

```
App (Client key)  ──►  this server (Secret key)  ──►  Petify Server API
   capture              create pet / session            api.petify.petnow.io
                        upload, register, verify, identify
```

Without the server the apps run in camera-only mode: you can capture, but
nothing is uploaded, and registering and verifying are disabled.

## Requirements

- Node.js 18 or newer. No dependencies, no `npm install`.
- A Secret key (server) from the Petify Console → Integration → API & SDK.
- The phone and this machine on the same network.

## Run

```sh
cd server
cp .env.example .env    # then set PETIFY_SECRET_KEY in .env
npm start               # or: node server.mjs
```

At start the server prints the URL(s) a phone on the same network should use,
for example `http://192.168.0.10:8787`. If you did not set
`EXAMPLE_SERVER_TOKEN`, it also prints a generated token once; set
`EXAMPLE_SERVER_TOKEN` in `.env` to keep it across restarts.

| Variable | Default | |
|---|---|---|
| `PETIFY_SECRET_KEY` | — | Required. Secret key (server). |
| `EXAMPLE_SERVER_TOKEN` | random, printed at start | Token the apps must send. |
| `HOST` | `0.0.0.0` | `127.0.0.1` keeps it on this machine. |
| `PORT` | `8787` | |
| `PETIFY_API_BASE_URL` | `https://api.petify.petnow.io` | |

Environment variables override `.env`.

## Point an example app at it

Each app needs the server URL and the token. Both go in the app's git-ignored
local config file, next to its Client key:

| App | File | Settings |
|---|---|---|
| iOS | `ios/Config/Secrets.xcconfig` | `EXAMPLE_SERVER_HOST = 192.168.0.10:8787` (no `http://`: xcconfig treats `//` as a comment; the app adds it) and `EXAMPLE_SERVER_TOKEN` |
| Android | `android/local.properties` | `example.serverUrl=http://192.168.0.10:8787` and `example.serverToken` |
| React Native | `react-native/.env` | `EXAMPLE_SERVER_URL` and `EXAMPLE_SERVER_TOKEN` |
| Flutter | `flutter/.env` | `EXAMPLE_SERVER_URL` and `EXAMPLE_SERVER_TOKEN` |

Leave them empty to go back to camera-only mode.

## API

Every request except `GET /health` needs `Authorization: Bearer <EXAMPLE_SERVER_TOKEN>`,
otherwise `401 {"error":"unauthorized"}`. Responses are JSON. Errors are
`{"error":"<code>","message":"<text>"}` with the HTTP status; Petify errors keep
Petify's status and error code (for example `400 PETNOWB2B20012`).

| Method & path | Body | Petify calls | Response |
|---|---|---|---|
| `GET /health` | — | — | `200 {"ok":true}` |
| `GET /pets` | — | `GET /v2/pets`, keeping the pets this server registered (newest first, at most 20) | `200 {"pets":[{"petId","createdAt"}]}` |
| `POST /sessions` | `{"purpose":"identify"\|"register"\|"verify","species":"DOG"\|"CAT","petId"?}` | register: `POST /v2/pets`, then `POST /v2/capture-sessions` (`PET_PROFILE_REGISTRATION`, `petId`); verify (`petId` required): `POST /v2/capture-sessions` (`PET_VERIFICATION`, `petId`); identify: `POST /v2/capture-sessions` (`PET_IDENTIFICATION`) | `201 {"sessionId","petId"?}` |
| `POST /sessions/{id}/fingerprints` | multipart, field `file` | `POST /v2/fingerprints:upload?sessionId={id}` (streamed through) | `204` |
| `POST /sessions/{id}/appearances` | multipart, field `file` | `POST /v2/appearances:upload?sessionId={id}` (streamed through) | `204` |
| `POST /sessions/{id}/register` | — | `POST /v2/pets/{petId}:addFingerprints`, then poll `GET /v2/fingerprint-addition-jobs/{jobId}` | `200 {"status","petId"}` |
| `POST /sessions/{id}/verify` | — | `POST /v2/pets/{petId}:verify`, then poll `GET /v2/verification-jobs/{jobId}` | `200 {"status","petId","isVerified","score"}` |
| `POST /sessions/{id}/identify` | — | `POST /v2/pets:identify`, then poll `GET /v2/identification-jobs/{jobId}` | `200 {"status","candidates":[{"petId","score","isMatch"}]}` |
| `DELETE /sessions/{id}` | — | `DELETE /v2/pets/{petId}` if it was an unfinished registration | `204` |

`status` is `SUCCESS` or `FAILED` from Petify, or `TIMEOUT` if the job did not
end within 30 seconds (the server polls once a second). `isVerified` and
`score` are `null` when a verification failed. Use `isVerified` and `isMatch`,
Petify's decisions, rather than a score cut-off. Candidates are sorted closest
match first. A job route answers `400 wrong_purpose` for a session created for
another purpose. Timeouts towards Petify: 15 s per JSON call, 60 s per
upload. Uploads are passed through without parsing, always with a
`Content-Length` (Petify can drop chunked upload bodies): streamed when the app
sends a length, buffered first when it does not.

Sessions are kept in memory. After a restart the server answers
`404 unknown_session` for older sessions; start a new capture.

## Cleanup

Registering creates the pet first, so an abandoned registration would leave an
empty pet in your account. The apps call `DELETE /sessions/{id}` when you leave
a registration without a successful register (Back, Close, or a failed
register), and the server then deletes the pet it created. A registered pet is
never deleted by the server.

Pets created by this server carry the metadata `{"createdBy":"petify-sdk-example"}`,
so you can find them in the Console or with `GET /v2/pets`. `GET /pets` lists
only those, for the apps' list of pets to verify; your own backend keeps its own
pet records instead.

## Security notes

This is a development example:

- Plain HTTP on your local network. Anyone who can see the traffic can see the
  token.
- The token is the only protection for your Secret key on the network. Do not
  share it, and stop the server when you are done.
- No persistence, no rate limiting, no user accounts.
- The server never logs the Secret key, the token (except a generated token,
  once at start) or request bodies. It logs one line per request: method,
  path, status, duration.

For production, put this logic into your real backend: behind your own user
authentication, over HTTPS, with the Secret key in your secret store, and with
your own rules for which user may register, verify or identify which pet.
