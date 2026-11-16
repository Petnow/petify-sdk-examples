# Flutter example

Home → capture guide (**prewarm**) → camera → result, using the Petify Flutter plugin
(`petnow_camera_ui`) 1.6.0. The numbered comments ①–⑤ mark the same steps as the iOS, Android and
React Native examples.

| File | What it shows |
| --- | --- |
| `lib/guide_screen.dart` | ① `controller.prewarm()` when the guide appears; the camera permission |
| `lib/camera_screen.dart` | `PetnowCameraView`, ② guidance after `onPerformanceStats` reports `detectionReadyAtMs`, ③ retry with `startDetection()` showing `CameraResult.failureReason`, `onError` code and message, ⑤ `engineReused` (console) |
| `lib/main.dart` | Home (in server mode, the registered pets to verify); ④ `controller.releasePrewarmed()` once the flow returns home |
| `lib/result_screen.dart` | image counts, ⑤ `engineReused`, and in server mode Send → register / verify / identify |
| `lib/example_api.dart` | creates the capture session and calls the example server — **example only**, your server does this |
| `lib/petnow_guidance.dart` | detection status → one line for the user (copy and edit) |
| `lib/petify_theme.dart` | the example's colours (the SDK's camera overlay keeps its own) |
| `lib/quickstart.dart` | the bare integration in one file: `flutter run -t lib/quickstart.dart …` |

The app runs in one of two modes:

- **Camera-only** (just a Client key): the app creates an identification capture session itself and
  captures. Nothing is uploaded; "Register a pet" is disabled and there is no pet list to verify.
- **Server mode** (Client key + the [example server](#optional-the-example-server)): register,
  verify and identify a pet. The app uploads the images to the example server, which holds the Secret key and
  calls the Petify Server API.

## Requirements

- Flutter 3.41 or later, and a phone: Android 9 (API 28) or later, or an iPhone on iOS 16.4+
  (simulators and emulators have no usable camera)
- Android: JDK 17. iOS: Xcode 16 or later and CocoaPods
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (2.15 or
  later), to download the plugin
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment method registered

## 1. Issue your keys in the Petify Console

In **Integration → API & SDK** ([guide](https://docs.petnow.io/petify/docs/petify-console); older consoles
had these under **My Page**):

1. **API Key Management → Create New API Key**, key type **Client key (app)**. This is the SDK licence
   (`LicenseInfo(apiKey: …)`). A Client key is all an app ever holds: it runs the SDK, creates capture
   sessions and uploads images. Registering and identifying need a Secret key (server), which only the
   example server holds. Client keys need SDK 1.5.0 or later. Keep Secret keys (server) out of app
   code. The key is shown only once.
2. **AWS CodeArtifact Key Management → Create New Key.** These credentials download the plugin. The
   popup shows them **only once** — save them before you close it.

## 2. Get the plugin

The plugin and both SDK binaries ship as one zip, `petnow-flutter-1.6.0.zip`, in Petnow's AWS
CodeArtifact (a generic package).

**If you are reading this inside the unzipped package** (`petnow-flutter-1.6.0/example/`), you already
have it: `pubspec.yaml` points at the plugin one folder up (`path: ../`). Go to step 3.

**If you are in the `flutter/` folder of the examples repository**, download the zip and unzip it into
`vendor/`. Set the values from the CodeArtifact popup under these names (the popup's **Copy All**
uses other names and no `export`, so rename the values rather than pasting them as they are):

```bash
cd flutter
# So an AWS profile or session already in your shell does not override the Console keys.
unset AWS_PROFILE AWS_SESSION_TOKEN

export AWS_ACCESS_KEY_ID=<Access Key ID>
export AWS_SECRET_ACCESS_KEY=<Secret Access Key>
export AWS_DEFAULT_REGION=<AWS Region>
export PETNOW_CODEARTIFACT_DOMAIN=<CodeArtifact Domain>
export PETNOW_AWS_ACCOUNT_ID=<AWS Account ID>
export PETNOW_FLUTTER_REPOSITORY=petnow-flutter

aws codeartifact get-package-version-asset \
  --domain "$PETNOW_CODEARTIFACT_DOMAIN" --domain-owner "$PETNOW_AWS_ACCOUNT_ID" \
  --repository "$PETNOW_FLUTTER_REPOSITORY" --format generic \
  --namespace petnow --package petnow-flutter --package-version 1.6.0 \
  --asset petnow-flutter-1.6.0.zip petnow-flutter-1.6.0.zip

mkdir -p vendor && unzip petnow-flutter-1.6.0.zip -d vendor
# -> flutter/vendor/petnow-flutter-1.6.0/
```

`pubspec.yaml` there already reads `path: vendor/petnow-flutter-1.6.0`. Keep the unzipped folder as it
is: the plugin finds the Android SDK (`petnow-maven/`) and the iOS SDK (`ios/Frameworks/`) relative to
itself. `vendor/` is git-ignored.

## 3. Set your API Key

```bash
cp .env.example .env
```

Edit `.env` (git-ignored): `PETIFY_API_KEY` — the Client key from step 1. Leave `EXAMPLE_SERVER_URL`
and `EXAMPLE_SERVER_TOKEN` unset for camera-only mode. The values are compiled in by
`--dart-define-from-file`, so rebuild after editing `.env`.

## 4. Build and run

```bash
flutter pub get
flutter run --release --dart-define-from-file=.env
```

`--release` because iOS refuses to launch a debug Flutter app from the home screen. For iOS, open
`ios/Runner.xcworkspace` once and set your own Team and Bundle Identifier under Runner → Signing &
Capabilities.

The app talks to production (`https://api.petify.petnow.io`).

## Optional: the example server

To register, verify and identify, run the example server from the examples repository —
[`../server/README.md`](../server/README.md)
([on GitHub](https://github.com/Petnow/petify-sdk-examples/tree/main/server) when you are reading this
inside the zip). It holds your Secret key (server) and prints the URL and token a phone should use. Put
both in `.env`:

```
EXAMPLE_SERVER_URL=http://192.168.0.10:8787
EXAMPLE_SERVER_TOKEN=<the token the server printed>
```

and run again. Home then enables "Register a pet" and lists the pets you registered with the example
(tap one to verify it), and the result screen gets a **Send** button: it uploads the images, then
registers, verifies or identifies, and shows the outcome. Leaving a registration without a successful
register deletes the pet the server created for it.

The server is plain HTTP on your local network, so the example allows cleartext HTTP
(`android:usesCleartextTraffic` in `AndroidManifest.xml`, `NSAllowsLocalNetworking` in `Info.plist`).
Your own app talks HTTPS to your own backend.

## Troubleshooting

See also the plugin's `README.md` (in the zip) and [Flutter Getting Started](https://docs.petnow.io/petify/docs/sdk/flutter/getting-started).

- **"Set PETIFY_API_KEY …" on the home screen** — `.env` is missing the key, or the app was not run
  with `--dart-define-from-file=.env`.
- **"Could not create a capture session: HTTP 401 …"** on the guide screen — the API Key is wrong or
  revoked. Put a valid Client key in `.env` and rebuild.
- **"Camera could not start" with `invalidLicense`** — the SDK refused the key; same fix.
- **"HTTP 401 unauthorized"** in server mode — `EXAMPLE_SERVER_TOKEN` does not match the server's
  token.
- **"ClientException … Connection refused" / timeout** in server mode — the phone cannot reach the
  server: same Wi-Fi, the URL the server printed (not `localhost`), and the server still running. On
  iOS, allow **Local Network** access when asked (Settings → Privacy & Security → Local Network).
- **The camera stays black / "Allow camera access …"** — grant the camera permission; after a
  permanent denial, use **Open settings**.
- **`Could not find io.petnow:ui:1.6.0`** or **`MissingPluginException`** — the plugin folder is
  incomplete or moved; unzip it again (step 2), then `flutter clean && flutter pub get`.
