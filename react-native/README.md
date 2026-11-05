# React Native example

Home → capture guide (**prewarm**) → camera → result, using the Petify React Native SDK
(`@petify/react-native-camera-ui`) 1.6.0. The same four screens as the iOS and Android examples.

| File | What it shows |
| --- | --- |
| `screens/HomeScreen.tsx` | Identify / Register, and in server mode the **Pets** list: tap a pet to verify it |
| `screens/GuideScreen.tsx` | ① `PetnowPrewarm.start()` when the guide appears; gets the capture session |
| `screens/CameraScreen.tsx` | `<CameraView>`, ② "Getting ready…" until `onPerformanceStats` reports `detectionReadyAtMs`, ③ retry on the open camera with `startDetection()`, ⑤ `engineReused` (also logged to the Metro console) |
| `App.tsx` | ④ `PetnowPrewarm.release()` when the user is back on Home; camera permission; pausing in the background |
| `screens/ResultScreen.tsx` | the captured images; in server mode, sends them to the example server to register, verify or identify |
| `api.ts` | every network call: the camera-only session, and the example server's API |
| `petnowGuidance.ts` | what to tell the user for each reason the SDK rejects a frame |
| `ui.tsx` | the palette, Material icons (from the bundled `assets/fonts/MaterialIcons-Regular.otf`), and shared building blocks |

The app holds a **Client key (app)** only. It runs in one of two modes:

- **Camera-only** (the default): the app opens an identification session with the Client key
  (`POST /v2/capture-sessions`, which a Client key may call), runs the camera and shows what it
  captured. Nothing is uploaded, "Register a pet" stays disabled, and there is no pet list to
  verify against.
- **Server mode**: with the [example server](../server/README.md) running, the server creates the
  sessions, Home lists the pets the example registered, and the result screen sends the images to
  the server to **register**, **verify** (tap a pet in the list: is this the same pet?) or
  **identify** (which of your pets is this?) a pet. The
  Secret key stays in the server. This is how your app should work: it talks to *your* server,
  and your server to Petify.

Dog only. For cats, pass `species: "CAT"` when creating the session and `species="CAT"` to
`<CameraView>`.

## Requirements

- Node.js 22+, and the [React Native environment](https://reactnative.dev/docs/set-up-your-environment)
  for the platforms you build: Xcode 16 + CocoaPods 1.15.2+, JDK 17 + Android SDK 35
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

1. **API Key Management → Create New API Key**, key type **Client key (app)**. This is the SDK
   licence (`usePetnowCamera({apiKey})`). A Client key is enough here: the app only uses the SDK and
   creates a capture session. Client keys need SDK 1.5.0 or later. Keep Secret keys (server) out of
   app code — the example server is where the Secret key goes. The key is shown only once.
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

The login writes a `@petify:registry` line and its token to your user `~/.npmrc`. With
`--namespace petify` only `@petify/*` packages go to CodeArtifact; everything else still comes from
the public npm registry, in this project and your others. The token lasts 12 hours; log in again
when `npm install` fails with E401. Then:

```bash
npm install
```

## 3. Set your API Key

```bash
cp .env.example .env
```

Put the Client key from step 1 in `PETIFY_API_KEY`. `.env` is git-ignored.

For server mode, start the [example server](../server/README.md) and set `EXAMPLE_SERVER_URL` (the
`http://<your computer's LAN address>:8787` it prints at start; the phone must be on the same
network) and `EXAMPLE_SERVER_TOKEN`. Leave both empty for camera-only mode.

The values are inlined into the bundle by Metro, which reads `.env` when it starts: **after editing
`.env`, stop Metro and start it again** (`npm start -- --reset-cache`, then `npm run android` /
`npm run ios` in another terminal). `metro.config.js` makes sure the cache does not serve you the
previous values. A shell variable wins over the file, but only in the terminal that runs Metro:
`PETIFY_API_KEY=... npm start`.

## 4. Build and run

Android:

```bash
npm run android
```

iOS: install the pods, then open `ios/PetnowCameraExample.xcworkspace` once and, under
**Signing & Capabilities**, choose your team and change the bundle identifier to one you can sign
(the template's `org.reactjs.native.example.*` is taken). Then:

```bash
cd ios && pod install && cd ..
npm run ios -- --device
```

## Troubleshooting

See also [Troubleshooting](https://docs.petnow.io/petify/docs/sdk/react-native/getting-started#troubleshooting)
in the guide.

- **`npm install` fails with E401** — the registry token expired; repeat the login in step 2.
- **"Set PETIFY_API_KEY in .env …" on Home** — `.env` is missing or the key is empty; set it and
  restart Metro.
- **"Could not create a capture session: HTTP 401 …"** on the guide — the key is wrong or revoked.
  Put a valid Client key in `.env` and restart Metro.
- **"Camera could not start" with a licence error** on the camera — the SDK refused the key: check
  that it is a Client key from this console and has not been deleted.
- **You fixed `.env` but nothing changed** — Metro is still running with the old values; restart it.
- **Server mode: "No answer after 15 s" or a network error** — the phone cannot reach the server:
  use the LAN address the server prints (not `localhost`), the same Wi-Fi, and allow the
  local-network prompt on iOS. **"HTTP 401 unauthorized"** — `EXAMPLE_SERVER_TOKEN` does not match
  the server's.
- **Signing fails ("No account for team", or the bundle identifier is taken)** — choose your team
  and a bundle identifier of your own under **Signing & Capabilities** (step 4).
- **`pod install` fails with `Encoding::CompatibilityError`** — run `export LANG=en_US.UTF-8` first.

## License

MIT for the example code. The Petify SDK is licensed separately under your Petify agreement. The
Petify and Petnow names are Petnow's and are not covered by the MIT licence. The Material Icons
font in `assets/fonts` is Google's, under CC BY 4.0 (`assets/fonts/MaterialIcons_LICENSE.txt`).
