import React, {useEffect, useRef, useState} from 'react';
import {ActivityIndicator, StyleSheet, Text, View} from 'react-native';
import {PetnowPrewarm} from '@petify/react-native-camera-ui';

import type {Session} from '../api';
import {Button, Screen, colors} from '../ui';

/**
 * The screen before the camera: the user reads it for a few seconds, which is
 * exactly the time prewarm needs. It also gets the capture session the camera
 * will run on.
 */
export function GuideScreen({
  sdkReady,
  createSession,
  discardSession,
  onOpenCamera,
  onBack,
}: {
  /** `usePetnowCamera(...).state.status === 'ready'`: the SDK holds the key. */
  sdkReady: boolean;
  createSession: () => Promise<Session>;
  /** For a session this screen got but never handed to the camera. */
  discardSession: (session: Session) => void;
  /** Resolves false when the camera could not be opened (permission refused). */
  onOpenCamera: (session: Session) => Promise<boolean>;
  onBack: () => void;
}) {
  // ① Prewarm here, on the screen whose button leads to the camera. It validates
  //    the licence and loads the models now, so the camera screen only has to
  //    open the camera. Fire and forget: it resolves once the request is taken,
  //    not when the models are ready, and an invalid key still surfaces on the
  //    camera, not here. No species — an engine prepared without one serves
  //    whichever camera opens. It needs the key `usePetnowCamera` stored, so it
  //    waits for the SDK to be ready.
  useEffect(() => {
    if (sdkReady) {
      PetnowPrewarm.start().catch(() => {});
    }
  }, [sdkReady]);

  const [session, setSession] = useState<Session | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** "Try again" bumps this, which asks for a session once more. */
  const [attempt, setAttempt] = useState(0);
  const handedOff = useRef(false);

  // Your server issues the capture session; in camera-only mode the app asks
  // for one itself. Coming back to this screen asks for a new one: a session
  // backs exactly one capture.
  useEffect(() => {
    let active = true;
    let created: Session | null = null;
    setSession(null);
    setError(null);
    createSession().then(
      s => {
        if (active) {
          created = s;
          setSession(s);
        } else {
          discardSession(s); // the user left while it was on its way
        }
      },
      e => active && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      active = false;
      if (created && !handedOff.current) {
        discardSession(created);
      }
    };
    // createSession/discardSession are fixed for the life of this screen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  const open = async () => {
    if (session) {
      handedOff.current = true; // the camera owns the session from here
      handedOff.current = await onOpenCamera(session);
    }
  };

  return (
    <Screen title="Capture guide" onBack={onBack}>
      <Text style={styles.heading}>Before you start</Text>
      <Text style={styles.tip}>• Get close enough that the nose fills the frame.</Text>
      <Text style={styles.tip}>• Use soft, even light and avoid glare on the nose.</Text>
      <Text style={styles.tip}>• Hold still until the progress is complete.</Text>
      <View style={styles.spacer} />
      {error ? (
        <>
          <Text style={styles.error}>Could not create a capture session: {error}</Text>
          <Button label="Try again" secondary onPress={() => setAttempt(n => n + 1)} />
        </>
      ) : session ? (
        <Button label="Open camera" onPress={open} />
      ) : (
        <View style={styles.waiting}>
          <ActivityIndicator color={colors.accent} />
          <Text style={styles.tip}>Creating a capture session…</Text>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  heading: {fontSize: 20, fontWeight: '600', color: colors.text},
  tip: {fontSize: 16, lineHeight: 22, color: colors.text},
  spacer: {flex: 1},
  error: {fontSize: 14, color: colors.error},
  waiting: {alignItems: 'center', gap: 8},
});
