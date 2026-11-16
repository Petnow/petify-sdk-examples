import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import type {ExampleServer, PetSummary, Purpose} from '../api';
import {EXAMPLE_SERVER, EXAMPLE_SERVER_HALF_SET, PETIFY_API_KEY} from '../config';
import {Button, Card, Icon, MaterialIcon, colors} from '../ui';

const TIPS = [
  {
    glyph: MaterialIcon.wbSunny,
    title: 'Shoot in a bright place.',
    body: "An environment where the pet's nose and face are clearly visible works best.",
  },
  {
    glyph: MaterialIcon.centerFocusStrong,
    title: 'Follow the guide.',
    body: "Fit the dog's nose inside the on-screen guide.",
  },
  {
    glyph: MaterialIcon.volumeUp,
    title: 'Use sounds to draw attention.',
    body: 'Sounds can help get your pet to look at the camera.',
  },
];

export function HomeScreen({
  sdkError,
  sdkReady,
  server,
  onStart,
}: {
  /** The SDK could not store the key (`usePetnowCamera` state `error`). */
  sdkError: string | null;
  sdkReady: boolean;
  /** Null in camera-only mode. */
  server: ExampleServer | null;
  /** `petId` is the pet to verify against. */
  onStart: (purpose: Purpose, petId?: string) => void;
}) {
  const canStart = Boolean(PETIFY_API_KEY) && sdkReady;

  return (
    <View style={styles.screen}>
      {/* Two safe areas: the white bar takes the top inset, the list the bottom one. */}
      <SafeAreaView style={styles.topBar}>
        <Text style={styles.wordmark} accessibilityRole="header">
          Petify
        </Text>
      </SafeAreaView>
      <SafeAreaView style={styles.fill}>
        <ScrollView contentContainerStyle={styles.content}>
          {!PETIFY_API_KEY ? (
            <Notice message="Set PETIFY_API_KEY in .env, then restart Metro." glyph={MaterialIcon.keyOff} />
          ) : null}
          {EXAMPLE_SERVER_HALF_SET ? (
            <Notice message="Server mode needs both EXAMPLE_SERVER_URL and EXAMPLE_SERVER_TOKEN in .env." />
          ) : null}
          {sdkError ? <Notice message={sdkError} /> : null}

          <Card title="Biometric scan" glyph={MaterialIcon.pets}>
            <View style={styles.actions}>
              <ActionCard
                label={'Identify\na pet'}
                accessibilityLabel="Identify a pet"
                glyph={MaterialIcon.qrCodeScanner}
                onPress={canStart ? () => onStart('identify') : undefined}
              />
              <ActionCard
                label={'Register\na pet'}
                accessibilityLabel="Register a pet"
                glyph={MaterialIcon.photoCamera}
                onPress={canStart && server ? () => onStart('register') : undefined}
              />
            </View>
            {!server ? <Text style={styles.muted}>Needs the example server (see server/README)</Text> : null}
          </Card>

          <Card title="Pets" glyph={MaterialIcon.pets}>
            {server ? (
              <PetList server={server} enabled={canStart} onVerify={petId => onStart('verify', petId)} />
            ) : (
              <Text style={styles.muted}>
                Run the example server (server/README) to register and verify pets.
              </Text>
            )}
          </Card>

          <Card title="Before you scan" glyph={MaterialIcon.infoOutline}>
            {TIPS.map(tip => (
              <View key={tip.title} style={styles.tip}>
                <Icon glyph={tip.glyph} size={28} color={colors.main} />
                <View style={styles.tipText}>
                  <Text style={styles.tipTitle}>{tip.title}</Text>
                  <Text style={styles.muted}>{tip.body}</Text>
                </View>
              </View>
            ))}
          </Card>

          <Text style={styles.footer}>
            {EXAMPLE_SERVER ? `Server mode: ${EXAMPLE_SERVER.url}` : 'Camera-only mode'}
          </Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/**
 * The pets this example registered, from the example server. Home mounts again
 * whenever the user comes back to it, so a pet registered a moment ago shows up.
 */
function PetList({
  server,
  enabled,
  onVerify,
}: {
  server: ExampleServer;
  enabled: boolean;
  onVerify: (petId: string) => void;
}) {
  const [pets, setPets] = useState<PetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    let active = true;
    setPets(null);
    setError(null);
    server.listPets().then(
      list => active && setPets(list),
      e => active && setError(e instanceof Error ? e.message : String(e)),
    );
    return () => {
      active = false;
    };
  }, [server]);
  useEffect(load, [load]);

  if (error) {
    return (
      <View style={styles.listState}>
        <Text style={styles.error}>{error}</Text>
        <Button label="Retry" secondary onPress={load} />
      </View>
    );
  }
  if (!pets) {
    return <ActivityIndicator color={colors.main} style={styles.listState} />;
  }
  if (pets.length === 0) {
    return <Text style={styles.muted}>No pets yet. Register a pet first.</Text>;
  }
  return (
    <View>
      {pets.map((pet, index) => (
        <Pressable
          key={pet.petId}
          onPress={enabled ? () => onVerify(pet.petId) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Verify ${pet.petId}`}
          accessibilityState={{disabled: !enabled}}
          style={[styles.petRow, index > 0 && styles.petRowLine, !enabled && styles.disabled]}>
          <View style={styles.avatar}>
            <Icon glyph={MaterialIcon.pets} size={24} color={colors.brand} />
          </View>
          <View style={styles.petText}>
            <Text style={styles.petTitle}>{`${pet.petId.slice(0, 8)}…`}</Text>
            <Text style={styles.muted}>Tap to verify this pet</Text>
          </View>
          <Icon glyph={MaterialIcon.chevronRight} color={colors.inkFaint} />
        </Pressable>
      ))}
    </View>
  );
}

/** One of the two big blue cards: a two-line title and a large icon in the corner. */
function ActionCard({
  label,
  accessibilityLabel,
  glyph,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  glyph: string;
  /** Undefined = disabled. */
  onPress?: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{disabled: !onPress}}
      style={[styles.actionCard, !onPress && styles.disabled]}>
      <Text style={styles.actionLabel}>{label}</Text>
      <View style={styles.actionIcon}>
        <Icon glyph={glyph} size={72} color="rgba(255,255,255,0.3)" />
      </View>
    </Pressable>
  );
}

function Notice({message, glyph = MaterialIcon.errorOutline}: {message: string; glyph?: string}) {
  return (
    <View style={styles.notice}>
      <Icon glyph={glyph} size={20} color={colors.error} />
      <Text style={[styles.error, styles.noticeText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.appBg},
  topBar: {backgroundColor: colors.surface},
  wordmark: {fontSize: 28, fontWeight: '800', color: colors.ink, paddingHorizontal: 16, paddingVertical: 12},
  fill: {flex: 1},
  content: {padding: 16, gap: 12},
  actions: {flexDirection: 'row', gap: 12},
  actionCard: {
    flex: 1,
    height: 176,
    borderRadius: 12,
    padding: 16,
    overflow: 'hidden',
    backgroundColor: colors.actionCard,
  },
  actionLabel: {fontSize: 20, lineHeight: 28, fontWeight: '700', color: '#FFFFFF'},
  actionIcon: {position: 'absolute', right: -4, bottom: -4},
  disabled: {opacity: 0.4},
  listState: {gap: 12, paddingVertical: 8},
  petRow: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12},
  petRowLine: {borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.hairline},
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceTint,
  },
  petText: {flex: 1, gap: 2},
  petTitle: {fontSize: 16, fontWeight: '600', color: colors.ink},
  tip: {flexDirection: 'row', gap: 12},
  tipText: {flex: 1, gap: 2},
  tipTitle: {fontSize: 15, fontWeight: '600', color: colors.ink},
  muted: {fontSize: 14, lineHeight: 20, color: colors.inkMuted},
  error: {fontSize: 14, lineHeight: 20, color: colors.error},
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.surface,
  },
  noticeText: {flex: 1},
  footer: {fontSize: 13, color: colors.inkMuted, textAlign: 'center', paddingVertical: 8},
});
