# iOS example (SwiftUI)

Home → capture guide (**prewarm**) → camera → result, using the Petnow iOS SDK (`petnow.ui`) 1.6.0.
The SDK is not in this repository: you download it from Petnow's AWS CodeArtifact registry with your
own credentials, exactly as the [iOS Getting Started](https://docs.petnow.io/petify/docs/sdk/ios/getting-started)
guide describes.

| File | What it shows |
| --- | --- |
| `PrewarmExample/GuideView.swift` | ① `CameraController.prewarm(licenseInfo:)` in `onAppear` |
| `PrewarmExample/CameraScreen.swift` | ② guidance from `detectionStatus` after `phases.detectionReadyAtMs`, ③ retry with `startDetection()`, ⑤ `phases.engineReused` |
| `PrewarmExample/PrewarmExampleApp.swift` | ④ `CameraController.releasePrewarmed()` when the navigation path returns home |
| `PrewarmExample/DemoCaptureSessions.swift` | creates a capture session — **example only**, your server does this |

## Requirements

- Xcode 16 or later, and an iPhone on iOS 16.4+ (the simulator has no camera)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html)
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment method registered

## 1. Issue your keys in the Petify Console

In **My Page** ([guide](https://docs.petnow.io/petify/docs/petify-console)):

1. **API Key Management → create an API Key.** This is the SDK licence (`LicenseInfo(apiKey:)`).
2. **Issue the AWS CodeArtifact Key.** These credentials download the SDK.

## 2. Download the SDK (Swift Package Manager, AWS CodeArtifact)

Set the values the console shows for the CodeArtifact Key:

```bash
export AWS_ACCESS_KEY_ID=<from Petify Console>
export AWS_SECRET_ACCESS_KEY=<from Petify Console>
export AWS_DEFAULT_REGION=<from Petify Console>
export PETNOW_CODEARTIFACT_DOMAIN=<from Petify Console>
export PETNOW_AWS_ACCOUNT_ID=<from Petify Console>
export PETNOW_IOS_SDK_REPOSITORY=<from Petify Console>
```

This app is an Xcode workspace, so follow **Option B: Xcode Workspace** of the guide. The script below
runs exactly those two steps — log in to CodeArtifact from a dummy `Package.swift` directory, then
copy the generated `registries.json` into `PrewarmExample.xcworkspace/xcshareddata/swiftpm/configuration/`:

```bash
./scripts/setup-registry.sh
```

The registry token lives in your keychain and lasts 12 hours. Run the script again when Xcode cannot
resolve `petnow.ui`. `registries.json` is git-ignored.

## 3. Set your API Key and signing team

```bash
cp Config/Secrets.xcconfig.example Config/Secrets.xcconfig
```

Edit `Config/Secrets.xcconfig`: `PETNOW_API_KEY` (the API Key from step 1), `EXAMPLE_TEAM_ID`, and a
bundle ID you can sign. The file is git-ignored.

## 4. Build and run

```bash
open PrewarmExample.xcworkspace
```

Xcode resolves `petnow.ui` 1.6.0 from the registry on first open (**Package Dependencies** in the
navigator shows it). Select your iPhone and run.

`PrewarmExample.xcodeproj` is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen);
you only need XcodeGen if you change `project.yml`.

## Troubleshooting

See also [Troubleshooting](https://docs.petnow.io/petify/docs/sdk/ios/getting-started#troubleshooting) in the guide.

- **`petnow.ui` cannot be resolved, 401 / 403** — the token expired or `registries.json` is missing.
  Run `./scripts/setup-registry.sh` again, then *File → Packages → Reset Package Caches*. Make sure you
  opened `PrewarmExample.xcworkspace`, not the `.xcodeproj`.
- **"Set PETNOW_API_KEY …" on the home screen** — `Config/Secrets.xcconfig` is missing or still has the placeholder.
- **"Could not create a capture session: HTTP 401"** — the API Key is wrong or revoked.
