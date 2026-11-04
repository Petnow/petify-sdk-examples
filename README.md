# Petify SDK examples

Small apps that show how to integrate the [Petify](https://docs.petnow.io/petify/docs) nose-print camera SDK.
They follow the flow most apps have, and put the SDK calls where they belong in it:

```
Home ──▶ Capture guide ──▶ Camera ──▶ Result
            │                 │
            │ ① prewarm       │ ② guide from detection feedback
            │                 │ ③ retry without restarting the camera
            ◀──────── ④ release when the user leaves the flow
                              ⑤ check that the prewarm took (engineReused)
```

| Folder | Platform | SDK package |
| --- | --- | --- |
| [`ios/`](ios/README.md) | iOS 16.4+, SwiftUI | `petnow.ui` 1.6.0 (Swift package registry) |
| [`android/`](android/README.md) | Android 9+ (API 28), Jetpack Compose | `io.petnow:ui:1.6.0` (Maven) |
| [`react-native/`](react-native/README.md) | React Native 0.76, New Architecture | `@petify/react-native-camera-ui` 1.6.0 (npm) |

The iOS and Android apps are minimal: the four screens above, nothing else. The React Native app
is the full Petify-style demo — register, identify and verify, with a pet profile page and the
whole server flow — with the same prewarm placement. The numbered comments ①–⑤ mark the same
steps in all three; in React Native, ③ is "Scan again", which opens a new capture session
(a session backs one server job), and ⑤ is logged to the Metro console.

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

**⑤ Check that it worked.** `phases.engineReused` is `true` when the camera found the models ready.

See the [SDK 1.6.0 release notes](https://docs.petnow.io/petify/docs/sdk/changelog) for the full list of changes.

## Try it yourself

The SDK is **not** in this repository. Each app downloads it the way your own app will, following
the [Petify docs](https://docs.petnow.io/petify/docs/sdk):

1. **Petify Console** ([guide](https://docs.petnow.io/petify/docs/petify-console)) — sign up, register a
   payment method, then in **My Page** create an **API Key** (the SDK licence) and issue the
   **AWS CodeArtifact Key** (the credentials that download the SDK).
2. **Download the SDK** with the CodeArtifact Key, as the platform's Getting Started guide describes:
   [iOS](https://docs.petnow.io/petify/docs/sdk/ios/getting-started) (Swift Package Manager),
   [Android](https://docs.petnow.io/petify/docs/sdk/android/getting-started) (Gradle),
   [React Native](https://docs.petnow.io/petify/docs/sdk/react-native/getting-started) (npm).
3. **Set your API Key** in the app's git-ignored local file.
4. **Build and run** on a device.

Each platform's README walks through these four steps with the exact commands.

## Capture sessions

Every capture belongs to a capture session that **your server** creates with the Petify Server API and
hands to the app as an ID. So that the examples run without a backend, they call the Server API
themselves: the iOS and Android apps create an identification session (`DemoCaptureSessions`), and
the React Native app runs the whole flow (`demo/demoBackend.ts`). Both are marked *example only* — a
production app must not call the Server API, and must not hold a key that can.

All three run against the **production** backend, where Petify Console keys are issued. The iOS and
Android apps create nothing in your account; **a registration in the React Native app is a real pet**
(delete it from "See all" on its home screen).

## Security notes

- No keys, tokens or account identifiers are committed. `Secrets.xcconfig`, `local.properties`,
  `react-native/.env` and the Swift registry configuration are git-ignored; the repository only
  contains `*.example` templates.
- The examples compile the API key into the app for convenience. Anyone with the app binary can read it
  back out. See [API key security](https://docs.petnow.io/petify/docs/sdk/ios/getting-started) in the docs
  before you ship.
- To report a security issue, see [SECURITY.md](SECURITY.md).

## License

The example code is released under the [MIT License](LICENSE). The Petify SDK it depends on is **not**
part of this repository and is licensed separately under your Petify agreement. The React Native app
bundles the Roboto and Material Icons fonts (Apache-2.0, licences next to them).
