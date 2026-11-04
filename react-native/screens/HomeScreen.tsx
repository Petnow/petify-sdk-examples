import React from 'react';
import {StyleSheet, Text} from 'react-native';

import type {Purpose} from '../api';
import {EXAMPLE_SERVER, EXAMPLE_SERVER_HALF_SET, PETIFY_API_KEY} from '../config';
import {Button, Screen, colors} from '../ui';

export function HomeScreen({
  sdkError,
  sdkReady,
  onStart,
}: {
  /** The SDK could not store the key (`usePetnowCamera` state `error`). */
  sdkError: string | null;
  sdkReady: boolean;
  onStart: (purpose: Purpose) => void;
}) {
  const server = EXAMPLE_SERVER;
  const canStart = Boolean(PETIFY_API_KEY) && sdkReady;

  return (
    <Screen title="Home">
      <Text style={styles.lead}>
        Home → capture guide (prewarm) → camera → result. Nothing is prepared until you start.
      </Text>
      <Text style={styles.muted}>
        {server ? `Server mode: ${server.url}` : 'Camera-only mode: no example server configured.'}
      </Text>

      {!PETIFY_API_KEY ? (
        <Text style={styles.error}>Set PETIFY_API_KEY in .env, then restart Metro.</Text>
      ) : null}
      {EXAMPLE_SERVER_HALF_SET ? (
        <Text style={styles.error}>
          Server mode needs both EXAMPLE_SERVER_URL and EXAMPLE_SERVER_TOKEN in .env.
        </Text>
      ) : null}
      {sdkError ? <Text style={styles.error}>{sdkError}</Text> : null}

      <Button label="Identify a pet" disabled={!canStart} onPress={() => onStart('identify')} />
      <Button
        label="Register a pet"
        secondary
        disabled={!canStart || !server}
        onPress={() => onStart('register')}
      />
      {!server ? (
        <Text style={styles.muted}>Needs the example server (see server/README)</Text>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  lead: {fontSize: 16, lineHeight: 22, color: colors.text},
  muted: {fontSize: 14, color: colors.muted},
  error: {fontSize: 14, color: colors.error},
});
