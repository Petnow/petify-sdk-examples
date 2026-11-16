# iOS example (SwiftUI)

Home → capture guide (**prewarm**) → camera → result, using the Petify iOS SDK (`petnow.ui`) 1.6.0.
It runs in **camera-only mode** with just a Client key; with the [example server](../server/README.md)
running it can also register, verify and identify pets ([below](#register-verify-and-identify-example-server)).
The SDK is not in this repository: you download it from Petnow's AWS CodeArtifact registry with your
own credentials, exactly as the [iOS Getting Started](https://docs.petnow.io/petify/docs/sdk/ios/getting-started)
guide describes.

| File | What it shows |
| --- | --- |
| `PrewarmExample/HomeScreen.swift` | Identify / Register, and in server mode the **Pets** list (tap a pet to verify it) |
| `PrewarmExample/GuideScreen.swift` | ① `CameraController.prewarm(licenseInfo:)` in `onAppear` |
| `PrewarmExample/CameraScreen.swift` | ② guidance from `detectionStatus` after `phases.detectionReadyAtMs`, ③ retry with `startDetection()` showing `.fail(reason:)`, ⑤ `phases.engineReused` |
| `PrewarmExample/PrewarmExampleApp.swift` | ④ `CameraController.releasePrewarmed()` when the navigation path returns home |
| `PrewarmExample/CaptureSession.swift` | what the user picked (identify, register, verify a pet) and the capture session: Petify directly in camera-only mode, the example server in server mode |
| `PrewarmExample/DemoCaptureSessions.swift` | camera-only mode: an identification session with the Client key — **example only**, your server does this |
| `PrewarmExample/ExampleServer.swift` | server mode: the pet list, session, image uploads, register/verify/identify, and deleting the pet of an abandoned registration |
| `PrewarmExample/ResultScreen.swift` | ⑤ `engineReused`; in server mode **Send** uploads the images and shows the outcome |
| `PrewarmExample/Theme.swift` | the colours and buttons shared with the other examples |

## Requirements

- Xcode 16 or later, and an iPhone on iOS 16.4+ (the simulator has no camera)
- [AWS CLI v2](https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html) (2.15 or later)
- A [Petify Console](https://docs.petnow.io/petify/docs/petify-console) account with a payment method registered

Run the commands below from this folder (`cd ios`).

## 1. Issue your keys in the Petify Console

In **Integration → API & SDK** ([guide](https://docs.petnow.io/petify/docs/petify-console); older consoles
had these under **My Page**):

1. **API Key Management → Create New API Key**, key type **Client key (app)**. This is the SDK licence
   (`LicenseInfo(apiKey:)`). **Apps hold a Client key (app) only; the Secret key (server) lives only in the
   example server.** A Client key is enough for the app: it uses the SDK and creates an identification
   capture session. Client keys need SDK 1.5.0 or later. The key is shown only once.
2. **AWS CodeArtifact Key Management → Create New Key.** These credentials download the SDK. The popup
   shows them **only once** — save them before you close it.

## 2. Download the SDK (Swift Package Manager, AWS CodeArtifact)

Set the values from the CodeArtifact popup under these names:

| Console popup | Environment variable |
| --- | --- |
| Access Key ID | `AWS_ACCESS_KEY_ID` |
| Secret Access Key | `AWS_SECRET_ACCESS_KEY` |
| AWS Region | `AWS_DEFAULT_REGION` |
| CodeArtifact Domain | `PETNOW_CODEARTIFACT_DOMAIN` |
| AWS Account ID | `PETNOW_AWS_ACCOUNT_ID` |
| iOS SDK Repository | `PETNOW_IOS_SDK_REPOSITORY` |

The popup's **Copy All** button uses other names (`SDK_CONFIG_AWS_REGION`, `SDK_CONFIG_CODEARTIFACT_DOMAIN`, …)
and no `export`, so rename the values as above rather than pasting them as they are. The two AWS keys
may instead be stored with `aws configure`; the script only checks the region and the `PETNOW_*` values.

```bash
# So an AWS profile or session already in your shell does not override the Console keys.
unset AWS_PROFILE AWS_SESSION_TOKEN

export AWS_ACCESS_KEY_ID=<Access Key ID>
export AWS_SECRET_ACCESS_KEY=<Secret Access Key>
export AWS_DEFAULT_REGION=<AWS Region>
export PETNOW_CODEARTIFACT_DOMAIN=<CodeArtifact Domain>
export PETNOW_AWS_ACCOUNT_ID=<AWS Account ID>
export PETNOW_IOS_SDK_REPOSITORY=<iOS SDK Repository>
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

Edit `Config/Secrets.xcconfig` (git-ignored):

- `PETNOW_API_KEY` — the Client key from step 1.
- `EXAMPLE_TEAM_ID` — your Apple Developer team ID.
- `EXAMPLE_BUNDLE_ID` — change the placeholder to a bundle ID your team can sign. Automatic signing
  fails for an ID another team has already registered.
- `EXAMPLE_SERVER_HOST`, `EXAMPLE_SERVER_TOKEN` — optional, leave them commented out for camera-only mode
  (see [Register, verify and identify](#register-verify-and-identify-example-server)).

## 4. Build and run

```bash
open PrewarmExample.xcworkspace
```

Xcode resolves `petnow.ui` 1.6.0 from the registry on first open (**Package Dependencies** in the
navigator shows it). Select your iPhone and run.

`PrewarmExample.xcodeproj` is generated from `project.yml` with [XcodeGen](https://github.com/yonaskolb/XcodeGen);
you only need XcodeGen if you change `project.yml`.

## Register, verify and identify (example server)

Optional. Registering, verifying and identifying need the Secret key, so the app asks the [example server](../server/README.md)
on your computer instead. Apps hold a Client key (app) only; the Secret key (server) lives only in the
example server. Start the server (see its README), then add to `Config/Secrets.xcconfig` and rebuild:

```
EXAMPLE_SERVER_HOST = 192.168.0.10:8787
EXAMPLE_SERVER_TOKEN = <token the server printed>
```

- `EXAMPLE_SERVER_HOST` — one of the LAN addresses the server prints, **host and port only**: xcconfig
  reads `//` as a comment, so the app adds `http://` itself.
- `EXAMPLE_SERVER_TOKEN` — the server's token. The app sends it as `Authorization: Bearer …` and never
  shows or logs it.

With both set, **Register a pet** is enabled on Home, and the **Pets** card lists the pets this example
registered (newest first, up to 20); tap one to verify it. The result screen has a **Send** button that
uploads the images and shows the registered pet ID, whether it is the same pet (verify), or the top
candidates (identify). Leaving a registration without a successful register deletes the pet the server
created for it. The iPhone and the computer must be on
the same Wi-Fi; allow **Local Network** access when iOS asks. Plain HTTP to a LAN address is allowed by
`NSAllowsLocalNetworking` in `Info.plist` (no `NSAllowsArbitraryLoads`).

## Troubleshooting

See also [Troubleshooting](https://docs.petnow.io/petify/docs/sdk/ios/getting-started#troubleshooting) in the guide.

- **`petnow.ui` cannot be resolved, 401 / 403** — the token expired or `registries.json` is missing.
  Run `./scripts/setup-registry.sh` again, then *File → Packages → Reset Package Caches*. Make sure you
  opened `PrewarmExample.xcworkspace`, not the `.xcodeproj`.
- **"Set PETNOW_API_KEY …" on the home screen** — `Config/Secrets.xcconfig` is missing or still has the placeholder.
- **"Could not create a capture session: Petify API returned HTTP 401. Check PETNOW_API_KEY."** on the
  guide screen — the API Key is wrong or revoked. Put a valid Client key in `Config/Secrets.xcconfig` and rebuild.
- **`HTTP 401 unauthorized`** after Send or on the guide screen in server mode — `EXAMPLE_SERVER_TOKEN`
  does not match the server's token (a generated token changes at every server start).
- **The guide screen times out in server mode** — the iPhone cannot reach the server: check the address,
  that both are on the same Wi-Fi, and *Settings → Privacy & Security → Local Network* for this app.
- **Signing fails ("The app identifier … cannot be registered to your development team", or no team
  selected)** — set `EXAMPLE_TEAM_ID` and an `EXAMPLE_BUNDLE_ID` of your own in `Config/Secrets.xcconfig` (step 3).
