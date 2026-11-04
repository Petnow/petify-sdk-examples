# Android example (Jetpack Compose)

Home → capture guide (**prewarm**) → camera → result, using the Petnow Android SDK (`io.petnow:ui:1.6.0`).
The SDK is not in this repository: Gradle downloads it from Petnow's AWS CodeArtifact repository with
your own credentials, exactly as the [Android Getting Started](https://docs.petnow.io/petify/docs/sdk/android/getting-started)
guide describes.

| File | What it shows |
| --- | --- |
| `GuideScreen.kt` | ① `CameraController.prewarm(context, license)` when the guide appears |
| `CameraScreen.kt` | `CameraView` in `AndroidView`, ② guidance after `phases.detectionReadyAtMs`, ③ retry with `startDetection()`, ⑤ `phases.engineReused` |
| `MainActivity.kt` | ④ `CameraController.releasePrewarmed()` when the back stack returns home |
| `DemoCaptureSessions.kt` | creates a capture session — **example only**, your server does this |

## Requirements

- JDK 17, Android SDK 34, and a device on Android 9 (API 28) or later
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment method registered

## 1. Issue your keys in the Petify Console

In **My Page** ([guide](https://docs.petnow.io/petify/docs/petify-console)):

1. **API Key Management → create an API Key.** This is the SDK licence (`LicenseInfo(apiKey = …)`).
2. **Issue the AWS CodeArtifact Key.** These credentials download the SDK.

## 2. Download the SDK (Gradle, AWS CodeArtifact)

Set the values the console shows for the CodeArtifact Key, then derive the repository URL and token —
the same commands as the guide:

```bash
export AWS_ACCESS_KEY_ID=<from Petify Console>
export AWS_SECRET_ACCESS_KEY=<from Petify Console>
export AWS_DEFAULT_REGION=<from Petify Console>
export PETNOW_CODEARTIFACT_DOMAIN=<from Petify Console>
export PETNOW_AWS_ACCOUNT_ID=<from Petify Console>
export PETNOW_ANDROID_SDK_REPOSITORY=<from Petify Console>

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
variables; `app/build.gradle.kts` declares `implementation("io.petnow:ui:1.6.0")`. The token lasts
12 hours; run the second command again when Gradle fails with 401.

## 3. Set your API Key

```bash
cp local.properties.example local.properties
```

Edit `local.properties`: `sdk.dir` (your Android SDK) and `petnow.apiKey` (the API Key from step 1).
The file is git-ignored.

## 4. Build and run

```bash
./gradlew :app:installDebug
```

To use Android Studio, start it from the same shell (`open -a "Android Studio" .` on macOS) so it
sees `CODEARTIFACT_URL` and `CODEARTIFACT_AUTH_TOKEN`.

## Troubleshooting

See also [Troubleshooting](https://docs.petnow.io/petify/docs/sdk/android/getting-started#troubleshooting) in the guide.

- **`Could not resolve io.petnow:ui:1.6.0` / 401** — the token expired or the variables are not set
  in this shell; repeat step 2.
- **"Set petnow.apiKey …" on the home screen** — `local.properties` is missing the key; rebuild after adding it.
