/**
 * Example app for `@petify/react-native-camera-ui`:
 * Home → Capture guide → Camera → Result.
 *
 * SDK 1.6.0 prewarm, in the comments numbered ①–⑤:
 *   ① screens/GuideScreen.tsx   PetnowPrewarm.start() when the guide appears
 *   ② screens/CameraScreen.tsx  "Getting ready" until detectionReadyAtMs
 *   ③ screens/CameraScreen.tsx  retry on the open camera with startDetection()
 *   ④ App.tsx (below)           PetnowPrewarm.release() back on Home
 *   ⑤ screens/CameraScreen.tsx  engineReused, logged and shown on the result
 *
 * The app holds a Client key only (`PETIFY_API_KEY` in .env). Without an
 * example server it runs in camera-only mode: it opens an identification
 * session itself and captures, but uploads nothing. With `EXAMPLE_SERVER_URL`
 * and `EXAMPLE_SERVER_TOKEN` set, the server creates the sessions and the
 * result screen sends the images to it to register or identify.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Alert, AppState, BackHandler, Linking, PermissionsAndroid, Platform} from 'react-native';
import {PetnowPrewarm, usePetnowCamera} from '@petify/react-native-camera-ui';

import {ExampleServer, createIdentificationSession, type Purpose, type Session} from './api';
import {EXAMPLE_SERVER, PETIFY_API_KEY} from './config';
import {CameraScreen, type Capture} from './screens/CameraScreen';
import {GuideScreen} from './screens/GuideScreen';
import {HomeScreen} from './screens/HomeScreen';
import {ResultScreen} from './screens/ResultScreen';

type Route =
  | {screen: 'home'}
  | {screen: 'guide'; purpose: Purpose}
  | {screen: 'camera'; session: Session}
  | {screen: 'result'; session: Session; capture: Capture};

export default function App(): React.JSX.Element {
  const camera = usePetnowCamera({apiKey: PETIFY_API_KEY});
  const sdkReady = camera.state.status === 'ready';
  const server = useMemo(
    () => (EXAMPLE_SERVER ? new ExampleServer(EXAMPLE_SERVER.url, EXAMPLE_SERVER.token) : null),
    [],
  );
  const [route, setRoute] = useState<Route>({screen: 'home'});

  // ④ Release what prewarm prepared once the user is back on Home — not when
  //    the guide goes away, which also happens on the way into the camera and
  //    would throw away the engine the camera is about to take. Optional: the
  //    SDK also lets go under memory pressure.
  const atHome = route.screen === 'home';
  const leftHome = useRef(false);
  useEffect(() => {
    if (!atHome) {
      leftHome.current = true;
    } else if (leftHome.current) {
      leftHome.current = false;
      PetnowPrewarm.release().catch(() => {});
    }
  }, [atHome]);

  // Stop analysing frames while the app is in the background. Only
  // `background`: iOS also reports `inactive` for the permission prompt and
  // Control Center, where the camera should keep going.
  useEffect(() => {
    let paused = false;
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background' && !paused) {
        paused = true;
        camera.pauseDetection();
      } else if (next === 'active' && paused) {
        paused = false;
        camera.resumeDetection();
      }
    });
    return () => sub.remove();
  }, [camera]);

  // A registration session comes with a pet the server created for it. If the
  // user leaves before the registration succeeds, ask the server to delete it.
  const registered = useRef(new Set<string>());
  const leaveSession = useCallback(
    (session: Session) => {
      if (session.purpose === 'register' && !registered.current.has(session.id)) {
        server?.deleteSession(session.id).catch(() => {}); // fire and forget
      }
    },
    [server],
  );

  const createSession = (purpose: Purpose) =>
    server
      ? server.createSession(purpose)
      : createIdentificationSession(PETIFY_API_KEY);

  /** False when the camera permission was refused; the user stays on the guide. */
  const openCamera = async (session: Session): Promise<boolean> => {
    if (!(await requestCameraPermission())) {
      return false;
    }
    setRoute({screen: 'camera', session});
    return true;
  };

  /** One step back, for the Back buttons and Android's back button. False on Home. */
  const goBack = useCallback((): boolean => {
    switch (route.screen) {
      case 'home':
        return false;
      case 'guide':
        setRoute({screen: 'home'});
        return true;
      case 'camera':
        // Back to the guide, which gets a fresh session for the next try.
        leaveSession(route.session);
        setRoute({screen: 'guide', purpose: route.session.purpose});
        return true;
      case 'result':
        leaveSession(route.session);
        setRoute({screen: 'home'});
        return true;
    }
  }, [route, leaveSession]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  switch (route.screen) {
    case 'home':
      return (
        <HomeScreen
          sdkReady={sdkReady}
          sdkError={camera.state.status === 'error' ? camera.state.error : null}
          onStart={purpose => setRoute({screen: 'guide', purpose})}
        />
      );
    case 'guide':
      return (
        <GuideScreen
          sdkReady={sdkReady}
          createSession={() => createSession(route.purpose)}
          discardSession={leaveSession}
          onOpenCamera={openCamera}
          onBack={goBack}
        />
      );
    case 'camera':
      return (
        <CameraScreen
          camera={camera}
          session={route.session}
          // The result replaces the camera: its session is used up.
          onCaptured={capture => setRoute({screen: 'result', session: route.session, capture})}
          onClose={goBack}
        />
      );
    case 'result':
      return (
        <ResultScreen
          capture={route.capture}
          session={route.session}
          server={server}
          onRegistered={() => registered.current.add(route.session.id)}
          onDone={goBack}
        />
      );
  }
}

/** iOS asks on its own when the camera opens; Android needs the app to ask. */
async function requestCameraPermission(): Promise<boolean> {
  if (Platform.OS !== 'android') {
    return true;
  }
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.CAMERA);
  if (result === PermissionsAndroid.RESULTS.GRANTED) {
    return true;
  }
  if (result === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
    // Android no longer asks; only the app's settings page can grant it.
    Alert.alert('Camera permission needed', 'Allow camera access in Settings to scan.', [
      {text: 'Cancel', style: 'cancel'},
      {text: 'Settings', onPress: () => Linking.openSettings()},
    ]);
  } else {
    Alert.alert('Camera permission needed', 'The scan needs the camera.');
  }
  return false;
}
