import React, {useCallback, useEffect, useRef, useState} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  CameraView,
  PetnowSound,
  type CameraResult,
  type DetectionStatus,
  type GuidanceSound,
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
  SoundSelectionPanel,
  type BannerTone,
} from './ui/cameraChrome';
import {Petify} from './ui/petifyUi';
import {
  ScanCompleteScreen,
  type CaptureSubmit,
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
 * The capture surface, styled after the Petify web playground.
 *
 * `<CameraView>` renders the native preview and the SDK's own tracking overlay;
 * this screen adds the playground chrome around it and turns the SDK's
 * `onDetection*` callbacks into the guidance the playground shows.
 */
export function CaptureScreen({
  camera,
  config,
  onSubmit,
  profileDraft,
  onNewSession,
  onClose,
}: {
  camera: PetnowCamera;
  /** The configuration for the *first* capture; a retake swaps the session. */
  config: PetnowCameraConfig;
  onSubmit?: SessionSubmit | null;
  /** What the profile page collected, for a registration. */
  profileDraft?: ProfileDraft | null;
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
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CameraResult | null>(null);
  const [newSessionPending, setNewSessionPending] = useState(false);
  /**
   * Whether every model this species needs is ready. Since 1.6.0 the preview
   * (and face-only frames) can come up before that; the screen says
   * "Preparing" until then instead of asking the user to aim.
   */
  const [detectionReady, setDetectionReady] = useState(false);

  const [sound, setSound] = useState<GuidanceSound>('random');
  const [soundPlaying, setSoundPlaying] = useState(false);
  const [soundPanelOpen, setSoundPanelOpen] = useState(false);
  const [tipsOpen, setTipsOpen] = useState(false);
  const soundHandle = useRef<number | null>(null);
  const soundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isCat = liveConfig.species === 'CAT';

  useEffect(() => {
    // Load the guidance samples up front so the first tap plays immediately.
    PetnowSound.prepare().catch(() => {});
    return () => {
      if (soundTimer.current) {
        clearTimeout(soundTimer.current);
      }
      PetnowSound.release();
    };
  }, []);

  // ---------------------------------------------------------------- guidance

  /**
   * The mask is shown once detection is running but nothing is locked on yet —
   * the playground's "detecting" state. Before the first status arrives the
   * screen shows "preparing" instead, so the ring does not sit over a black
   * preview while the SDK loads.
   */
  // ② Guide from detection feedback, not from the preview appearing.
  const maskVisible = detectionReady && status?.type === 'noObject';
  const guide =
    maskVisible && !error ? "Place your pet's face inside the circle" : null;

  const statusLabel = (() => {
    if (error) {
      return error;
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

  /** The floating banner, matching the playground's tracker message. */
  const banner: {message: string; tone: BannerTone} | null = (() => {
    if (error) {
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
        // Setup failures (bad config, license, permissions) arrive as
        // `unexpected` and carry the native message in `reason`.
        return {
          message:
            REASON_MESSAGES[status.reason] ?? 'Please try again',
          tone: 'error',
        };
      default:
        return null;
    }
  })();

  // ------------------------------------------------------------------- sound

  const soundOptions: {value: GuidanceSound; label: string}[] = [
    {value: 'random', label: 'Random'},
    {value: 'bagOfChips', label: 'Bag rustling'},
    {value: 'openingCan', label: 'Can opening'},
    {value: 'pouringFood', label: 'Pouring food'},
    {value: 'shakers', label: 'Shaker'},
    isCat
      ? {value: 'pspsps', label: 'Pspsps'}
      : {value: 'squeakyToy', label: 'Squeaky toy'},
  ];

  const stopSound = useCallback(() => {
    if (soundTimer.current) {
      clearTimeout(soundTimer.current);
    }
    if (soundHandle.current !== null) {
      PetnowSound.stop(soundHandle.current);
      soundHandle.current = null;
    }
    setSoundPlaying(false);
  }, []);

  const toggleSound = () => {
    if (soundPlaying) {
      stopSound();
      return;
    }
    const handle = PetnowSound.play(sound, liveConfig.species);
    if (handle < 0) {
      return;
    }
    soundHandle.current = handle;
    setSoundPlaying(true);
    // The native player has no completion callback; clear the active state
    // after a typical sample length so the button does not stay lit.
    soundTimer.current = setTimeout(() => setSoundPlaying(false), 3000);
  };

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
  const scanAgain = async () => {
    setResult(null);
    setStatus(null);
    setProgress(0);
    setError(null);
    setNewSessionPending(true);
    setDetectionReady(false);
    try {
      const sessionId = await onNewSession();
      setLiveConfig(current => ({...current, captureSessionId: sessionId}));
    } catch (e) {
      setError(`Could not start a new capture session: ${e}`);
    } finally {
      setNewSessionPending(false);
    }
  };

  if (result) {
    return (
      <ScanCompleteScreen
        result={result}
        isCat={isCat}
        askProfile={!!onSubmit && liveConfig.purpose === 'PET_PROFILE_REGISTRATION'}
        draft={profileDraft}
        onSubmit={
          onSubmit
            ? ((r, profile, onStep) =>
                onSubmit(r, profile, liveConfig.captureSessionId, onStep)) as CaptureSubmit
            : null
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
          onDetectionStatus={next => {
            setStatus(next);
            setError(null);
            // Anything past "no object" means detection is running, and a
            // failure (a refused key, say) has to show rather than wait behind
            // "Preparing" for a stats event.
            if (next.type !== 'noObject') {
              setDetectionReady(true);
            }
          }}
          // The SDK draws its own tracking marker; the raw boxes are here for
          // hosts that want to draw their own.
          onDetectionResult={() => {}}
          onPerformanceStats={stats => {
            if (stats.detectionReadyAtMs != null && !detectionReady) {
              setDetectionReady(true);
              // ⑤ engineReused: the models were ready when the camera started —
              // a prewarm took. Logged for you to check in the Metro console.
              console.info(
                `[Petnow] detection ready at ${stats.detectionReadyAtMs} ms, ` +
                  `engineReused=${stats.engineReused}`,
              );
            }
          }}
          onDetectionFinished={finished => {
            stopSound();
            setResult(finished);
          }}
        />
      )}

      <CameraMaskOverlay visible={maskVisible} guideMessage={guide} />

      {/* The SDK needs a moment to load its models and open the camera. */}
      {(status === null || !detectionReady) && !error ? (
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
        {soundPanelOpen ? (
          <View style={styles.panelSlot}>
            <SoundSelectionPanel
              value={sound}
              options={soundOptions}
              onSelect={next => {
                setSound(next);
                setSoundPanelOpen(false);
              }}
            />
          </View>
        ) : null}
        <CameraControls
          statusLabel={statusLabel}
          progress={progress}
          isSoundPlaying={soundPlaying}
          isSoundPanelOpen={soundPanelOpen}
          onSoundTap={toggleSound}
          onSoundLongPress={() => setSoundPanelOpen(true)}
          onCloseSoundPanel={() => setSoundPanelOpen(false)}
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
  panelSlot: {paddingHorizontal: 24, paddingBottom: 12},
});
