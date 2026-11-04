/**
 * Official example for `@petify/react-native-camera-ui`.
 *
 * The UI follows the Petify app: the home screen, then — for a registration —
 * the pet's profile page, then the capture guide, then the branded capture
 * surface and the scan result. Identify and verify skip the profile page and go
 * straight to the guide.
 *
 * Pass the tenant API key at build time (see env.js):
 *   cp .env.example .env     # PETIFY_API_KEY=…
 * A shell variable still overrides it: PETIFY_API_KEY=… npm run android
 * Your own app should fetch the key from your server instead of bundling it.
 *
 * With a key the example runs the full server flow (register / identify /
 * verify) through DemoBackend, against the production backend your key was
 * issued on: a registration here is a real pet in your account (delete it from
 * "See all"). Without a key it still exercises the camera and stops at the
 * captured images.
 *
 * SDK 1.6.0: the models are prepared with PetnowPrewarm as soon as the user
 * starts a scan, while they read the profile page and the guide, and released
 * when they are back on the home screen. See the two effects marked ① and ④.
 */
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  Alert,
  AppState,
  BackHandler,
  Linking,
  PermissionsAndroid,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import {
  PetnowPrewarm,
  usePetnowCamera,
  type CameraResult,
  type DetectionPurpose,
  type Species,
} from '@petify/react-native-camera-ui';

import {CaptureScreen} from './captureScreen';
import {DemoBackend, petLabel, type DemoPet} from './demo/demoBackend';
import {PetPickerSheet} from './demo/petPicker';
import {PetProfileStore} from './demo/petProfiles';
import {
  ActionCard,
  AppBar,
  Card,
  CardHeader,
  CardMessage,
  Icon,
  ListRow,
  MaterialIcon,
  Petify,
  PetifyNotice,
  SpeciesPopup,
} from './ui/petifyUi';
import {ProfileFormScreen} from './ui/profileFormScreen';
import {ScanGuideScreen} from './ui/scanGuideScreen';
import type {ProfileDraft, SubmitResult} from './ui/scanCompleteScreen';

declare const process: {
  env: {
    PETIFY_API_KEY?: string;
  };
};

const API_KEY = process.env.PETIFY_API_KEY ?? '';

// The Petify Server API, where keys from the Petify Console are issued. The SDK
// talks to the same production backend by default, so capture sessions created
// here and the scans the camera reports land in the same account.
const API_BASE_URL = 'https://api.petify.petnow.io';

/** Pre-capture checklist, mirroring the playground's intro step. */
const TIPS = [
  {
    glyph: MaterialIcon.wbSunny,
    title: 'Shoot in a bright place.',
    body: "An environment where the pet's nose and face are clearly visible works best.",
  },
  {
    glyph: MaterialIcon.centerFocusStrong,
    title: 'Follow the guide.',
    body: "Fit the dog's nose or the cat's face inside the on-screen guide.",
  },
  {
    glyph: MaterialIcon.volumeUpOutlined,
    title: 'Use sounds to draw attention.',
    body: 'Sounds can help get your pet to look at the camera.',
  },
];

/** Minimal UUID v4, used as a placeholder session id when no key is configured. */
function uuidV4(): string {
  const bytes = Array.from({length: 16}, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = (from: number, to: number) =>
    bytes
      .slice(from, to)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  return `${hex(0, 4)}-${hex(4, 6)}-${hex(6, 8)}-${hex(8, 10)}-${hex(10, 16)}`;
}

export default function App(): React.JSX.Element {
  const camera = usePetnowCamera({apiKey: API_KEY});

  /**
   * Demo-only server client; null when no API key was supplied, in which case
   * the example captures but cannot register / identify / verify.
   */
  const backend = useMemo(
    () => (API_KEY ? new DemoBackend(API_KEY, API_BASE_URL) : null),
    [],
  );

  /** Profile photos for pets registered from this device. */
  const profiles = useRef(new PetProfileStore()).current;
  const [, forceRender] = useState(0);
  const refresh = useCallback(() => forceRender(n => n + 1), []);

  const [species, setSpecies] = useState<Species>('DOG');
  const [purpose, setPurpose] = useState<DetectionPurpose>('PET_PROFILE_REGISTRATION');
  /** The pet a verification runs against (1:1 needs a target). */
  const [verifyTarget, setVerifyTarget] = useState<DemoPet | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * Which action card was tapped, while the species popup is open. The app
   * asks for the animal before it opens the camera, because a capture session
   * is species-specific.
   */
  const [pendingPurpose, setPendingPurpose] = useState<DetectionPurpose | null>(null);
  /**
   * The screens between the home screen and the camera: the profile page (a
   * registration only) and the capture guide. Held in one place so `Back` walks
   * the flow rather than dropping the user home.
   */
  const [flow, setFlow] = useState<{
    purpose: DetectionPurpose;
    species: Species;
    target: DemoPet | null;
    stage: 'profile' | 'guide';
    /** Which guide step is showing; owned here so hardware back can walk it. */
    guideStep: number;
    draft: ProfileDraft | null;
  } | null>(null);
  /** The pets shown in the home screen's list card. */
  const [pets, setPets] = useState<DemoPet[] | null>(null);
  const [petsError, setPetsError] = useState(false);

  /** Set while a capture is running; holds everything that capture needs. */
  const [capture, setCapture] = useState<{
    sessionId: string;
    petId: string | null;
    purpose: DetectionPurpose;
    species: Species;
    /** The profile page's answers, saved once the registration succeeds. */
    draft: ProfileDraft | null;
  } | null>(null);

  useEffect(() => {
    profiles.load().then(refresh);
  }, [profiles, refresh]);

  /** The home screen lists the tenant's pets, as the Petify app does. */
  const loadPets = useCallback(() => {
    if (!backend) {
      return;
    }
    backend
      .listPets()
      .then(list => {
        setPets(list);
        setPetsError(false);
      })
      .catch(() => setPetsError(true));
  }, [backend]);

  useEffect(loadPets, [loadPets]);

  // The SDK holds the camera; hand it back when the app goes to the background.
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'active') {
        camera.resumeDetection();
      } else {
        camera.pauseDetection();
      }
    });
    return () => sub.remove();
  }, [camera]);

  const ready = camera.state.status === 'ready';

  // ① Prewarm as soon as the user starts a scan. The profile page and the guide
  //    take them a few seconds, which is the time the SDK needs to validate the
  //    licence and load the models; the camera then opens on a ready engine.
  //    Fire and forget: it resolves once the request is taken, not when the
  //    models are ready, and an invalid key still surfaces on the camera, not
  //    here. The species is known by now (the popup asked), so name it; when it
  //    is not, leave it out and both are prepared.
  const flowSpecies = flow?.species;
  useEffect(() => {
    if (ready && flowSpecies) {
      PetnowPrewarm.start(flowSpecies).catch(() => {});
    }
  }, [ready, flowSpecies]);

  // ④ Release once the user is back on the home screen — not when the guide
  //    goes away, which also happens on the way into the camera and would throw
  //    away the engine the camera is about to take. Optional: the SDK also
  //    releases under memory pressure.
  const atHome = !flow && !capture;
  const leftHome = useRef(false);
  useEffect(() => {
    if (!atHome) {
      leftHome.current = true;
    } else if (leftHome.current) {
      leftHome.current = false;
      PetnowPrewarm.release().catch(() => {});
    }
  }, [atHome]);

  // ------------------------------------------------------------------ session

  /**
   * Opens a capture session for `purpose`, scoped to `petId` where the server
   * requires it (registration and verification; identification has no pet yet).
   *
   * One session backs exactly one server job. Re-using it — the natural thing to
   * do on a retake — fails with `PETNOWB2B20014` (CaptureSessionAlreadyUsed), so
   * every capture attempt opens its own.
   */
  const newSession = useCallback(
    (forPurpose: DetectionPurpose, petId: string | null, forSpecies: Species) =>
      backend
        ? backend.createCaptureSession({species: forSpecies, purpose: forPurpose, petId})
        : Promise.resolve(uuidV4()),
    [backend],
  );

  const requestCamera = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.CAMERA,
    );
    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      return true;
    }
    Alert.alert(
      'Camera permission needed',
      'Enable it in Settings to run the capture.',
      [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Settings', onPress: () => Linking.openSettings()},
      ],
    );
    return false;
  };

  /** Advance the checklist; from the last card, start the capture. */
  /**
   * An action card was tapped: ask which animal, then start. Verification
   * skips the popup — the pet the user picked already names its species.
   */
  const askSpecies = (forPurpose: DetectionPurpose) => setPendingPurpose(forPurpose);

  const chooseSpecies = (chosen: Species) => {
    const forPurpose = pendingPurpose;
    setPendingPurpose(null);
    if (!forPurpose) {
      return;
    }
    setSpecies(chosen);
    // A registration collects the pet's profile first; the other two purposes
    // have nothing to fill in and go straight to the guide.
    setFlow({
      purpose: forPurpose,
      species: chosen,
      target: null,
      stage: forPurpose === 'PET_PROFILE_REGISTRATION' ? 'profile' : 'guide',
      guideStep: 0,
      draft: null,
    });
  };

  /** A pet in the list card was tapped: verify against it. */
  const verifyPet = (pet: DemoPet) => {
    setVerifyTarget(pet);
    const petSpecies = (pet.species as Species) ?? species;
    setSpecies(petSpecies);
    setFlow({
      purpose: 'PET_VERIFICATION',
      species: petSpecies,
      target: pet,
      stage: 'guide',
      guideStep: 0,
      draft: null,
    });
  };

  const startCapture = async (
    forPurpose: DetectionPurpose = purpose,
    forSpecies: Species = species,
    target: DemoPet | null = verifyTarget,
    draft: ProfileDraft | null = null,
  ) => {
    if (!(await requestCamera())) {
      return;
    }
    if (!ready) {
      Alert.alert('SDK not ready', `Camera state: ${camera.state.status}`);
      return;
    }
    if (backend && forPurpose === 'PET_VERIFICATION' && !target) {
      Alert.alert('Pick the pet to verify against first.');
      return;
    }
    setPurpose(forPurpose);

    // The session id must come from `POST /v2/capture-sessions` — the SDK
    // rejects anything that is not a valid UUID, and the server ties the
    // uploaded images to it. Without a key we fake one to exercise the camera.
    setBusy(true);
    try {
      const petId = backend
        ? forPurpose === 'PET_PROFILE_REGISTRATION'
          ? // Registration needs the pet to exist first; the session is scoped
            // to it (otherwise the server answers PETNOWB2B20011).
            await backend.createPet(forSpecies)
          : forPurpose === 'PET_VERIFICATION'
            ? target!.id
            : null
        : null;
      const sessionId = await newSession(forPurpose, petId, forSpecies);
      setCapture({sessionId, petId, purpose: forPurpose, species: forSpecies, draft});
      setFlow(null);
    } catch (e) {
      Alert.alert('Could not start the session', String(e));
    } finally {
      setBusy(false);
    }
  };

  // ------------------------------------------------------------------- submit

  /** Uploads the capture and runs the server step for `purpose`. */
  const submit = async (
    result: CameraResult,
    profile: ProfileDraft,
    sessionId: string,
    onStep: (step: string) => void,
    forPurpose: DetectionPurpose,
    petId: string | null,
  ): Promise<SubmitResult> => {
    if (!backend) {
      return {ok: true, title: 'Captured', lines: []};
    }
    try {
      onStep('Uploading images…');
      await backend.uploadCapture(sessionId, result);

      switch (forPurpose) {
        case 'PET_PROFILE_REGISTRATION': {
          onStep('Registering the pet…');
          const status = await backend.addFingerprints(petId!, sessionId);
          if (status === 'SUCCESS') {
            onStep('Saving the profile…');
            await saveProfile(petId!, profile);
          }
          return {
            ok: status === 'SUCCESS',
            title: status === 'SUCCESS' ? 'Pet registered' : `Registration ${status}`,
            lines: [`petId  ${petId}`, `session  ${sessionId}`],
          };
        }
        case 'PET_IDENTIFICATION': {
          onStep('Searching…');
          const found = await backend.identify(sessionId);
          if (found.length === 0) {
            return {
              ok: true,
              title: 'No match',
              lines: ['Nothing similar on file — treat as a new pet.'],
            };
          }
          return {
            ok: true,
            title: `${found.length} candidate(s)`,
            lines: found
              .slice(0, 5)
              .map(c => `${c.petId}   score ${c.score?.toFixed(3) ?? '—'}`),
            note:
              'A score is a hint, not a verdict. Confirm the top candidate with ' +
              'a 1:1 verify.',
          };
        }
        case 'PET_VERIFICATION': {
          onStep('Verifying…');
          const check = await backend.verify({petId: petId!, sessionId});
          return {
            ok: check.isMatch,
            title: check.isMatch ? 'Same pet' : 'Not the same pet',
            lines: [
              `petId  ${petId}`,
              `isMatch  ${check.isMatch}`,
              `score  ${check.score?.toFixed(3) ?? '—'}`,
            ],
            note: 'The server decision is the answer — not the score.',
          };
        }
      }
    } catch (e) {
      return {ok: false, title: 'Request failed', lines: [String(e)]};
    }
  };

  /**
   * Stores the pet's profile: the name on the server (the pet's `metadata`) and
   * the photo on the device, since the API keeps no pet image.
   */
  const saveProfile = async (petId: string, profile: ProfileDraft) => {
    const name = profile.name?.length ? profile.name : `Pet ${petId.split('-')[0]}`;
    try {
      // Everything the profile page collected: `metadata` is free-form, so an
      // app puts its own pet record here and keys it by the PetNow pet id.
      await backend!.updateMetadata(petId, {
        name,
        ...(profile.breed ? {breed: profile.breed} : {}),
        ...(profile.gender ? {gender: profile.gender} : {}),
        ...(profile.birthdate ? {birthdate: profile.birthdate} : {}),
        ...(profile.neutered ? {neutered: true} : {}),
      });
    } catch {
      // The local profile is still worth keeping if the PATCH fails.
    }
    await profiles.save({petId, name, sourceImagePath: profile.imagePath});
    refresh();
  };

  /**
   * Deletes the pet on the server — which takes its fingerprints with it, as the
   * API has no fingerprint-only delete — and forgets the local profile.
   */
  const deletePet = async (pet: DemoPet) => {
    await backend!.deletePet(pet.id);
    await profiles.remove(pet.id);
    if (verifyTarget?.id === pet.id) {
      setVerifyTarget(null);
    }
    refresh();
  };

  /**
   * One step back through the flow, for both the header arrow and Android's
   * back button. Returns false at the home screen, where back should leave the
   * app rather than do nothing.
   */
  const goBack = useCallback((): boolean => {
    if (capture) {
      setCapture(null);
      return true;
    }
    if (!flow) {
      return false;
    }
    if (flow.stage === 'guide') {
      if (flow.guideStep > 0) {
        setFlow({...flow, guideStep: flow.guideStep - 1});
      } else {
        // A registration steps back into its profile page, keeping what was
        // typed; the other purposes have nothing behind the guide.
        setFlow(
          flow.purpose === 'PET_PROFILE_REGISTRATION'
            ? {...flow, stage: 'profile'}
            : null,
        );
      }
      return true;
    }
    setFlow(null);
    return true;
  }, [capture, flow]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  // --------------------------------------------------------------------- view

  if (capture) {
    return (
      <CaptureScreen
        camera={camera}
        config={{
          species: capture.species,
          purpose: capture.purpose,
          captureSessionId: capture.sessionId,
        }}
        onSubmit={
          backend
            ? (result, profile, sessionId, onStep) =>
                submit(result, profile, sessionId, onStep, capture.purpose, capture.petId)
            : null
        }
        // Scanning again needs a new session — but the same pet, so a retake
        // does not leave an empty pet behind on the server.
        onNewSession={() => newSession(capture.purpose, capture.petId, capture.species)}
        profileDraft={capture.draft}
        onClose={() => setCapture(null)}
      />
    );
  }

  // The pet's profile, then the guide — the two screens the app shows before it
  // hands the camera over to the SDK.
  if (flow?.stage === 'profile') {
    return (
      <ProfileFormScreen
        species={flow.species}
        initial={flow.draft}
        onBack={goBack}
        onNext={draft => setFlow({...flow, draft, stage: 'guide', guideStep: 0})}
      />
    );
  }

  if (flow?.stage === 'guide') {
    return (
      <ScanGuideScreen
        species={flow.species}
        index={flow.guideStep}
        busy={busy}
        onBack={goBack}
        onNext={() => setFlow({...flow, guideStep: flow.guideStep + 1})}
        onStart={() =>
          startCapture(flow.purpose, flow.species, flow.target, flow.draft)
        }
      />
    );
  }

  const petRows = pets ?? [];
  const canList = Boolean(backend);
  const notice = !API_KEY
    ? {
        message: 'No API key. Put PETIFY_API_KEY in .env (see .env.example).',
        tone: Petify.error,
        icon: MaterialIcon.keyOff,
      }
    : camera.state.status === 'error'
      ? {
          message: camera.state.error,
          tone: Petify.error,
          icon: MaterialIcon.errorOutline,
        }
      : !ready
        ? {
            message: 'Validating the license with PetNow…',
            tone: Petify.main,
            icon: MaterialIcon.hourglassEmpty,
          }
        : null;

  return (
    <SafeAreaView style={styles.screen}>
      <AppBar />
      <View style={styles.body}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollBody}
          showsVerticalScrollIndicator={false}>
          {/* Scan: the two things the SDK does from a cold start. Which animal
              comes next, in the popup, because a session is species-specific. */}
          <Card>
            <CardHeader title="Biometric scan" glyph={MaterialIcon.pets} />
            <View style={styles.actionRow}>
              <ActionCard
                title={'Identify\na pet'}
                glyph={MaterialIcon.qrCodeScanner}
                onPress={() => askSpecies('PET_IDENTIFICATION')}
              />
              <ActionCard
                title={'Register\na pet'}
                glyph={MaterialIcon.photoCamera}
                onPress={() => askSpecies('PET_PROFILE_REGISTRATION')}
              />
            </View>
          </Card>

          {/* Pets: tapping one verifies this animal against that profile (1:1),
              which is the third thing the SDK does. */}
          <Card>
            <CardHeader
              title="Pets"
              glyph={MaterialIcon.pets}
              action={{
                label: 'See all',
                onPress: canList ? () => setPickerOpen(true) : null,
              }}
            />
            {!canList ? (
              <CardMessage text="Add an API key to list this tenant's pets." />
            ) : petsError ? (
              <CardMessage text="Could not load the pets." />
            ) : pets === null ? (
              <CardMessage text="Loading…" />
            ) : petRows.length === 0 ? (
              <CardMessage text="No pets yet. Register one to see it here." />
            ) : (
              petRows.slice(0, 3).map((pet, index, shown) => (
                <ListRow
                  key={pet.id}
                  title={profiles.get(pet.id)?.name ?? petLabel(pet)}
                  subtitle="Tap to verify this pet"
                  imagePath={profiles.get(pet.id)?.imagePath}
                  onPress={() => verifyPet(pet)}
                  last={index === shown.length - 1}
                />
              ))
            )}
          </Card>

          {/* Before you scan: the playground's checklist, one card. */}
          <Card>
            <CardHeader title="Before you scan" glyph={MaterialIcon.infoOutline} />
            <View style={styles.tips}>
              {TIPS.map(tip => (
                <View key={tip.title} style={styles.tip}>
                  <Icon glyph={tip.glyph} size={28} color={Petify.main} />
                  <View style={{flex: 1}}>
                    <Text style={styles.tipTitle}>{tip.title}</Text>
                    <Text style={styles.tipBody}>{tip.body}</Text>
                  </View>
                </View>
              ))}
            </View>
          </Card>

          {notice ? (
            <Card>
              <View style={styles.noticeCard}>
                <PetifyNotice
                  message={notice.message}
                  tone={notice.tone}
                  icon={notice.icon}
                />
              </View>
            </Card>
          ) : null}

          {busy ? <Text style={styles.busy}>Starting the session…</Text> : null}
        </ScrollView>
      </View>

      <SpeciesPopup
        visible={pendingPurpose !== null}
        title={
          pendingPurpose === 'PET_IDENTIFICATION'
            ? 'Which animal are you identifying?'
            : 'Which animal are you registering?'
        }
        onSelect={chooseSpecies}
        onClose={() => setPendingPurpose(null)}
      />

      {backend ? (
        <PetPickerSheet
          visible={pickerOpen}
          loadPets={() => backend.listPets()}
          profiles={profiles}
          onDelete={deletePet}
          onPick={pet => {
            setPickerOpen(false);
            verifyPet(pet);
          }}
          onClose={() => setPickerOpen(false)}
        />
      ) : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: Petify.appBg},
  body: {flex: 1, width: '100%', maxWidth: 520, alignSelf: 'center'},
  scroll: {flex: 1},
  scrollBody: {padding: 16, gap: 16},
  actionRow: {flexDirection: 'row', gap: 16, paddingHorizontal: 16, paddingBottom: 20},
  tips: {paddingHorizontal: 16, paddingBottom: 20, gap: 16},
  tip: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  tipTitle: {color: Petify.ink, fontSize: 15, fontFamily: Petify.fontMedium},
  tipBody: {
    marginTop: 2,
    color: Petify.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Petify.font,
  },
  noticeCard: {padding: 16},
  busy: {
    textAlign: 'center',
    color: Petify.inkMuted,
    fontSize: 13,
    fontFamily: Petify.fontMedium,
  },
});
