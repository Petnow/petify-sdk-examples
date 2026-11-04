# Android example (Jetpack Compose)

Home → capture guide (**prewarm**) → camera → result, using the Petify Android SDK (`io.petnow:ui:1.6.0`).
It runs in **camera-only mode** with just a Client key; with the [example server](../server/README.md)
running it can also register, verify and identify pets ([below](#register-verify-and-identify-example-server)).
The SDK is not in this repository: Gradle downloads it from Petnow's AWS CodeArtifact repository with
your own credentials, exactly as the [Android Getting Started](https://docs.petnow.io/petify/docs/sdk/android/getting-started)
guide describes.

| File | What it shows |
| --- | --- |
| `GuideScreen.kt` | ① `CameraController.prewarm(context, license)` when the guide appears |
| `CameraScreen.kt` | `CameraView` in `AndroidView`, ② guidance after `phases.detectionReadyAtMs`, ③ retry with `startDetection()`, ⑤ `phases.engineReused` |
| `MainActivity.kt` | ④ `CameraController.releasePrewarmed()` when the back stack returns home; the result replaces the used-up camera |
| `HomeScreen.kt` | Identify / Register, and in server mode the **Pets** list: tap a pet to verify it |
| `CaptureSession.kt` | creates the capture session: Petify directly in camera-only mode, the example server in server mode |
| `DemoCaptureSessions.kt` | camera-only mode: an identification session with the Client key — **example only**, your server does this |
| `ExampleServer.kt` | server mode: the pet list, session, image uploads, register/verify/identify, and deleting the pet of an abandoned registration |
| `ResultScreen.kt` | ⑤ `engineReused`; in server mode **Send** uploads the images and shows the outcome |
| `Theme.kt` | the Petify palette, buttons and cards shared with the other examples |

## Requirements

- JDK 17, Android SDK 35, and a device on Android 9 (API 28) or later
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (2.15 or later)
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment method registered

Run the commands below from this folder (`cd android`).

## 1. Issue your keys in the Petify Console

In **Integration → API & SDK** ([guide](https://docs.petnow.io/petify/docs/petify-console); older consoles
had these under **My Page**):

1. **API Key Management → Create New API Key**, key type **Client key (app)**. This is the SDK licence
   (`LicenseInfo(apiKey = …)`). **Apps hold a Client key (app) only; the Secret key (server) lives only in the
   example server.** A Client key is enough for the app: it uses the SDK and creates an identification
   capture session. Client keys need SDK 1.5.0 or later. The key is shown only once.
2. **AWS CodeArtifact Key Management → Create New Key.** These credentials download the SDK. The popup
   shows them **only once** — save them before you close it.

## 2. Download the SDK (Gradle, AWS CodeArtifact)

Set the values from the CodeArtifact popup under these names:

| Console popup | Environment variable |
| --- | --- |
| Access Key ID | `AWS_ACCESS_KEY_ID` |
| Secret Access Key | `AWS_SECRET_ACCESS_KEY` |
| AWS Region | `AWS_DEFAULT_REGION` |
| CodeArtifact Domain | `PETNOW_CODEARTIFACT_DOMAIN` |
| AWS Account ID | `PETNOW_AWS_ACCOUNT_ID` |
| Android SDK Repository | `PETNOW_ANDROID_SDK_REPOSITORY` |

The popup's **Copy All** button uses other names (`SDK_CONFIG_AWS_REGION`, `SDK_CONFIG_CODEARTIFACT_DOMAIN`, …)
and no `export`, so rename the values as above rather than pasting them as they are. Then derive the
repository URL and token — the same commands as the guide:

```bash
# So an AWS profile or session already in your shell does not override the Console keys.
unset AWS_PROFILE AWS_SESSION_TOKEN

export AWS_ACCESS_KEY_ID=<Access Key ID>
export AWS_SECRET_ACCESS_KEY=<Secret Access Key>
export AWS_DEFAULT_REGION=<AWS Region>
export PETNOW_CODEARTIFACT_DOMAIN=<CodeArtifact Domain>
export PETNOW_AWS_ACCOUNT_ID=<AWS Account ID>
export PETNOW_ANDROID_SDK_REPOSITORY=<Android SDK Repository>

export CODEARTIFACT_URL=$(aws codeartifact get-repository-endpoint \
  --domain $PETNOW_CODEARTIFACT_DOMAIN \
  --domain-owner $PETNOW_AWS_ACCOUNT_ID \
  --repository $PETNOW_ANDROID_SDK_REPOSITORY \
  --region $AWS_DEFAULT_REGION \
  --format maven \
  --query repositoryEndpoint \
  --output text)

export CODEARTIFACT_AUTH_TOKEN=$(aws codeartifact get-authorization-token \
  --domain $PETNOW_CODEARTIFACT_DOMAIN \
  --domain-owner $PETNOW_AWS_ACCOUNT_ID \
  --region $AWS_DEFAULT_REGION \
  --query authorizationToken \
  --output text)
```

`settings.gradle.kts` already has the guide's CodeArtifact repository block and reads these two
variables (Gradle stops with "CODEARTIFACT_URL is not set" when they are missing);
`app/build.gradle.kts` declares `implementation("io.petnow:ui:1.6.0")`. The token lasts 12 hours;
run the second command again when Gradle fails with 401.

## 3. Set your API Key

```bash
cp local.properties.example local.properties
```

Edit `local.properties`: `petnow.apiKey` (the Client key from step 1). Uncomment `sdk.dir` only if
`ANDROID_HOME` is not set. The file is git-ignored. Without `petnow.apiKey` the build falls back to a
`PETNOW_API_KEY` environment variable (handy on CI). `example.serverUrl` and `example.serverToken` are
optional; leave them commented out for camera-only mode (see [Register, verify and identify](#register-verify-and-identify-example-server)).

## 4. Build and run

```bash
./gradlew :app:installDebug
```

To use Android Studio, start it from the same shell (`open -a "Android Studio" .` on macOS) so it
sees `CODEARTIFACT_URL` and `CODEARTIFACT_AUTH_TOKEN`.

## Register, verify and identify (example server)

Optional. Registering, verifying and identifying need the Secret key, so the app asks the [example server](../server/README.md)
on your computer instead. Apps hold a Client key (app) only; the Secret key (server) lives only in the
example server. Start the server (see its README), then add to `local.properties` and rebuild:

```properties
example.serverUrl=http://192.168.0.10:8787
example.serverToken=<token the server printed>
```

- `example.serverUrl` — one of the LAN URLs the server prints.
- `example.serverToken` — the server's token. The app sends it as `Authorization: Bearer …` and never
  shows or logs it.

Without them the build falls back to `EXAMPLE_SERVER_URL` and `EXAMPLE_SERVER_TOKEN` environment variables.
With both set, **Register a pet** is enabled on Home, and Home lists the pets this example registered
under **Pets** (newest first, from the server's `GET /pets`). Tap one to verify it: the camera captures
for that pet. The result screen has a **Send** button that uploads the images and shows the registered pet
ID, **Same pet** / **Not the same pet** with the score, or the top candidates. Leaving a registration
without a successful register deletes the pet the server created for it. The phone and the computer must be on
the same Wi-Fi.

Android blocks plain HTTP by default. The build writes a network security config that allows it to the
host of `example.serverUrl` only (see `app/build.gradle.kts`), in debug and release builds alike; without
a server URL it allows no plain HTTP at all.

## Troubleshooting

See also [Troubleshooting](https://docs.petnow.io/petify/docs/sdk/android/getting-started#troubleshooting) in the guide.

- **`CODEARTIFACT_URL is not set` (or `CODEARTIFACT_AUTH_TOKEN is not set`)** — this shell, or the
  Android Studio you sync from, does not have the step 2 variables. Export them and run again.
- **`Could not resolve io.petnow:ui:1.6.0` / 401** — the token expired (12 hours); repeat step 2.
  Android Studio keeps the environment it was started with, so an already open Android Studio still
  has the expired token: quit it and start it again from the refreshed shell.
- **"Set petnow.apiKey …" on the home screen** — `local.properties` is missing the key; rebuild after adding it.
- **"Could not create a capture session: Petify API returned HTTP 401. Check petnow.apiKey."** on the
  guide screen — the API Key is wrong or revoked. Put a valid Client key in `local.properties` and rebuild.
- **`HTTP 401 unauthorized`** after Send or on the guide screen in server mode — `example.serverToken`
  does not match the server's token (a generated token changes at every server start).
- **`CLEARTEXT communication to … not permitted`** — the server's address changed since the last build;
  update `example.serverUrl` and rebuild.
- **The guide screen times out in server mode** — the phone cannot reach the server: check the address and
  that both are on the same Wi-Fi.
