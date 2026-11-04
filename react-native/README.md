# @petify/react-native-camera-ui — example

A complete capture flow on React Native: the SDK's camera view, the guide messages in
`petnowGuidance.ts`, and the server calls an integration needs in `petnowBackend.ts`.

The screens: home → which animal → the capture guide → the camera → the scan result, for the three
things the SDK does — register, identify and verify a pet. Only the camera is the SDK; the guide is
the app's own, and it is here because framing is what decides whether a scan succeeds.

## SDK 1.6.0: prewarm

The models the camera needs are prepared with `PetnowPrewarm.start()` as soon as the user picks
"Identify" or "Register" (or a pet to verify), while they read the guide, so the camera opens on a
ready engine. They are released with `PetnowPrewarm.release()` once the user is back on the home
screen. Both are in `App.tsx`, in the effects marked ① and ④.

`captureScreen.tsx` shows "Preparing" until `performanceStats.detectionReadyAtMs` says detection is
ready (②), scans again on the open camera (③), and logs `engineReused` to the Metro console (⑤) —
`true` when the prewarm took.

## Requirements

- Node 18.18+, and the [React Native environment](https://reactnative.dev/docs/set-up-your-environment)
  for the platforms you build: Xcode 16 + CocoaPods 1.15+, JDK 17 + Android SDK 35
- A device: iOS 16.4+ or Android 9+ (API 28) — the camera does not run in the iOS simulator
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (2.15 or later)
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment
  method registered

The SDK is not in this repository: npm downloads `@petify/react-native-camera-ui` (with the native
iOS and Android binaries inside it) from Petnow's AWS CodeArtifact registry with your own
credentials, exactly as the
[React Native Getting Started](https://docs.petnow.io/petify/docs/sdk/react-native/getting-started)
guide describes.

Run the commands below from this folder (`cd react-native`).

## 1. Issue your keys in the Petify Console

In **Integration → API & SDK** ([guide](https://docs.petnow.io/petify/docs/petify-console); older
consoles had these under **My Page**):

1. **API Key Management → Create New API Key**, key type **Secret key (server)**. The SDK uses it as
   its licence (`usePetnowCamera({apiKey})`), and the example's demo backend calls the Server API
   with it to register, identify and verify — which a Client key may not do. That is fine for a
   sample on your own device and wrong for an app you ship: see
   [The API key and the server](#the-api-key-and-the-server). The key is shown only once.
2. **AWS CodeArtifact Key Management → Create New Key.** These credentials download the SDK. The
   popup shows them **only once** — save them before you close it.

## 2. Download the SDK (npm, AWS CodeArtifact)

Set the values from the CodeArtifact popup under these names:

| Console popup | Environment variable |
| --- | --- |
| Access Key ID | `AWS_ACCESS_KEY_ID` |
| Secret Access Key | `AWS_SECRET_ACCESS_KEY` |
| AWS Region | `AWS_DEFAULT_REGION` |
| CodeArtifact Domain | `PETNOW_CODEARTIFACT_DOMAIN` |
| AWS Account ID | `PETNOW_AWS_ACCOUNT_ID` |
| *(not shown)* | `PETNOW_NPM_REPOSITORY=petnow-npm` |

The popup lists repositories for iOS and Android only; the React Native package is in
`petnow-npm`. Its **Copy All** button uses other names (`SDK_CONFIG_AWS_REGION`, …) and no `export`,
so rename the values as above rather than pasting them as they are. Then log npm in — the same
command as the guide:

```bash
# So an AWS profile or session already in your shell does not override the Console keys.
unset AWS_PROFILE AWS_SESSION_TOKEN

export AWS_ACCESS_KEY_ID=<Access Key ID>
export AWS_SECRET_ACCESS_KEY=<Secret Access Key>
export AWS_DEFAULT_REGION=<AWS Region>
export PETNOW_CODEARTIFACT_DOMAIN=<CodeArtifact Domain>
export PETNOW_AWS_ACCOUNT_ID=<AWS Account ID>
export PETNOW_NPM_REPOSITORY=petnow-npm

aws codeartifact login --tool npm \
  --namespace petify \
  --domain "$PETNOW_CODEARTIFACT_DOMAIN" \
  --domain-owner "$PETNOW_AWS_ACCOUNT_ID" \
  --repository "$PETNOW_NPM_REPOSITORY" \
  --region "$AWS_DEFAULT_REGION"
```

`--namespace petify` sends only `@petify/*` packages to CodeArtifact; everything else still comes
from the public npm registry, and your other projects are unaffected. The token lasts 12 hours; log
in again when `npm install` fails with E401. Then:

```bash
npm install
```

## 3. Set your API Key

```bash
cp .env.example .env
```

Put the Secret key from step 1 in `PETIFY_API_KEY`. `.env` is git-ignored.

## 4. Build and run

```bash
npm run android
```

```bash
cd ios && pod install && cd ..
npm run ios -- --device
```

On iOS, open `ios/PetnowCameraExample.xcworkspace` before the first device run and, under
**Signing & Capabilities**, choose your team and change the bundle identifier to one you can sign
(the template's `org.reactjs.native.example.*` is taken).

## The API key and the server

`PETIFY_API_KEY` in `.env` is inlined into the bundle at build time. `.env` is git-ignored;
`.env.example` is the template. A shell variable wins over the file:
`PETIFY_API_KEY=... npm run android`. Editing `.env` is enough — `metro.config.js` and
`android/app/build.gradle` make sure neither cache serves you the previous key.

The example runs against the **production** Petify backend, the one the console issues keys for.
It runs the whole server flow — create a capture session, upload, then register / identify /
verify — through `demo/demoBackend.ts`. **A registration here is a real pet in your account**;
delete it from "See all" on the home screen (the example only offers to delete pets it registered
itself). Without a key the home screen says so, and the camera does not start.

**In your own app, do neither of these.** Anyone with the app binary can read a bundled key, so an
app carries a **Client key (app)** at most — enough for the SDK, which needs SDK 1.5.0 or later —
and never a Secret key. The Server API calls belong on your server: the app should receive only
capture session IDs. `petnowBackend.ts` is the seam — `YourServerBackend` is the shape to copy.

## Troubleshooting

See also [Troubleshooting](https://docs.petnow.io/petify/docs/sdk/react-native/getting-started#troubleshooting)
in the guide.

- **`npm install` fails with E401** — the registry token expired; repeat the login in step 2.
- **The camera shows a licence error** — the key is wrong or revoked; check it in the Petify Console.
- **Register, identify or "See all" fail with 403 `PETNOWB2B10014`** — the key is a Client key; this
  example needs a Secret key (step 1).
- **`pod install` fails with `Encoding::CompatibilityError`** — run `export LANG=en_US.UTF-8` first.

## License

MIT for the example code. The Petify SDK is licensed separately under your Petify agreement. The
bundled Material Icons font is Apache-2.0; its licence sits next to it.
