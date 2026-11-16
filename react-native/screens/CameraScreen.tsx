import React, {useRef, useState} from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {
  CameraView,
  type CameraPerformanceStats,
  type CameraResult,
  type DetectionFailureReason,
  type DetectionStatus,
  type PetnowCamera,
  type PetnowCameraError,
} from '@petify/react-native-camera-ui';

import type {Purpose, Session} from '../api';
import {REASON_MESSAGES} from '../petnowGuidance';
import {Button, colors} from '../ui';

/** The SDK's capture purpose for each flow. */
const CAPTURE_PURPOSE = {
  identify: 'PET_IDENTIFICATION',
  register: 'PET_PROFILE_REGISTRATION',
  verify: 'PET_VERIFICATION',
} as const satisfies Record<Purpose, string>;

/** What the result screen shows. */
export interface Capture {
  fingerprintImages: string[];
  appearanceImages: string[];
  engineReused: boolean;
}

export function CameraScreen({
  camera,
  session,
  onCaptured,
  onClose,
}: {
  camera: PetnowCamera;
  session: Session;
  onCaptured: (capture: Capture) => void;
  onClose: () => void;
}) {
  const [status, setStatus] = useState<DetectionStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [detectionReady, setDetectionReady] = useState(false);
  /**
   * The failed capture's reason. Since 1.6.0 it comes on the result
   * (`failureReason`), not on `onDetectionStatus`, which is live guidance only.
   * `null` while the capture has not failed.
   */
  const [failure, setFailure] = useState<DetectionFailureReason | 'unknown' | null>(null);
  /**
   * What stopped the camera from running at all — a refused key, an
   * unreachable licence server, a missing permission, a camera that would not
   * open. Since 1.6.0 it arrives on `onError`, not as a `failed` status.
   */
  const [setupError, setSetupError] = useState<PetnowCameraError | null>(null);
  const engineReused = useRef(false);

  const onPerformanceStats = (stats: CameraPerformanceStats) => {
    if (stats.detectionReadyAtMs != null && !detectionReady) {
      setDetectionReady(true);
      // ⑤ engineReused: the engine was already built when the camera started —
      //    true after a finished prewarm, or when an earlier camera left one;
      //    false when this camera had to build it or wait for it.
      engineReused.current = stats.engineReused ?? false;
      console.info(
        `[Petify] detection ready at ${stats.detectionReadyAtMs} ms, engineReused=${stats.engineReused}`,
      );
    }
  };

  const onDetectionFinished = (result: CameraResult) => {
    if (!result.success) {
      setFailure(result.failureReason ?? 'unknown');
      return;
    }
    onCaptured({
      fingerprintImages: result.fingerprintImages,
      appearanceImages: result.appearanceImages,
      engineReused: engineReused.current,
    });
  };

  // ③ Retry on the open camera: startDetection() starts a fresh capture on the
  //    same view and session. No images were uploaded, so the session is unused.
  const tryAgain = () => {
    setFailure(null);
    setStatus(null);
    setProgress(0);
    camera.startDetection();
  };

  // ② Guide from detection feedback, not from the preview appearing. Since 1.6.0
  //    the preview is up before the models are ready; detectionReadyAtMs marks
  //    the moment detection begins. With a prewarm that is almost immediate.
  const guidance = (() => {
    if (!detectionReady) {
      return 'Getting ready…';
    }
    switch (status?.type) {
      case 'processing':
      case 'detected':
        return 'Hold still…';
      case 'finished':
        return 'Done';
      case 'failed':
        // Live guidance: the reason the latest frames could not be used.
        return REASON_MESSAGES[status.reason] ?? 'Please try again.';
      default:
        return "Point the camera at your dog's nose";
    }
  })();

  return (
    <View style={styles.screen}>
      <CameraView
        camera={camera}
        style={StyleSheet.absoluteFill}
        // Dog only. For cats, use species="CAT" here and in the capture session.
        species="DOG"
        purpose={CAPTURE_PURPOSE[session.purpose]}
        captureSessionId={session.id}
        onDetectionStatus={setStatus}
        onDetectionProgress={setProgress}
        onPerformanceStats={onPerformanceStats}
        onDetectionFinished={onDetectionFinished}
        onError={setSetupError}
      />

      <SafeAreaView style={styles.overlay} pointerEvents="box-none">
        <Pressable
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Close camera"
          style={styles.close}>
          <Text style={styles.closeLabel}>Close</Text>
        </Pressable>

        <View style={styles.panel}>
          {setupError ? (
            <>
              <Text style={styles.panelTitle}>Camera could not start</Text>
              <Text style={styles.error}>{SETUP_ERROR_MESSAGES[setupError.code]}</Text>
            </>
          ) : failure ? (
            <>
              <Text style={styles.panelTitle}>Capture failed</Text>
              <Text style={styles.hint}>
                {failure === 'unknown' ? 'Please try again.' : REASON_MESSAGES[failure]}
              </Text>
              <Button label="Try again" onPress={tryAgain} />
              <Button label="Leave" secondary onPress={onClose} />
            </>
          ) : (
            <>
              <Text style={styles.panelTitle}>{guidance}</Text>
              <View style={styles.track}>
                <View style={[styles.bar, {width: `${progress}%`}]} />
              </View>
            </>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

/**
 * What to tell the user when the camera cannot start. `error.message` is for
 * logs and support, not for users; branch on `error.code`.
 */
const SETUP_ERROR_MESSAGES: Record<PetnowCameraError['code'], string> = {
  notInitialized: 'The app is not set up yet. Please try again.',
  invalidConfig: 'Something is wrong with this capture. Please start again.',
  permissionDenied: 'Allow camera access in Settings to scan a nose print.',
  invalidLicense: 'This app cannot use the camera right now. Please contact support.',
  network: 'Could not reach the server. Check your connection and try again.',
  cameraUnavailable: 'The camera could not be opened. Close other camera apps and try again.',
  multipleApiKeys: 'Please restart the app and try again.',
  unknown: 'The camera could not start. Please try again.',
};

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#000000'},
  overlay: {flex: 1, justifyContent: 'space-between'},
  close: {
    alignSelf: 'flex-start',
    margin: 16,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  closeLabel: {fontSize: 15, fontWeight: '600', color: colors.ink},
  panel: {
    margin: 16,
    padding: 16,
    gap: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.9)',
  },
  panelTitle: {fontSize: 17, fontWeight: '600', textAlign: 'center', color: colors.ink},
  error: {fontSize: 14, textAlign: 'center', color: colors.error},
  hint: {fontSize: 15, textAlign: 'center', color: colors.ink},
  track: {height: 6, borderRadius: 3, backgroundColor: '#E0E0E0', overflow: 'hidden'},
  bar: {height: 6, backgroundColor: colors.main},
});
