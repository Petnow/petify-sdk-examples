import React, {useRef, useState} from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';
import {
  CameraView,
  type CameraPerformanceStats,
  type CameraResult,
  type DetectionStatus,
  type PetnowCamera,
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
  const [captureFailed, setCaptureFailed] = useState(false);
  const engineReused = useRef(false);

  /**
   * A setup failure — a refused key, a missing permission, a camera that would
   * not open — rather than a frame the SDK rejected. It arrives as
   * `'Unexpected'`, with the native message on `rawReason`.
   */
  const setupError =
    status?.type === 'failed' && status.reason === 'Unexpected'
      ? status.rawReason || REASON_MESSAGES.Unexpected
      : null;

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
      setCaptureFailed(true);
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
    setCaptureFailed(false);
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
              <Text style={styles.error}>{setupError}</Text>
            </>
          ) : captureFailed ? (
            <>
              <Text style={styles.panelTitle}>Capture failed</Text>
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
  track: {height: 6, borderRadius: 3, backgroundColor: '#E0E0E0', overflow: 'hidden'},
  bar: {height: 6, backgroundColor: colors.main},
});
