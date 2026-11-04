import React, {useState} from 'react';
import {Image, ScrollView, StyleSheet, Text} from 'react-native';

import type {ExampleServer, Session} from '../api';
import {Button, Screen, colors} from '../ui';
import type {Capture} from './CameraScreen';

export function ResultScreen({
  capture,
  session,
  server,
  onRegistered,
  onDone,
}: {
  capture: Capture;
  session: Session;
  /** Null in camera-only mode. */
  server: ExampleServer | null;
  /** The registration went through, so leaving must not delete the pet. */
  onRegistered: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<string[] | null>(null);
  const sending = step !== null;

  /** Uploads every image to the session, then registers or identifies. */
  const send = async () => {
    if (!server) {
      return;
    }
    try {
      const uploads = [
        ...capture.fingerprintImages.map(path => ['fingerprints', path] as const),
        ...capture.appearanceImages.map(path => ['appearances', path] as const),
      ];
      for (const [index, [kind, path]] of uploads.entries()) {
        setStep(`Uploading ${index + 1} of ${uploads.length}…`);
        await server.upload(session.id, kind, path);
      }
      if (session.purpose === 'register') {
        setStep('Registering…');
        const {status, petId} = await server.register(session.id);
        if (status === 'SUCCESS') {
          onRegistered();
          setOutcome(['Registered', `petId ${petId}`]);
        } else {
          setOutcome([`Registration ${status}`]);
        }
      } else {
        setStep('Identifying…');
        const {status, candidates} = await server.identify(session.id);
        setOutcome(
          status !== 'SUCCESS'
            ? [`Identification ${status}`]
            : candidates.length === 0
              ? ['No match']
              : candidates
                  .slice(0, 5)
                  .map(c => `${c.isMatch ? '✓ ' : ''}${c.petId} · ${c.score}`),
        );
      }
    } catch (e) {
      setOutcome([e instanceof Error ? e.message : String(e)]);
    } finally {
      setStep(null);
    }
  };

  return (
    <Screen title="Result">
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.row}>Nose images: {capture.fingerprintImages.length}</Text>
        <Text style={styles.row}>Appearance images: {capture.appearanceImages.length}</Text>
        {/* ⑤ also logged to the Metro console when detection became ready */}
        <Text style={styles.row}>
          Engine ready at camera start: {capture.engineReused ? 'Yes' : 'No'}
        </Text>
        {capture.fingerprintImages[0] ? (
          <Image
            source={{uri: toUri(capture.fingerprintImages[0])}}
            style={styles.preview}
            resizeMode="contain"
          />
        ) : null}

        {!server ? (
          <Text style={styles.muted}>
            Run the example server to register or identify these images (server/README).
          </Text>
        ) : outcome ? (
          outcome.map(line => (
            <Text key={line} style={styles.row}>
              {line}
            </Text>
          ))
        ) : sending ? (
          <Text style={styles.muted}>{step}</Text>
        ) : (
          <Button label="Send" onPress={send} />
        )}
      </ScrollView>
      <Button label="Done" secondary={Boolean(server) && !outcome} disabled={sending} onPress={onDone} />
    </Screen>
  );
}

/** The SDK reports file paths; `<Image>` wants a URI. */
const toUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

const styles = StyleSheet.create({
  content: {gap: 12},
  row: {fontSize: 16, color: colors.text},
  muted: {fontSize: 14, lineHeight: 20, color: colors.muted},
  preview: {height: 200, borderRadius: 12, backgroundColor: '#F1F1F1'},
});
