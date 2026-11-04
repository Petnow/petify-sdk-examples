import React, {useState} from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {CameraResult} from '@petify/react-native-camera-ui';

import {
  PetAvatar,
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
 * What a registration should save as the pet's profile: what the user typed on
 * the profile page, plus the face frame they pick here. Empty for identify /
 * verify.
 *
 * Only `species` is a real field on a pet; the rest is written to the pet's
 * free-form `metadata` (see `DemoBackend.updateMetadata`).
 */
export interface ProfileDraft {
  name?: string;
  breed?: string | null;
  gender?: 'MALE' | 'FEMALE' | null;
  neutered?: boolean;
  /** `YYYY-MM-DD`. */
  birthdate?: string | null;
  imagePath?: string;
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
 * Capture result, mirroring the playground's scan-complete step: the captured
 * images in a grid, then confirm or scan again.
 *
 * Confirming runs `onSubmit` — upload plus the purpose's server call — and
 * shows what came back. Without a backend it simply closes.
 */
export function ScanCompleteScreen({
  result,
  isCat,
  onSubmit,
  askProfile = false,
  draft,
  onScanAgain,
  onDone,
}: {
  result: CameraResult;
  isCat: boolean;
  onSubmit?: CaptureSubmit | null;
  /** Registration finishes the pet's profile — the photo — here. */
  askProfile?: boolean;
  /** What the profile page collected before the scan. */
  draft?: ProfileDraft | null;
  onScanAgain: () => void;
  onDone: () => void;
}) {
  const [profilePick, setProfilePick] = useState(0);
  const [step, setStep] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<SubmitResult | null>(null);
  const [name, setName] = useState(draft?.name ?? '');
  const [picking, setPicking] = useState(false);

  const images = result.fingerprintImages;
  const noun = isCat ? 'face' : 'nose print';
  const busy = step !== null;
  const profileImage = result.appearanceImages[profilePick];

  const confirm = async () => {
    if (!onSubmit) {
      onDone();
      return;
    }
    setStep('Uploading images…');
    const profile: ProfileDraft = askProfile
      ? {...draft, name: name.trim(), imagePath: profileImage}
      : {};
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
          {images.length} {noun} images captured — all of them are registered together
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
        {askProfile && outcome === null ? (
          <View style={styles.profileEditor}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Choose the profile photo"
              disabled={busy || result.appearanceImages.length < 2}
              onPress={() => setPicking(true)}>
              <PetAvatar imagePath={profileImage} size={56} />
            </Pressable>
            {draft?.name ? (
              // The profile page already asked; this only picks the photo.
              <View style={{flex: 1}}>
                <Text style={styles.profileName} numberOfLines={1}>
                  {draft.name}
                </Text>
                <Text style={styles.profileHint} numberOfLines={1}>
                  {profileDetail(draft) || 'Tap the photo to choose another frame'}
                </Text>
              </View>
            ) : (
              <TextInput
                style={styles.nameInput}
                placeholder="Pet name"
                placeholderTextColor={Petify.inkFaint}
                editable={!busy}
                value={name}
                onChangeText={setName}
              />
            )}
          </View>
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
          onPress={busy || images.length === 0 ? null : outcome ? onDone : confirm}
        />
        <View style={{height: 10}} />
        <PetifySecondaryButton label="Scan Again" onPress={busy ? null : onScanAgain} />
      </View>

      {/* Which face frame becomes the profile photo. */}
      <Modal visible={picking} transparent animationType="fade">
        <Pressable style={styles.pickBackdrop} onPress={() => setPicking(false)} />
        <View style={styles.pickSheet}>
          <Text style={styles.pickTitle}>Profile photo</Text>
          <ScrollView horizontal contentContainerStyle={styles.pickRow}>
            {result.appearanceImages.map((path, index) => (
              <Pressable
                key={path}
                accessibilityRole="button"
                onPress={() => {
                  setProfilePick(index);
                  setPicking(false);
                }}>
                <Image
                  source={{uri: toFileUri(path)}}
                  style={[styles.pickImage, index === profilePick && styles.pickImageOn]}
                />
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/** "Poodle · Female · 2 y" — the profile page's answers, in one line. */
function profileDetail(draft: ProfileDraft): string {
  return [
    draft.breed,
    draft.gender === 'MALE' ? 'Male' : draft.gender === 'FEMALE' ? 'Female' : null,
    draft.neutered ? 'Neutered' : null,
    draft.birthdate,
  ]
    .filter(Boolean)
    .join(' · ');
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
      {outcome.lines.map(line => (
        <Text key={line} style={styles.outcomeLine}>
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
  profileEditor: {flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12},
  nameInput: {
    flex: 1,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Petify.hairline,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Petify.font,
    color: Petify.ink,
  },
  profileName: {fontSize: 16, fontFamily: Petify.fontBold, color: Petify.ink},
  profileHint: {
    marginTop: 2,
    fontSize: 13,
    fontFamily: Petify.font,
    color: Petify.inkFaint,
  },
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
  pickBackdrop: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)'},
  pickSheet: {
    position: 'absolute',
    left: 16,
    right: 16,
    top: '35%',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
  },
  pickTitle: {
    fontSize: 16,
    fontFamily: Petify.fontBold,
    color: Petify.ink,
    marginBottom: 12,
  },
  pickRow: {gap: 10},
  pickImage: {
    width: 96,
    height: 96,
    borderRadius: 10,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  pickImageOn: {borderColor: Petify.brand},
});
