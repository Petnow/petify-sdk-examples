# @petify/react-native-camera-ui — example

A complete capture flow on React Native: the SDK's camera view, the guide messages in
`petnowGuidance.ts`, and the server calls an integration needs in `petnowBackend.ts`.

The screens follow the Petify app: home → the pet's profile (registration only) → the capture
guide → the camera → the scan result. Only the camera is the SDK; the profile page and the guide
are the app's own, and they are here because framing and a filled-in profile are what make a
registration usable.

## SDK 1.6.0: prewarm

The models the camera needs are prepared with `PetnowPrewarm.start()` as soon as the user picks
"Identify" or "Register" (or a pet to verify), while they go through the profile page and the
guide, so the camera opens on a ready engine. They are released with `PetnowPrewarm.release()`
once the user is back on the home screen. Both are in `App.tsx`, in the effects marked ① and ④.

`captureScreen.tsx` shows "Preparing" until detection is ready (②) and logs
`engineReused` to the Metro console (⑤) — `true` when the prewarm took.

## Requirements

- Node 18+, and the [React Native environment](https://reactnative.dev/docs/set-up-your-environment)
  for the platforms you build (Xcode 16 + CocoaPods, JDK 17 + Android SDK 34)
- A device: iOS 16.4+ or Android 9+ (API 28) — the camera does not run in the iOS simulator
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment
  method registered

The SDK is not in this repository: npm downloads `@petify/react-native-camera-ui` (with the native
iOS and Android binaries inside it) from Petnow's AWS CodeArtifact registry with your own
credentials, exactly as the
[React Native Getting Started](https://docs.petnow.io/petify/docs/sdk/react-native/getting-started)
guide describes.

## 1. Issue your keys in the Petify Console

In **My Page** ([guide](https://docs.petnow.io/petify/docs/petify-console)):

1. **API Key Management → create an API Key.** This is the SDK licence (`usePetnowCamera({apiKey})`)
   and, in this example, the key the demo backend calls the Server API with.
2. **Issue the AWS CodeArtifact Key.** These credentials download the SDK.

## 2. Download the SDK (npm, AWS CodeArtifact)

Set the values the console shows for the CodeArtifact Key and log npm in — the same commands as the
guide:

```bash
export AWS_ACCESS_KEY_ID=<from Petify Console>
export AWS_SECRET_ACCESS_KEY=<from Petify Console>
export AWS_DEFAULT_REGION=<from Petify Console>
export PETNOW_CODEARTIFACT_DOMAIN=<from Petify Console>
export PETNOW_AWS_ACCOUNT_ID=<from Petify Console>
export PETNOW_NPM_REPOSITORY=<from Petify Console>

aws codeartifact login --tool npm \
  --domain "$PETNOW_CODEARTIFACT_DOMAIN" \
  --domain-owner "$PETNOW_AWS_ACCOUNT_ID" \
  --repository "$PETNOW_NPM_REPOSITORY" \
  --region "$AWS_DEFAULT_REGION"
```

This points npm at the Petnow registry in `~/.npmrc`; it serves the SDK and proxies the public
packages the app needs. The token lasts 12 hours; log in again when `npm install` fails with E401.
Then:

```bash
npm install
```

## 3. Set your API Key

```bash
cp .env.example .env
```

Put the API Key from step 1 in `PETIFY_API_KEY`. `.env` is git-ignored.

## 4. Build and run

```bash
npm run android
```

```bash
cd ios && pod install && cd ..
npm run ios -- --device
```

On iOS, set your signing team in Xcode (`ios/PetnowCameraExample.xcworkspace`) before the first
device run.

## The API key and the server

`PETIFY_API_KEY` in `.env` is inlined into the bundle at build time. `.env` is gitignored;
`.env.example` is the template. A shell variable wins over the file:
`PETIFY_API_KEY=... npm run android`. Editing `.env` is enough — `metro.config.js` and
`android/app/build.gradle` make sure neither cache serves you the previous key.

The example runs against the **production** Petify backend, the one the console issues keys for.
With a key it runs the whole server flow — create a capture session, upload, then register /
identify / verify — through `demo/demoBackend.ts`. **A registration here is a real pet in your
account**; delete it from "See all" on the home screen. Without a key the camera still runs and the
flow stops at the captured images.

**In your own app, do not do either of these.** Anyone with the app binary can read a bundled key,
and the Server API calls belong on your server: the app should receive only capture session IDs.
`petnowBackend.ts` is the seam — `YourServerBackend` is the shape to copy.

## Troubleshooting

- **`npm install` fails with E401** — the registry token expired; repeat the login in step 2.
- **"License validation failed"** — the key is wrong or revoked; check it in the Petify Console.
- **`pod install` fails with `Encoding::CompatibilityError`** — run `export LANG=en_US.UTF-8` first.

## License

MIT for the example code. The Petify SDK is licensed separately under your Petify agreement. The
bundled Roboto and Material Icons fonts are Apache-2.0; their licences sit next to them.
