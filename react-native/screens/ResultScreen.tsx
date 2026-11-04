import React, {useState} from 'react';
import {Image, ScrollView, StyleSheet, Text, View} from 'react-native';

import type {ExampleServer, Session} from '../api';
import {Button, Card, Icon, MaterialIcon, Screen, colors} from '../ui';
import type {Capture} from './CameraScreen';

/** What the server answered, ready to show. */
interface Outcome {
  tone: 'success' | 'error' | 'neutral';
  title: string;
  lines: string[];
  note?: string;
}

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
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const sending = step !== null;

  /** Uploads every image to the session, then registers, verifies or identifies. */
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
          setOutcome({tone: 'success', title: 'Registered', lines: [`petId ${petId}`]});
        } else {
          setOutcome({tone: 'error', title: `Registration ${status}`, lines: []});
        }
      } else if (session.purpose === 'verify') {
        setStep('Verifying…');
        const {status, petId, isVerified, score} = await server.verify(session.id);
        setOutcome(
          status !== 'SUCCESS'
            ? {tone: 'error', title: `Verification ${status}`, lines: [`petId ${petId}`]}
            : {
                tone: isVerified ? 'success' : 'error',
                title: isVerified ? 'Same pet' : 'Not the same pet',
                lines: [`petId ${petId}`, `score ${score ?? '—'}`],
                note: "The server's decision is the answer, not the score.",
              },
        );
      } else {
        setStep('Identifying…');
        const {status, candidates} = await server.identify(session.id);
        setOutcome(
          status !== 'SUCCESS'
            ? {tone: 'error', title: `Identification ${status}`, lines: []}
            : candidates.length === 0
              ? {tone: 'neutral', title: 'No match', lines: []}
              : {
                  tone: candidates.some(c => c.isMatch) ? 'success' : 'neutral',
                  title: candidates.some(c => c.isMatch) ? 'Match found' : 'No match',
                  lines: candidates
                    .slice(0, 5)
                    .map(c => `${c.isMatch ? '✓ ' : ''}${c.petId} · ${c.score}`),
                },
        );
      }
    } catch (e) {
      setOutcome({tone: 'error', title: 'Request failed', lines: [e instanceof Error ? e.message : String(e)]});
    } finally {
      setStep(null);
    }
  };

  return (
    <Screen title="Result">
      <ScrollView contentContainerStyle={styles.content}>
        <Card title="Captured" glyph={MaterialIcon.photoCamera}>
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
        </Card>

        {!server ? (
          <Text style={styles.muted}>
            Run the example server to register or identify these images (server/README).
          </Text>
        ) : outcome ? (
          <OutcomeCard outcome={outcome} />
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

function OutcomeCard({outcome}: {outcome: Outcome}) {
  const tone = {success: colors.success, error: colors.error, neutral: colors.ink}[outcome.tone];
  const glyph = {
    success: MaterialIcon.checkCircle,
    error: MaterialIcon.cancel,
    neutral: MaterialIcon.infoOutline,
  }[outcome.tone];
  return (
    <View style={styles.outcome}>
      <View style={styles.outcomeTitle}>
        <Icon glyph={glyph} size={28} color={tone} />
        <Text style={[styles.title, {color: tone}]}>{outcome.title}</Text>
      </View>
      {outcome.lines.map(line => (
        <Text key={line} style={styles.row}>
          {line}
        </Text>
      ))}
      {outcome.note ? <Text style={styles.muted}>{outcome.note}</Text> : null}
    </View>
  );
}

/** The SDK reports file paths; `<Image>` wants a URI. */
const toUri = (path: string) => (path.startsWith('file://') ? path : `file://${path}`);

const styles = StyleSheet.create({
  content: {gap: 12},
  row: {fontSize: 16, color: colors.ink},
  muted: {fontSize: 14, lineHeight: 20, color: colors.inkMuted},
  preview: {height: 200, borderRadius: 12, backgroundColor: colors.appBg},
  outcome: {backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 8},
  outcomeTitle: {flexDirection: 'row', alignItems: 'center', gap: 8},
  title: {fontSize: 20, fontWeight: '700'},
});
