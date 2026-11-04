# Android example (Jetpack Compose)

Home → capture guide (**prewarm**) → camera → result, using the Petify Android SDK (`io.petnow:ui:1.6.0`).
The SDK is not in this repository: Gradle downloads it from Petnow's AWS CodeArtifact repository with
your own credentials, exactly as the [Android Getting Started](https://docs.petnow.io/petify/docs/sdk/android/getting-started)
guide describes.

| File | What it shows |
| --- | --- |
| `GuideScreen.kt` | ① `CameraController.prewarm(context, license)` when the guide appears |
| `CameraScreen.kt` | `CameraView` in `AndroidView`, ② guidance after `phases.detectionReadyAtMs`, ③ retry with `startDetection()`, ⑤ `phases.engineReused` |
| `MainActivity.kt` | ④ `CameraController.releasePrewarmed()` when the back stack returns home; the result replaces the used-up camera |
| `DemoCaptureSessions.kt` | creates a capture session — **example only**, your server does this |

## Requirements

- JDK 17, Android SDK 35, and a device on Android 9 (API 28) or later
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (2.15 or later)
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment method registered

Run the commands below from this folder (`cd android`).

## 1. Issue your keys in the Petify Console

In **Integration → API & SDK** ([guide](https://docs.petnow.io/petify/docs/petify-console); older consoles
had these under **My Page**):

1. **API Key Management → Create New API Key**, key type **Client key (app)**. This is the SDK licence
   (`LicenseInfo(apiKey = …)`). A Client key is enough here: the app only uses the SDK and creates a
   capture session. Client keys need SDK 1.5.0 or later. Keep Secret keys (server) out of app code. The
   key is shown only once.
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
variables; `app/build.gradle.kts` declares `implementation("io.petnow:ui:1.6.0")`. The token lasts
12 hours; run the second command again when Gradle fails with 401.

## 3. Set your API Key

```bash
cp local.properties.example local.properties
```

Edit `local.properties`: `petnow.apiKey` (the Client key from step 1). Uncomment `sdk.dir` only if
`ANDROID_HOME` is not set. The file is git-ignored.

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
