/**
 * Quickstart — the smallest complete integration of
 * `@petify/react-native-camera-ui`.
 *
 * Point the app entry at this file to run it:
 *   // index.js
 *   import Quickstart from './quickstart';
 *   AppRegistry.registerComponent(appName, () => Quickstart);
 *
 * Everything the SDK needs is in this one file, in the order you would add it to
 * your own app. The full example next to it (`App.tsx`) adds the product UI and
 * the server calls on top of exactly this.
 *
 * What this file does NOT do, on purpose:
 *   - style the capture screen (see the full example)
 *   - talk to a server (see demo/demoBackend.ts, and the note on the capture
 *     session id below)
 */
import React, {useEffect, useState} from 'react';
import {
  Alert,
  Linking,
  PermissionsAndroid,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  CameraView,
  PetnowSound,
  usePetnowCamera,
  type CameraResult,
  type DetectionStatus,
} from '@petify/react-native-camera-ui';

import {guideMessage} from './petnowGuidance';

declare const process: {env: {PETIFY_API_KEY?: string}};
const API_KEY = process.env.PETIFY_API_KEY ?? '';

export default function Quickstart(): React.JSX.Element {
  // 1. One controller per app. It holds the license and the native camera
  //    session, so keep it alive across captures.
  const camera = usePetnowCamera({apiKey: API_KEY});

  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState<DetectionStatus | null>(null);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<CameraResult | null>(null);
  // From the camera's error state: the capture cannot run at all.
  const error = camera.state.status === 'error' ? camera.state.error : null;

  useEffect(() => {
    // 2. Guidance sounds are optional, but they are what makes a pet look at
    //    the lens. Load the samples once, release them when you are done.
    PetnowSound.prepare().catch(() => {});
    return () => PetnowSound.release();
  }, []);

  const startCapture = async () => {
    // 3. You own the camera permission; the SDK does not ask for it.
    if (Platform.OS === 'android') {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
      );
      if (granted !== PermissionsAndroid.RESULTS.GRANTED) {
        // NEVER_ASK_AGAIN means the OS will not prompt again — send the user to
        // Settings instead of silently failing.
        Alert.alert('Camera permission is required.', undefined, [
          {text: 'Cancel', style: 'cancel'},
          {text: 'Settings', onPress: () => Linking.openSettings()},
        ]);
        return;
      }
    }
    // 4. Mount the camera only once the SDK reports ready.
    if (camera.state.status !== 'ready') {
      return;
    }
    setResult(null);
    setStatus(null);
    setProgress(0);
    setCapturing(true);
  };

  // 5. The capture session id must be a UUID issued by your backend
  //    (`POST /v2/capture-sessions`); the server ties the uploaded images to it.
  //    A registration session must be scoped to a pet your backend created
  //    first, or the server answers PETNOWB2B20011. One session backs one job,
  //    so a retake needs a new one (PETNOWB2B20014).
  const sessionId = '00000000-0000-4000-8000-000000000000';

  if (capturing) {
    return (
      <View style={styles.cameraScreen}>
        <CameraView
          camera={camera}
          style={StyleSheet.absoluteFill}
          species="DOG"
          purpose="PET_PROFILE_REGISTRATION"
          captureSessionId={sessionId}
          onDetectionStatus={setStatus}
          onDetectionProgress={setProgress}
          // 6. The result holds local file paths: `fingerprintImages` are the
          //    nose prints, `appearanceImages` the matching face frames. They
          //    live in the app's cache directory, so upload them (through your
          //    backend) before the OS reclaims the space.
          onDetectionFinished={finished => {
            setResult(finished);
            setCapturing(false);
          }}
        />
        <SafeAreaView style={styles.overlay}>
          <Text style={styles.guide}>{guideMessage(status)}</Text>
          {progress > 0 ? <Text style={styles.progress}>{progress}%</Text> : null}
          <Pressable style={styles.button} onPress={() => setCapturing(false)}>
            <Text style={styles.buttonLabel}>Cancel</Text>
          </Pressable>
        </SafeAreaView>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <Text style={styles.title}>PetNow quickstart</Text>
      {error ? (
        <>
          <Text style={styles.error}>{error}</Text>
          <Pressable style={styles.button} onPress={() => camera.retry()}>
            <Text style={styles.buttonLabel}>Retry</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.state}>SDK: {camera.state.status}</Text>
          {result ? (
            <Text style={styles.state}>
              {result.fingerprintImages.length} nose /{' '}
              {result.appearanceImages.length} face images
            </Text>
          ) : null}
          <Pressable
            style={[styles.button, camera.state.status !== 'ready' && styles.disabled]}
            disabled={camera.state.status !== 'ready'}
            onPress={startCapture}>
            <Text style={styles.buttonLabel}>Capture</Text>
          </Pressable>
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12},
  cameraScreen: {flex: 1, backgroundColor: '#000'},
  overlay: {position: 'absolute', left: 0, right: 0, bottom: 0, padding: 24, gap: 12},
  title: {fontSize: 20, fontWeight: '700'},
  state: {color: '#4B5563'},
  error: {color: '#FF323E', paddingHorizontal: 32, textAlign: 'center'},
  guide: {color: '#FFF', fontSize: 16, textAlign: 'center'},
  progress: {color: '#FFF', textAlign: 'center'},
  button: {
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 10,
    backgroundColor: '#0033B5',
    alignItems: 'center',
  },
  disabled: {opacity: 0.4},
  buttonLabel: {color: '#FFF', fontSize: 16, fontWeight: '600'},
});
