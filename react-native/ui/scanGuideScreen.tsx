/**
 * Capture guide — the last screen before the camera opens.
 *
 * Framing is what decides whether a scan succeeds, so the app teaches it once
 * up front instead of relying on the in-camera hints alone. Dogs get two steps
 * (angle, then light); a cat's guide is a single screen, because the cat flow
 * scans the face rather than the nose.
 *
 * The same guide is also reachable from inside the camera, as the help sheet in
 * `cameraChrome.tsx`.
 */
import React from 'react';
import {
  Image,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import type {Species} from '@petify/react-native-camera-ui';

import {Petify, PetifyPrimaryButton} from './petifyUi';
import {PageTitle, ScreenBar} from './petifyForm';

interface GuideStep {
  eyebrow?: string;
  title: string;
  description: string;
  image: number;
  cta: string;
}

const DOG_STEPS: GuideStep[] = [
  {
    eyebrow: 'Step 1.',
    title: "Position the camera directly in front of your dog's face!",
    description: 'Scanning from above, below, or the side may not be recognized.',
    image: require('../assets/images/scan-guide-step1.jpg'),
    cta: 'Next',
  },
  {
    eyebrow: 'Step 2.',
    title: 'Scan in a well-lit area!',
    description:
      'In a bright place, slowly move your phone back and forth to focus while scanning.',
    image: require('../assets/images/scan-guide-step2.jpg'),
    cta: 'Start scan',
  },
];

const CAT_STEPS: GuideStep[] = [
  {
    title: 'Scan in a bright place!',
    description:
      "Hold your cat's face in bright light with eyes uncovered. Move your phone " +
      'slowly back and forth to scan!',
    image: require('../assets/images/scan-guide-cat.jpg'),
    cta: 'Start scan',
  },
];

export function ScanGuideScreen({
  species,
  index,
  busy = false,
  onBack,
  onNext,
  onStart,
}: {
  species: Species;
  /**
   * Which step to show. Owned by the caller so that the hardware back button
   * walks the guide the same way the header's arrow does.
   */
  index: number;
  /** Set while the capture session is being opened. */
  busy?: boolean;
  onBack: () => void;
  onNext: () => void;
  onStart: () => void;
}) {
  const isCat = species === 'CAT';
  const steps = isCat ? CAT_STEPS : DOG_STEPS;
  // The stills are square; sizing the box in real pixels keeps them uncropped
  // rather than leaving the height to a percentage the ScrollView cannot solve.
  const {width} = useWindowDimensions();
  const step = steps[Math.min(index, steps.length - 1)];
  const last = index >= steps.length - 1;

  return (
    <SafeAreaView style={styles.screen}>
      <ScreenBar
        title={isCat ? 'Face scan guide' : 'Noseprint scan guide'}
        onBack={onBack}
      />
      <ScrollView style={styles.flex} contentContainerStyle={styles.body}>
        <PageTitle
          eyebrow={step.eyebrow}
          title={step.title}
          description={step.description}
        />
        <Image
          source={step.image}
          style={[styles.media, {width, height: width}]}
          resizeMode="cover"
        />
      </ScrollView>
      <View style={styles.footer}>
        <PetifyPrimaryButton
          label={step.cta}
          busy={busy}
          onPress={busy ? null : last ? onStart : onNext}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: Petify.surface},
  flex: {flex: 1},
  body: {paddingBottom: 16},
  media: {alignSelf: 'center'},
  footer: {padding: 16},
});
