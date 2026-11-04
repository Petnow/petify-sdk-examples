/**
 * Official example for `@petify/react-native-camera-ui`.
 *
 * Home screen → species → capture guide → camera → scan result, for each of
 * the three things the SDK does: register, identify and verify a pet.
 *
 * Pass a **Secret** API key from the Petify Console at build time (see env.js):
 *   cp .env.example .env     # PETIFY_API_KEY=…
 * A shell variable still overrides it: PETIFY_API_KEY=… npm run android
 *
 * The example runs the whole server flow through DemoBackend, against the
 * production backend the key was issued on: a registration here is a real pet
 * in your account (delete it from "See all"). That is why it needs a Secret
 * key, and why your own app must not do this — the app should hold a Client
 * key and leave the Server API to your server (see petnowBackend.ts).
 *
 * SDK 1.6.0: the models are prepared with PetnowPrewarm as soon as the user
 * picks what to scan, while they read the guide, and released when they are
 * back on the home screen. See the effects marked ① and ④; ② ③ ⑤ are in
 * captureScreen.tsx.
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

/** Pre-capture checklist. */
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
];

export default function App(): React.JSX.Element {
  const camera = usePetnowCamera({apiKey: API_KEY});

  /** Demo-only server client; null until an API key is supplied. */
  const backend = useMemo(
    () => (API_KEY ? new DemoBackend(API_KEY, API_BASE_URL) : null),
    [],
  );

  const [pickerOpen, setPickerOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  /**
   * Which action card was tapped, while the species popup is open. The app
   * asks for the animal before it opens the camera, because a capture session
   * is species-specific.
   */
  const [pendingPurpose, setPendingPurpose] = useState<DetectionPurpose | null>(null);
  /**
   * The capture guide between the home screen and the camera. Held here so
   * `Back` walks the guide's steps rather than dropping the user home.
   */
  const [flow, setFlow] = useState<{
    purpose: DetectionPurpose;
    species: Species;
    /** The pet a verification runs against (1:1 needs a target). */
    target: DemoPet | null;
    /** Which guide step is showing; owned here so hardware back can walk it. */
    guideStep: number;
  } | null>(null);
  /** The pets shown in the home screen's list card. */
  const [pets, setPets] = useState<DemoPet[] | null>(null);
  const [petsError, setPetsError] = useState<string | null>(null);

  /** Set while a capture is running; holds everything that capture needs. */
  const [capture, setCapture] = useState<{
    sessionId: string;
    petId: string | null;
    purpose: DetectionPurpose;
    species: Species;
  } | null>(null);

  /**
   * A capture start in flight. Set before the first `await`, so a double tap
   * cannot create two pets; bumped by Back, so a start the user walked away
   * from does not open the camera on its own when the server answers.
   */
  const starting = useRef(false);
  const attempt = useRef(0);
  /** Registrations that reached the server; any other example pet is discarded. */
  const registered = useRef(new Set<string>());
  /** Set while a capture is being uploaded and run, so Back cannot drop the result. */
  const submitting = useRef(false);

  /** The account's pets, for "See all". Stable, so the sheet does not refetch on every render. */
  const listPets = useCallback(
    () => (backend ? backend.listPets() : Promise.resolve([] as DemoPet[])),
    [backend],
  );

  /** The home screen lists the account's registered pets, newest first. */
  const loadPets = useCallback(() => {
    if (!backend) {
      return;
    }
    listPets()
      .then(list => {
        setPets(list.filter(pet => pet.hasFingerprint));
        setPetsError(null);
      })
      .catch(e => setPetsError(String(e instanceof Error ? e.message : e)));
  }, [backend, listPets]);

  useEffect(loadPets, [loadPets]);

  // Stop analysing frames while the app is in the background, and pick up
  // again on return. Only `background`: iOS also reports `inactive` for the
  // permission prompt and Control Center, where the camera should keep going.
  const paused = useRef(false);
  useEffect(() => {
    const sub = AppState.addEventListener('change', next => {
      if (next === 'background' && !paused.current) {
        paused.current = true;
        camera.pauseDetection();
      } else if (next === 'active' && paused.current) {
        paused.current = false;
        camera.resumeDetection();
      }
    });
    return () => sub.remove();
  }, [camera]);

  const ready = camera.state.status === 'ready';

  // ① Prewarm as soon as the user picks what to scan — one screen earlier than
  //    the guide's own mount, because the species popup is where this flow
  //    starts. The guide takes the user a few seconds, which is the time the SDK
  //    needs to validate the licence and load the models; the camera then opens
  //    on a ready engine. Fire and forget: it resolves once the request is
  //    taken, not when the models are ready, and an invalid key still surfaces
  //    on the camera, not here. It needs the key `usePetnowCamera` stores, hence
  //    `ready`. The species is known by now (the popup asked), so name it; when
  //    your flow does not know it, leave it out.
  const flowSpecies = flow?.species;
  useEffect(() => {
    if (ready && flowSpecies) {
      PetnowPrewarm.start(flowSpecies).catch(() => {});
    }
  }, [ready, flowSpecies]);

  // ④ Release once the user is back on the home screen — not when the guide
  //    goes away, which also happens on the way into the camera and would throw
  //    away the engine the camera is about to take. Optional: the SDK also
  //    releases under memory pressure. (A camera closing in the same moment may
  //    hand its engine back just after this; the SDK then keeps it for the next
  //    camera until memory runs low, which is harmless.)
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
  const newSession = (
    server: DemoBackend,
    forPurpose: DetectionPurpose,
    petId: string | null,
    forSpecies: Species,
  ) => server.createCaptureSession({species: forSpecies, purpose: forPurpose, petId});

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
    if (granted === PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN) {
      // Android no longer asks; only the app's settings page can grant it.
      Alert.alert('Camera permission needed', 'Allow camera access in Settings to scan.', [
        {text: 'Cancel', style: 'cancel'},
        {text: 'Settings', onPress: () => Linking.openSettings()},
      ]);
    } else {
      Alert.alert('Camera permission needed', 'The scan needs the camera.');
    }
    return false;
  };

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
    setFlow({purpose: forPurpose, species: chosen, target: null, guideStep: 0});
  };

  /** A pet in the list card was tapped: verify against it. */
  const verifyPet = (pet: DemoPet) => {
    setFlow({
      purpose: 'PET_VERIFICATION',
      species: (pet.species as Species) ?? 'DOG',
      target: pet,
      guideStep: 0,
    });
  };

  /**
   * Deletes a pet this example created whose registration never completed —
   * the user backed out, the scan stopped, or the session could not be opened.
   * The capture session has to be scoped to a pet before the camera opens, so
   * without this every abandoned registration leaves an empty pet behind.
   */
  const discardPet = useCallback(
    (petId: string) => {
      backend?.deletePet(petId).catch(() => {}).finally(loadPets);
    },
    [backend, loadPets],
  );

  const startCapture = async (
    forPurpose: DetectionPurpose,
    forSpecies: Species,
    target: DemoPet | null,
  ) => {
    if (starting.current) {
      return;
    }
    starting.current = true;
    const token = ++attempt.current;
    setBusy(true);
    let createdPet: string | null = null;
    try {
      if (!(await requestCamera())) {
        return;
      }
      if (!backend || !ready) {
        Alert.alert('SDK not ready', `Camera state: ${camera.state.status}`);
        return;
      }
      // The session id must come from `POST /v2/capture-sessions` — the SDK
      // rejects anything that is not a valid UUID, and the server ties the
      // uploaded images to it.
      if (forPurpose === 'PET_PROFILE_REGISTRATION') {
        // Registration needs the pet to exist first; the session is scoped to
        // it (otherwise the server answers PETNOWB2B20011).
        createdPet = await backend.createPet(forSpecies);
      }
      const petId =
        createdPet ?? (forPurpose === 'PET_VERIFICATION' ? target!.id : null);
      const sessionId = await newSession(backend, forPurpose, petId, forSpecies);
      if (token !== attempt.current) {
        return; // the user left the guide meanwhile; `finally` cleans up
      }
      setCapture({sessionId, petId, purpose: forPurpose, species: forSpecies});
      setFlow(null);
      createdPet = null; // the camera owns it now
    } catch (e) {
      if (token === attempt.current) {
        Alert.alert('Could not start the session', String(e instanceof Error ? e.message : e));
      }
    } finally {
      if (createdPet) {
        discardPet(createdPet);
      }
      starting.current = false;
      setBusy(false);
    }
  };

  /** Leaves the camera, discarding a registration that never reached the server. */
  const closeCapture = useCallback(() => {
    const petId = capture?.petId;
    if (
      capture?.purpose === 'PET_PROFILE_REGISTRATION' &&
      petId &&
      !registered.current.has(petId)
    ) {
      discardPet(petId);
    } else {
      loadPets();
    }
    setCapture(null);
  }, [capture, discardPet, loadPets]);

  // ------------------------------------------------------------------- submit

  /** Uploads the capture and runs the server step for `purpose`. */
  const submit = async (
    server: DemoBackend,
    result: CameraResult,
    profile: ProfileDraft,
    sessionId: string,
    onStep: (step: string) => void,
    forPurpose: DetectionPurpose,
    petId: string | null,
  ): Promise<SubmitResult> => {
    submitting.current = true;
    try {
      onStep('Uploading images…');
      await server.uploadCapture(sessionId, result);

      switch (forPurpose) {
        case 'PET_PROFILE_REGISTRATION': {
          onStep('Registering the pet…');
          const status = await server.addFingerprints(petId!, sessionId);
          if (status === 'SUCCESS') {
            registered.current.add(petId!);
          }
          if (status === 'SUCCESS' && profile.name) {
            onStep('Saving the name…');
            await saveName(server, petId!, profile.name);
          }
          return {
            ok: status === 'SUCCESS',
            title: status === 'SUCCESS' ? 'Pet registered' : `Registration ${status}`,
            lines: [`petId  ${petId}`, `session  ${sessionId}`],
          };
        }
        case 'PET_IDENTIFICATION': {
          onStep('Searching…');
          const found = await server.identify(sessionId);
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
              .map(c => `${c.petId}   score ${c.score ?? '—'}`),
            note:
              'A score is a hint, not a verdict. Confirm the top candidate with ' +
              'a 1:1 verify.',
          };
        }
        case 'PET_VERIFICATION': {
          onStep('Verifying…');
          const check = await server.verify({petId: petId!, sessionId});
          return {
            ok: check.isMatch,
            title: check.isMatch ? 'Same pet' : 'Not the same pet',
            lines: [
              `petId  ${petId}`,
              `isMatch  ${check.isMatch}`,
              `score  ${check.score ?? '—'}`,
            ],
            note: 'The server decision is the answer — not the score.',
          };
        }
      }
    } catch (e) {
      return {
        ok: false,
        title: 'Request failed',
        lines: [String(e instanceof Error ? e.message : e)],
      };
    } finally {
      submitting.current = false;
    }
  };

  /**
   * Stores the pet's name in its free-form `metadata`, which is where an app
   * keeps its own pet record, keyed by the Petify pet id.
   */
  const saveName = async (server: DemoBackend, petId: string, name: string) => {
    try {
      await server.setName(petId, name);
    } catch {
      // The registration itself succeeded; a missing name is only cosmetic.
    }
  };

  /**
   * Deletes the pet on the server, which takes its fingerprints with it: the
   * API has no fingerprint-only delete.
   */
  const deletePet = async (pet: DemoPet) => {
    await backend!.deletePet(pet.id);
    loadPets();
  };

  /**
   * One step back through the flow, for both the header arrow and Android's
   * back button. Returns false at the home screen, where back should leave the
   * app rather than do nothing.
   */
  const goBack = useCallback((): boolean => {
    if (capture) {
      if (!submitting.current) {
        closeCapture();
      }
      return true;
    }
    if (!flow) {
      return false;
    }
    // Any Back abandons a start still waiting on the server.
    attempt.current += 1;
    setFlow(flow.guideStep > 0 ? {...flow, guideStep: flow.guideStep - 1} : null);
    return true;
  }, [capture, flow, closeCapture]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', goBack);
    return () => sub.remove();
  }, [goBack]);

  // --------------------------------------------------------------------- view

  if (capture && backend) {
    return (
      <CaptureScreen
        camera={camera}
        config={{
          species: capture.species,
          purpose: capture.purpose,
          captureSessionId: capture.sessionId,
        }}
        onSubmit={(result, profile, sessionId, onStep) =>
          submit(backend, result, profile, sessionId, onStep, capture.purpose, capture.petId)
        }
        // Scanning again needs a new session — but the same pet, so a retake
        // does not leave an empty pet behind on the server.
        onNewSession={() =>
          newSession(backend, capture.purpose, capture.petId, capture.species)
        }
        onClose={closeCapture}
      />
    );
  }

  // The guide is the screen the app shows before it hands the camera to the SDK.
  if (flow) {
    return (
      <ScanGuideScreen
        species={flow.species}
        index={flow.guideStep}
        busy={busy}
        onBack={goBack}
        onNext={() => setFlow({...flow, guideStep: flow.guideStep + 1})}
        onStart={() => startCapture(flow.purpose, flow.species, flow.target)}
      />
    );
  }

  const petRows = pets ?? [];
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
            message: 'Starting the SDK…',
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
                onPress={ready ? () => askSpecies('PET_IDENTIFICATION') : null}
              />
              <ActionCard
                title={'Register\na pet'}
                glyph={MaterialIcon.photoCamera}
                onPress={ready ? () => askSpecies('PET_PROFILE_REGISTRATION') : null}
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
                onPress: backend ? () => setPickerOpen(true) : null,
              }}
            />
            {!backend ? (
              <CardMessage text="Add an API key to list your pets." />
            ) : petsError ? (
              <CardMessage text={`Could not load the pets: ${petsError}`} />
            ) : pets === null ? (
              <CardMessage text="Loading…" />
            ) : petRows.length === 0 ? (
              <CardMessage text="No pets yet. Register one to see it here." />
            ) : (
              petRows.slice(0, 3).map((pet, index, shown) => (
                <ListRow
                  key={pet.id}
                  title={petLabel(pet)}
                  subtitle="Tap to verify this pet"
                  onPress={() => verifyPet(pet)}
                  last={index === shown.length - 1}
                />
              ))
            )}
          </Card>

          {/* Before you scan: the capture checklist, one card. */}
          <Card>
            <CardHeader title="Before you scan" glyph={MaterialIcon.infoOutline} />
            <View style={styles.tips}>
              {TIPS.map(tip => (
                <View key={tip.title} style={styles.tip}>
                  <Icon glyph={tip.glyph} size={28} color={Petify.main} />
                  <View style={styles.tipCopy}>
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
          loadPets={listPets}
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
  tipCopy: {flex: 1},
  tipTitle: {color: Petify.ink, fontSize: 15, fontFamily: Petify.fontMedium},
  tipBody: {
    marginTop: 2,
    color: Petify.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Petify.font,
  },
  noticeCard: {padding: 16},
});
