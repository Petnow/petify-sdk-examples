/**
 * Turns SDK detection states into text for the user.
 *
 * Copy this file into your app and edit it: the SDK reports *why* a frame was
 * rejected, and deciding what to tell the user — wording, tone, language — is
 * yours.
 *
 * The strings are English; translate them for your users.
 */
import type {DetectionFailureReason} from '@petify/react-native-camera-ui';

/** Every reason the SDK can reject a frame, with a plain-language message. */
export const REASON_MESSAGES: Record<DetectionFailureReason, string> = {
  Error: 'Something went wrong. Please try again.',
  TooBright: 'Too bright. Move out of direct light.',
  TooDark: 'Too dark. Find a brighter spot.',
  NoseNotFound: "Can't find the nose. Point the camera at it.",
  NotFrontFace: 'Face the camera straight on.',
  NotFrontCatFaceHor: "Keep the cat's face level.",
  NotFrontCatFaceTop: "The cat's face is too high in the frame.",
  NotFrontCatFaceBottom: "The cat's face is too low in the frame.",
  TooFarAway: 'Move a little closer.',
  TooClose: 'Move a little farther away.',
  NotFrontNoseTop: 'The nose is too high in the frame.',
  TooBlurred: 'The image is blurry. Hold still.',
  ShadowDetected: 'Avoid shadows on the nose.',
  GlareDetected: 'Avoid glare on the nose.',
  MotionBlurDetected: 'Hold the phone still.',
  DefocusedBlurDetected: 'Out of focus. Move a little farther away.',
  NotFrontNose: 'Point the camera straight at the nose.',
  FurDetected: 'Fur is covering the nose.',
  HumanFaceDetected: "That's a person's face. Point the camera at your pet.",
  FakeDetected: 'This looks like a photo or a screen. Scan a real pet.',
  Unexpected: 'Something unexpected happened. Please try again.',
};
