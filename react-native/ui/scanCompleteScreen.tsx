import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {CameraResult} from '@petify/react-native-camera-ui';

import {
  Petify,
  PetifyPrimaryButton,
  PetifySecondaryButton,
  toFileUri,
  withAlpha,
} from './petifyUi';

/**
 * Runs the server step for a finished capture, reporting progress through
 * `onStep`. See `App.tsx`'s `submit`.
 */
export type CaptureSubmit = (
  result: CameraResult,
  profile: ProfileDraft,
  onStep: (step: string) => void,
) => Promise<SubmitResult>;

/**
 * What a registration saves with the pet: the name typed here. Empty for
 * identify / verify.
 *
 * Only `species` is a real field on a pet; the name goes into the pet's
 * free-form `metadata` (see `DemoBackend.setName`), which is where your
 * app would keep its own pet record.
 */
export interface ProfileDraft {
  name?: string;
}

/** Outcome of a register / identify / verify round trip. */
export interface SubmitResult {
  ok: boolean;
  title: string;
  lines: string[];
  /** Extra guidance shown under the result (e.g. score-is-not-a-verdict). */
  note?: string;
}

/**
 * Capture result: the captured images in a grid, then confirm or scan again.
 *
 * Confirming runs `onSubmit` — upload plus the purpose's server call — and
 * shows what came back.
 */
export function ScanCompleteScreen({
  result,
  isCat,
  onSubmit,
  askName = false,
  onScanAgain,
  onDone,
}: {
  result: CameraResult;
  isCat: boolean;
  onSubmit: CaptureSubmit;
  /** A registration names the pet here. */
  askName?: boolean;
  onScanAgain: () => void;
  onDone: () => void;
}) {
  const [step, setStep] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubmitResult | null>(null);
  const [name, setName] = useState('');

  const images = result.fingerprintImages;
  const noun = isCat ? 'face' : 'nose print';
  const busy = step !== null;
  // A stopped scan has nothing worth sending; the only way on is another scan.
  const canConfirm = result.success && images.length > 0;

  const confirm = async () => {
    setStep('Uploading images…');
    const profile: ProfileDraft = askName ? {name: name.trim()} : {};
    const submitted = await onSubmit(result, profile, setStep);
    setStep(null);
    setOutcome(submitted);
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>
          {result.success ? 'Scan Complete!' : 'Scan stopped'}
        </Text>
        <Text style={styles.subtitle}>
          {images.length} {noun} images captured
        </Text>
      </View>

      {images.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={styles.empty}>No images were captured.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid}>
          {images.map((path, index) => (
            <View key={path} style={styles.photoCard}>
              <Image
                source={{uri: toFileUri(path)}}
                style={styles.photo}
                resizeMode="cover"
              />
              <Text style={styles.photoIndex}>{index + 1}</Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.footer}>
        {askName && outcome === null ? (
          <TextInput
            style={styles.nameInput}
            placeholder="Pet name (optional)"
            placeholderTextColor={Petify.inkFaint}
            editable={!busy}
            value={name}
            onChangeText={setName}
          />
        ) : null}

        {busy ? (
          <View style={styles.stepRow}>
            <ActivityIndicator size="small" color={Petify.brand} />
            <Text style={styles.stepText}>{step}</Text>
          </View>
        ) : null}

        {outcome ? <OutcomeCard outcome={outcome} /> : null}

        <PetifyPrimaryButton
          label={outcome ? 'Done' : 'Confirm'}
          busy={busy}
          onPress={busy ? null : outcome ? onDone : canConfirm ? confirm : null}
        />
        <View style={styles.gap} />
        <PetifySecondaryButton label="Scan Again" onPress={busy ? null : onScanAgain} />
      </View>

    </SafeAreaView>
  );
}

function OutcomeCard({outcome}: {outcome: SubmitResult}) {
  const tone = outcome.ok ? Petify.success : Petify.error;
  return (
    <View
      style={[
        styles.outcome,
        {backgroundColor: withAlpha(tone, 0.08), borderColor: withAlpha(tone, 0.25)},
      ]}>
      <Text style={[styles.outcomeTitle, {color: tone}]}>{outcome.title}</Text>
      {outcome.lines.map((line, index) => (
        <Text key={index} style={styles.outcomeLine}>
          {line}
        </Text>
      ))}
      {outcome.note ? <Text style={styles.outcomeNote}>{outcome.note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: '#FFFFFF'},
  header: {paddingHorizontal: 20, paddingTop: 20, paddingBottom: 12},
  title: {fontSize: 22, fontFamily: Petify.fontBold, color: Petify.ink},
  subtitle: {marginTop: 2, fontSize: 14, fontFamily: Petify.font, color: Petify.inkFaint},
  emptyWrap: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  empty: {color: Petify.inkFaint, fontFamily: Petify.font},
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  photoCard: {width: '31%', aspectRatio: 1, borderRadius: 10, overflow: 'hidden'},
  photo: {width: '100%', height: '100%', backgroundColor: Petify.surfaceMuted},
  photoIndex: {
    position: 'absolute',
    left: 6,
    top: 4,
    color: '#FFFFFF',
    fontSize: 12,
    fontFamily: Petify.fontBold,
    textShadowColor: 'rgba(0,0,0,0.6)',
    textShadowRadius: 3,
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: Petify.hairline,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  nameInput: {
    height: 52,
    marginBottom: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Petify.hairline,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Petify.font,
    color: Petify.ink,
  },
  gap: {height: 10},
  stepRow: {flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12},
  stepText: {color: Petify.inkMuted, fontSize: 14, fontFamily: Petify.font},
  outcome: {borderRadius: 10, borderWidth: 1, padding: 14, marginBottom: 12},
  outcomeTitle: {fontSize: 15, fontFamily: Petify.fontBold},
  outcomeLine: {
    marginTop: 4,
    fontSize: 13,
    fontFamily: Petify.font,
    color: Petify.inkMuted,
  },
  outcomeNote: {
    marginTop: 8,
    fontSize: 12,
    fontFamily: Petify.font,
    color: Petify.inkFaint,
    lineHeight: 17,
  },
});
