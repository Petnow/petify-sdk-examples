/**
 * Pet profile page — the step between "Register a pet" and the camera.
 *
 * The B2B API stores only `species` on a pet (`POST /v2/pets`); everything the
 * user types here rides along in the pet's free-form `metadata`
 * (`PATCH /v2/pets/{petId}`), which is what `DemoBackend.updateMetadata` writes.
 * Collecting it before the scan matches the Petify app and keeps the capture
 * itself free of form UI.
 *
 * The profile *photo* is not asked for here: the example has no gallery picker,
 * and the SDK already hands back face frames, so the photo is chosen from the
 * capture on the scan-complete screen.
 */
import React, {useRef, useState} from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type {Species} from '@petify/react-native-camera-ui';

import {Petify, PetifyPrimaryButton} from './petifyUi';
import {
  CheckRow,
  ChoiceRow,
  DateSheet,
  OptionSheet,
  ScreenBar,
  SelectField,
  TextField,
  formatAge,
} from './petifyForm';
import type {ProfileDraft} from './scanCompleteScreen';

const MAX_NAME = 25;
/** Emoji are dropped rather than rejected, as the app does. */
const EMOJI = /\p{Extended_Pictographic}/gu;

/** A short list is enough for a sample; a real app pulls breeds from its own API. */
const DOG_BREEDS = [
  'Bichon Frise',
  'Border Collie',
  'Chihuahua',
  'Dachshund',
  'French Bulldog',
  'Golden Retriever',
  'Jindo',
  'Labrador Retriever',
  'Maltese',
  'Pomeranian',
  'Poodle',
  'Pug',
  'Schnauzer',
  'Shiba Inu',
  'Shih Tzu',
  'Welsh Corgi',
  'Yorkshire Terrier',
  'Mixed breed',
  'Other',
];

const CAT_BREEDS = [
  'Abyssinian',
  'American Shorthair',
  'Bengal',
  'British Shorthair',
  'Korean Shorthair',
  'Maine Coon',
  'Munchkin',
  'Norwegian Forest',
  'Persian',
  'Ragdoll',
  'Russian Blue',
  'Scottish Fold',
  'Siamese',
  'Sphynx',
  'Mixed breed',
  'Other',
];

type FieldKey = 'name' | 'breed' | 'gender' | 'birthdate';

export function ProfileFormScreen({
  species,
  initial,
  onBack,
  onNext,
}: {
  species: Species;
  /** What was typed before, when the guide steps back into this page. */
  initial?: ProfileDraft | null;
  onBack: () => void;
  /** The draft is carried to the capture and saved once registration succeeds. */
  onNext: (draft: ProfileDraft) => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [breed, setBreed] = useState<string | null>(initial?.breed ?? null);
  const [gender, setGender] = useState<'MALE' | 'FEMALE' | null>(
    initial?.gender ?? null,
  );
  const [neutered, setNeutered] = useState(initial?.neutered ?? false);
  const [birthdate, setBirthdate] = useState<string | null>(initial?.birthdate ?? null);

  const [breedOpen, setBreedOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({});

  const scroll = useRef<ScrollView>(null);
  const offsets = useRef<Partial<Record<FieldKey, number>>>({});

  const isCat = species === 'CAT';

  /** Clearing as soon as the field is fixed, rather than on the next submit. */
  const clear = (field: FieldKey) =>
    setErrors(prev => {
      if (!prev[field]) {
        return prev;
      }
      const next = {...prev};
      delete next[field];
      return next;
    });

  const next = () => {
    const trimmed = name.trim();
    const found: Partial<Record<FieldKey, string>> = {};
    if (!trimmed) {
      found.name = 'Enter a name.';
    }
    if (!breed) {
      found.breed = 'Choose a breed.';
    }
    if (!gender) {
      found.gender = 'Choose a gender.';
    }
    if (!birthdate) {
      found.birthdate = 'Choose a date of birth.';
    }
    setErrors(found);

    const first = (['name', 'breed', 'gender', 'birthdate'] as FieldKey[]).find(
      field => found[field],
    );
    if (first) {
      const y = offsets.current[first];
      if (y !== undefined) {
        scroll.current?.scrollTo({y: Math.max(y - 16, 0), animated: true});
      }
      return;
    }

    onNext({name: trimmed, breed, gender, neutered, birthdate});
  };

  const measure = (field: FieldKey) => (event: {nativeEvent: {layout: {y: number}}}) => {
    offsets.current[field] = event.nativeEvent.layout.y;
  };

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenBar title={isCat ? 'Cat profile' : 'Dog profile'} onBack={onBack} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          ref={scroll}
          style={styles.flex}
          contentContainerStyle={styles.form}
          keyboardShouldPersistTaps="handled">
          <Text style={styles.intro}>
            This is your app's data, not the SDK's. The API keeps only the species on
            a pet — the rest is saved as the pet's metadata after the scan.
          </Text>

          <View onLayout={measure('name')}>
            <TextField
              label="Name"
              required
              placeholder="e.g. Coco"
              value={name}
              maxLength={MAX_NAME}
              error={errors.name}
              onChangeText={text => {
                setName(text.replace(EMOJI, ''));
                clear('name');
              }}
            />
          </View>

          <View onLayout={measure('breed')}>
            <SelectField
              label="Breed"
              required
              placeholder="Choose a breed"
              value={breed}
              error={errors.breed}
              onPress={() => setBreedOpen(true)}
            />
          </View>

          <View onLayout={measure('gender')}>
            <ChoiceRow
              label="Gender"
              required
              value={gender}
              error={errors.gender}
              options={[
                {value: 'MALE', label: 'Male'},
                {value: 'FEMALE', label: 'Female'},
              ]}
              onChange={value => {
                setGender(value);
                clear('gender');
              }}
            />
          </View>

          <CheckRow
            checked={neutered}
            label="Neutered"
            onPress={() => setNeutered(!neutered)}
          />

          <View onLayout={measure('birthdate')}>
            <SelectField
              label="Date of birth"
              required
              placeholder="Choose a date"
              value={birthdate}
              error={errors.birthdate}
              onPress={() => setDateOpen(true)}
            />
            {birthdate ? (
              <View style={styles.agePill}>
                <Text style={styles.ageText}>{formatAge(birthdate)}</Text>
              </View>
            ) : null}
          </View>

          <Text style={styles.photoNote}>
            The profile photo is picked from the scan, once the camera has the face
            frames.
          </Text>
        </ScrollView>

        <View style={styles.footer}>
          <PetifyPrimaryButton label="Next" onPress={next} />
        </View>
      </KeyboardAvoidingView>

      <OptionSheet
        visible={breedOpen}
        title="Breed"
        options={isCat ? CAT_BREEDS : DOG_BREEDS}
        value={breed}
        onSelect={option => {
          setBreed(option);
          setBreedOpen(false);
          clear('breed');
        }}
        onClose={() => setBreedOpen(false)}
      />

      <DateSheet
        visible={dateOpen}
        value={birthdate}
        onConfirm={date => {
          setBirthdate(date);
          setDateOpen(false);
          clear('birthdate');
        }}
        onClose={() => setDateOpen(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: Petify.appBg},
  flex: {flex: 1},
  form: {padding: 16, gap: 20},
  intro: {
    fontSize: 13,
    lineHeight: 19,
    fontFamily: Petify.font,
    color: Petify.inkMuted,
  },
  agePill: {
    marginTop: 12,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: Petify.surfaceTint,
  },
  ageText: {fontSize: 14, fontFamily: Petify.fontMedium, color: Petify.brand},
  photoNote: {
    fontSize: 12,
    lineHeight: 18,
    fontFamily: Petify.font,
    color: Petify.inkFaint,
  },
  footer: {padding: 16, backgroundColor: Petify.appBg},
});
