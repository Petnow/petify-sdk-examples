# Petify SDK examples

Small apps that show how to integrate the [Petify](https://docs.petnow.io/petify/docs) nose-print camera SDK.
They follow the flow most apps have, and put the SDK calls where they belong in it:

```
Home ──▶ Capture guide ──▶ Camera ──▶ Result
            │                 │
            │ ① prewarm       │ ② guide from detection feedback
            │                 │ ③ retry without restarting the camera
            ◀──────── ④ release when the user leaves the flow
                              ⑤ engine ready at camera start? (engineReused)
```

| Folder | Platform | SDK package |
| --- | --- | --- |
| [`ios/`](ios/README.md) | iOS 16.4+, SwiftUI | `petnow.ui` 1.6.0 (Swift package registry) |
| [`android/`](android/README.md) | Android 9+ (API 28), Jetpack Compose | `io.petnow:ui:1.6.0` (Maven) |
| [`react-native/`](react-native/README.md) | React Native 0.76, New Architecture | `@petify/react-native-camera-ui` 1.6.0 (npm) |
| [`flutter/`](flutter/README.md) | Flutter 3.41+ | `petnow_camera_ui` 1.6.0 (zip from CodeArtifact) |
| [`server/`](server/README.md) | Node.js 18+ | — (the optional example server; holds the Secret key) |

All four apps are the same app: the four screens above, the same numbered comments ①–⑤, the same
wording. Each runs in one of two modes:

- **Camera-only** (just a Client key): the app opens an identification capture session and captures.
  Nothing is uploaded.
- **Server mode** (Client key + [`server/`](server/README.md)): the app can also register, verify (1:1)
  and identify (1:N) a pet. Home lists the pets you registered; tap one to verify it. The app uploads
  the images to the example server, which holds the Secret key and calls the Petify Server API — your
  production architecture in miniature.

**Apps hold a Client key (app) only; the Secret key (server) lives only in the example server.**

## What the examples show (SDK 1.6.0)

**① Prewarm on the screen before the camera.** Starting a camera used to load and compile the
detection models on the spot, which takes one to several seconds depending on the phone. Since 1.6.0
you can do that earlier: call `prewarm` when the screen that leads to the camera appears (here, the
capture guide). The user reads the guide for a few seconds, the models load meanwhile, and the camera
opens on a ready engine. `prewarm` is fire-and-forget: it never throws, and a camera that opens before
it finishes simply joins it. Call it without a species unless you know which one will be captured.

**② Preview is not detection.** Since 1.6.0 the preview appears as soon as the camera runs, which can
be before the models are ready. Drive your guidance from the detection status, and treat
`performanceStats.phases.detectionReadyAtMs` as the moment detection begins.

**③ Retry with `startDetection()`.** After a failed capture the camera is still open; start detection
again instead of reopening the screen.

**④ Release when the user leaves the flow.** `releasePrewarmed()` frees the prepared models. Call it when
the user goes back to where the flow started — not when the guide screen disappears, which also happens
on the way into the camera. It is optional: the SDK also releases them under memory pressure.

**⑤ Check that it worked.** `phases.engineReused` is `true` when the engine was already built when the
camera started: after a finished prewarm, or when an earlier camera left it. It is `false` when the camera
built the engine itself — on iOS also when it joined a prewarm that was still building.

See the [SDK 1.6.0 release notes](https://docs.petnow.io/petify/docs/sdk/changelog) for the full list of changes.

## Try it yourself

The SDK is **not** in this repository. Each app downloads it the way your own app will, following
the [Petify docs](https://docs.petnow.io/petify/docs/sdk):

1. **Petify Console** ([guide](https://docs.petnow.io/petify/docs/petify-console)) — sign up, register a
   payment method, then in **Integration → API & SDK** (older consoles: **My Page**) create an
   **API Key** (the SDK licence) and an **AWS CodeArtifact Key** (the credentials that download the SDK;
   shown only once, so save them). Which key goes where:

   | Where | API key type | What it may do |
   | --- | --- | --- |
   | Every app (iOS, Android, React Native, Flutter) | **Client key (app)** | Run the SDK, create a capture session, upload images. Needs SDK 1.5.0+. |
   | `server/` (optional) | **Secret key (server)** | Everything else: create and list pets, register, verify, identify, delete. Never put it in an app. |

2. **Download the SDK** with the CodeArtifact Key, as the platform's Getting Started guide describes:
   [iOS](https://docs.petnow.io/petify/docs/sdk/ios/getting-started) (Swift Package Manager),
   [Android](https://docs.petnow.io/petify/docs/sdk/android/getting-started) (Gradle),
   [React Native](https://docs.petnow.io/petify/docs/sdk/react-native/getting-started) (npm),
   Flutter (zip from CodeArtifact, see [`flutter/README.md`](flutter/README.md)).
3. **Set your Client key** in the app's git-ignored local file. The setting is named differently per platform:
   `PETNOW_API_KEY` in `ios/Config/Secrets.xcconfig`, `petnow.apiKey` in `android/local.properties`,
   `PETIFY_API_KEY` in `react-native/.env` and `flutter/.env`.
4. **Build and run** on a device.
5. *(Optional)* **Run [`server/`](server/README.md)** with a Secret key and give the app its URL and token
   to register, verify and identify.

Each platform's README walks through these four steps with the exact commands, including which Console
value goes into which environment variable.

### Quick build

Once the CodeArtifact variables from step 2 of the platform README are exported:

```bash
# iOS — details in ios/README.md
cd ios
./scripts/setup-registry.sh
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig   # set PETNOW_API_KEY, your team ID and a bundle ID you can sign
open PrewarmExample.xcworkspace                              # run on your iPhone
```

```bash
# Android — CODEARTIFACT_URL and CODEARTIFACT_AUTH_TOKEN as in android/README.md
cd android
cp local.properties.example local.properties   # set petnow.apiKey
./gradlew :app:installDebug
```

```bash
# React Native — details in react-native/README.md
cd react-native
aws codeartifact login --tool npm --namespace petify --domain "$PETNOW_CODEARTIFACT_DOMAIN" \
  --domain-owner "$PETNOW_AWS_ACCOUNT_ID" --repository petnow-npm --region "$AWS_DEFAULT_REGION"
npm install
cp .env.example .env   # set PETIFY_API_KEY
npm run android        # or: cd ios && pod install && cd .. && npm run ios -- --device
```

```bash
# Flutter — download the package zip as in flutter/README.md, then
cd flutter
mkdir -p vendor && unzip petnow-flutter-1.6.0.zip -d vendor
cp .env.example .env   # set PETIFY_API_KEY
flutter run --release --dart-define-from-file=.env
```

```bash
# Example server (optional) — details in server/README.md
cd server
cp .env.example .env   # set PETIFY_SECRET_KEY (a Secret key)
npm start              # prints the URL and token for the apps
```

## Capture sessions

Every capture belongs to a capture session that **your server** creates with the Petify Server API and
hands to the app as an ID.

- In **camera-only mode** the apps create an identification session themselves with their Client key —
  one of the few calls a Client key may make — and stop at capture: nothing is identified and no pet is
  stored. That shortcut is marked *example only*.
- In **server mode** the example server creates the session (and, for a registration, the pet), lists the
  pets to verify, receives the images, and makes every other Server API call — as your server will.

All apps run against the **production** backend, where Petify Console keys are issued. **A registration in
server mode is a real pet in your account.** The server tags the pets it creates with the metadata
`{"createdBy":"petify-sdk-example"}`, and deletes the pet when a registration is abandoned.

## Security notes

- No keys, tokens or account identifiers are committed. `Secrets.xcconfig`, `local.properties`, every
  `.env` and the Swift registry configuration are git-ignored; the repository only contains `*.example`
  templates. The downloaded Flutter package (`flutter/vendor/`) is git-ignored too.
- The Secret key is read only by `server/`. The example server is for development: plain HTTP on your
  local network, guarded by a token. In production, keep that logic in your own backend behind your own
  authentication and HTTPS.
- Generated lockfiles are git-ignored too. `react-native/package-lock.json` records the CodeArtifact
  URLs it resolved from, which contain your AWS account ID, domain and region;
  `react-native/ios/Podfile.lock` and the iOS workspace's `Package.resolved` are left to your machine
  along with it. Commit your own only if your policy allows registry URLs in the repository.
- The examples compile the API key into the app for convenience. Anyone with the app binary can read it
  back out. See [API key security](https://docs.petnow.io/petify/docs/sdk/ios/getting-started#api-key-security) in the docs
  before you ship.
- To report a security issue, see [SECURITY.md](SECURITY.md).

## License

The example code is released under the [MIT License](LICENSE). The Petify SDK it depends on is **not**
part of this repository and is licensed separately under your Petify agreement.

The Petify and Petnow names and logos belong to Petnow and are **not** licensed under MIT. See
[NOTICE](NOTICE).
