import React, {useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  CameraView,
  type CameraResult,
  type DetectionStatus,
  type PetnowCamera,
  type PetnowCameraConfig,
} from '@petify/react-native-camera-ui';

import {REASON_MESSAGES} from './petnowGuidance';
import {
  CameraControls,
  CameraMaskOverlay,
  DetectionBanner,
  CameraTopBar,
  ScanGuideSheet,
  type BannerTone,
} from './ui/cameraChrome';
import {Petify, PetifyPrimaryButton, PetifySecondaryButton} from './ui/petifyUi';
import {
  ScanCompleteScreen,
  type ProfileDraft,
  type SubmitResult,
} from './ui/scanCompleteScreen';

/** Runs the server step for a finished capture, against the session it used. */
export type SessionSubmit = (
  result: CameraResult,
  profile: ProfileDraft,
  sessionId: string,
  onStep: (step: string) => void,
) => Promise<SubmitResult>;

/**
 * The capture surface.
 *
 * `<CameraView>` renders the native preview and the SDK's own tracking overlay;
 * this screen adds the app's chrome around it and turns the SDK's
 * `onDetection*` callbacks into guidance for the user.
 */
export function CaptureScreen({
  camera,
  config,
  onSubmit,
  onNewSession,
  onClose,
}: {
  camera: PetnowCamera;
  /** The configuration for the *first* capture; a retake swaps the session. */
  config: PetnowCameraConfig;
  onSubmit: SessionSubmit;
  /**
   * Issues a new capture session for a retake, against the same pet.
   *
   * A session is single-use — the server rejects a second job on one with
   * `PETNOWB2B20014` — so scanning again means a new session, not a new pet.
   */
  onNewSession: () => Promise<string>;
  onClose: () => void;
}) {
  // The live configuration. Only the capture session changes, and only on a
  // retake; everything the user picked on the home screen stays put.
  const [liveConfig, setLiveConfig] = useState(config);
  const [status, setStatus] = useState<DetectionStatus | null>(null);
  const [progress, setProgress] = useState(0);
  /** A retake could not get a new session; the camera stays down until one is. */
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [result, setResult] = useState<CameraResult | null>(null);
  const [newSessionPending, setNewSessionPending] = useState(false);
  /**
   * Whether every model this species needs is ready, from
   * `performanceStats.detectionReadyAtMs`. Since 1.6.0 the preview (and
   * face-only frames) can come up before that; the screen says "Preparing"
   * until then instead of asking the user to aim.
   */
  const [detectionReady, setDetectionReady] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);

  const isCat = liveConfig.species === 'CAT';
  /**
   * A setup failure — a refused key, a missing permission, a camera that would
   * not open — rather than a frame the SDK rejected. Those arrive as
   * `'Unexpected'`, with the native message on `rawReason`.
   */
  const setupFailed = status?.type === 'failed' && status.reason === 'Unexpected';

  // ---------------------------------------------------------------- guidance

  /**
   * The mask is shown once detection is running but nothing is locked on yet.
   * Until the models are ready the screen shows "Preparing" instead, so the
   * ring does not ask the user to aim at a camera that cannot detect yet.
   */
  // ② Guide from detection feedback, not from the preview appearing.
  const maskVisible = detectionReady && status?.type === 'noObject';
  const guide = maskVisible ? "Place your pet's face inside the circle" : null;

  const statusLabel = (() => {
    if (setupFailed) {
      return 'Not scanning';
    }
    if (!detectionReady) {
      return 'Preparing';
    }
    switch (status?.type) {
      case undefined:
        return 'Preparing';
      case 'noObject':
        return isCat ? 'Looking for face' : 'Looking for nose';
      case 'finished':
        return 'Scan complete';
      default:
        return 'Scanning…';
    }
  })();

  /** The floating banner above the controls. */
  const banner: {message: string; tone: BannerTone} | null = (() => {
    // Before the models are ready, only a setup failure is worth showing; a
    // rejected face-only frame is not the user's to fix yet.
    if (!detectionReady && !setupFailed) {
      return null;
    }
    switch (status?.type) {
      case 'processing':
        return {
          message: isCat
            ? 'Starting face scan'
            : 'Starting nose print scan. Keep the nose facing the camera',
          tone: 'start',
        };
      case 'detected':
        return {
          message:
            progress > 0 ? `Scanning. Hold still · ${progress}%` : 'Scanning. Hold still',
          tone: 'success',
        };
      case 'failed':
        // For a setup failure show what the SDK said: "something unexpected
        // happened" helps nobody fix a key.
        return {
          message:
            setupFailed && status.rawReason
              ? status.rawReason
              : (REASON_MESSAGES[status.reason] ?? 'Please try again'),
          tone: 'error',
        };
      default:
        return null;
    }
  })();

  // ------------------------------------------------------------------ result

  /**
   * Restart the capture.
   *
   * The session the last capture ran against may already back a server job, and
   * a session can only back one (`PETNOWB2B20014`), so a retake gets a new one.
   * The id is bound when the native camera initializes and cannot be swapped on
   * a live view, so `<CameraView>` is keyed by it: replacing the id remounts the
   * view and the SDK comes back up on the new session.
   */
  // ③ Scan again: a new capture session, and the camera restarts on it.
  const scanAgain = async () => {
    setResult(null);
    setStatus(null);
    setProgress(0);
    setSessionError(null);
    setNewSessionPending(true);
    setDetectionReady(false);
    try {
      const sessionId = await onNewSession();
      setLiveConfig(current => ({...current, captureSessionId: sessionId}));
    } catch (e) {
      // Never fall back to the old session: it may already back a server job.
      setSessionError(
        `Could not start a new capture session: ${e instanceof Error ? e.message : e}`,
      );
    } finally {
      setNewSessionPending(false);
    }
  };

  if (sessionError) {
    return (
      <View style={styles.sessionError}>
        <Text style={styles.sessionErrorText}>{sessionError}</Text>
        <PetifyPrimaryButton label="Try again" onPress={scanAgain} />
        <View style={styles.gap} />
        <PetifySecondaryButton label="Close" onPress={onClose} />
      </View>
    );
  }

  if (result) {
    return (
      <ScanCompleteScreen
        result={result}
        isCat={isCat}
        askName={liveConfig.purpose === 'PET_PROFILE_REGISTRATION'}
        onSubmit={(r, profile, onStep) =>
          onSubmit(r, profile, liveConfig.captureSessionId, onStep)
        }
        onScanAgain={scanAgain}
        onDone={onClose}
      />
    );
  }

  return (
    <View style={styles.screen}>
      {/* Keyed by the capture session: a retake issues a new one, and the key
          is what rebuilds the native view so the SDK binds to it. */}
      {newSessionPending ? null : (
        <CameraView
          key={liveConfig.captureSessionId}
          camera={camera}
          style={StyleSheet.absoluteFill}
          {...liveConfig}
          onDetectionProgress={setProgress}
          onDetectionStatus={setStatus}
          // Delivered a few times a second; the first one that carries
          // `detectionReadyAtMs` is the moment detection can start.
          onPerformanceStats={stats => {
            if (stats.detectionReadyAtMs != null && !detectionReady) {
              setDetectionReady(true);
              // ⑤ engineReused: the engine was already built when the camera
              // started — after a finished prewarm, or one an earlier camera
              // left. False if the camera had to build or wait for it. Logged
              // for you to check in the Metro console.
              console.info(
                `[Petnow] detection ready at ${stats.detectionReadyAtMs} ms, ` +
                  `engineReused=${stats.engineReused}`,
              );
            }
          }}
          onDetectionFinished={setResult}
        />
      )}

      <CameraMaskOverlay visible={maskVisible} guideMessage={guide} />

      {/* The SDK needs a moment to load its models. A setup failure is shown
          in the banner instead, so a refused key does not hide behind it. */}
      {!detectionReady && !setupFailed ? (
        <View style={styles.preparing} pointerEvents="none">
          <Text style={styles.preparingText}>Preparing the camera…</Text>
        </View>
      ) : null}

      <View style={styles.top}>
        <CameraTopBar onClose={onClose} onTips={() => setTipsOpen(true)} />
      </View>

      <View style={styles.bottom}>
        {banner ? (
          <View style={styles.bannerSlot}>
            <DetectionBanner message={banner.message} tone={banner.tone} />
          </View>
        ) : null}
        <CameraControls
          statusLabel={statusLabel}
          progress={progress}
          onSwitchCamera={() => camera.switchCamera()}
        />
      </View>

      <ScanGuideSheet
        visible={tipsOpen}
        isCat={isCat}
        onClose={() => setTipsOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#000000'},
  preparing: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preparingText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 15,
    fontFamily: Petify.font,
  },
  top: {position: 'absolute', left: 0, right: 0, top: 0},
  bottom: {position: 'absolute', left: 0, right: 0, bottom: 0},
  bannerSlot: {paddingHorizontal: 24, paddingBottom: 12},
  sessionError: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: Petify.surface,
  },
  sessionErrorText: {
    marginBottom: 20,
    fontSize: 15,
    lineHeight: 22,
    fontFamily: Petify.font,
    color: Petify.ink,
  },
  gap: {height: 10},
});
