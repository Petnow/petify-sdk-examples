/// Turns SDK detection states into text for the user.
///
/// This file is meant to be copied into your app and edited: the SDK reports
/// *why* a frame was rejected, and deciding what to tell the user — wording,
/// tone, language — is yours. The React Native example ships the same table
/// (`REASON_MESSAGES` / `guideMessage` in `example/App.tsx`), so the two SDKs
/// stay consistent.
library;

import 'package:petnow_camera_ui/petnow_camera_ui.dart';

/// Every reason the SDK can reject a frame, with a plain-language message.
///
/// The SDK reports these continuously while the camera is running, so treat
/// them as coaching, not errors.
const Map<DetectionFailureReason, String> kFailureMessages = {
  DetectionFailureReason.error: 'Something went wrong',
  DetectionFailureReason.tooBright: 'Too bright',
  DetectionFailureReason.tooDark: 'Too dark',
  DetectionFailureReason.noseNotFound: "Can't find the nose",
  DetectionFailureReason.notFrontFace: 'Face the camera',
  DetectionFailureReason.notFrontCatFaceHor: 'Hold the head level',
  DetectionFailureReason.notFrontCatFaceTop: 'Face is too high',
  DetectionFailureReason.notFrontCatFaceBottom: 'Face is too low',
  DetectionFailureReason.tooFarAway: 'Move closer',
  DetectionFailureReason.tooClose: 'Move slightly farther away',
  DetectionFailureReason.notFrontNoseTop: 'Nose is too high',
  DetectionFailureReason.tooBlurred: 'Too blurry',
  DetectionFailureReason.shadowDetected: 'A shadow is in the way',
  DetectionFailureReason.glareDetected: 'Glare on the nose',
  DetectionFailureReason.motionBlurDetected: 'Movement detected',
  DetectionFailureReason.defocusedBlurDetected: 'Out of focus',
  DetectionFailureReason.notFrontNose: 'Point the nose straight at the camera',
  DetectionFailureReason.furDetected: 'Fur is covering the nose',
  DetectionFailureReason.humanFaceDetected: 'That looks like a person',
  DetectionFailureReason.fakeDetected: 'That does not look like a real pet',
  DetectionFailureReason.unexpected: 'Please try again',
};

/// One line of guidance for the current [status].
///
/// [status] is null before the SDK reports anything — the camera is still
/// opening, which takes a moment on lower-end devices.
String guidanceFor(DetectionStatus? status, {bool isCat = false}) {
  return switch (status) {
    null => 'Preparing the camera…',
    DetectionNoObject() =>
      isCat ? 'Point the camera at your cat' : "Find your pet's nose",
    DetectionProcessing() => 'Scanning…',
    DetectionDetected() => 'Hold still',
    DetectionFinished() => 'Done',
    // Setup problems (bad config, denied permission, license) arrive as
    // `unexpected` and carry the native message in rawReason — surface it while
    // developing, and replace it with your own copy in production.
    DetectionFailed(:final reason, :final rawReason) =>
      reason == DetectionFailureReason.unexpected && rawReason != null
          ? rawReason
          : kFailureMessages[reason] ?? 'Please try again',
  };
}
