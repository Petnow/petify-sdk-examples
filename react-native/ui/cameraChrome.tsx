import React from 'react';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';

import {Icon, MaterialIcon, Petify, withAlpha} from './petifyUi';

/**
 * Camera-screen chrome: the circular mask, the guide callout, the top bar, the
 * bottom control bar and the tips sheet. None of it is part of the SDK — it is
 * this app's design, and yours will differ.
 *
 * The camera preview and the detection tracker are drawn by the native SDK
 * inside `<CameraView>`; everything here sits on top of it.
 */

/** Tone of the floating detection banner. */
export type BannerTone = 'start' | 'success' | 'error';

/**
 * Dark scrim with a circular cut-out and a brand ring, plus the guide callout
 * under the circle.
 *
 * The cut-out is a border trick rather than a painted path: a circle whose
 * border is thicker than the screen fills everything outside it, which is the
 * one way to punch a hole without pulling in a drawing library.
 */
export function CameraMaskOverlay({
  visible,
  guideMessage,
}: {
  visible: boolean;
  guideMessage?: string | null;
}) {
  const {width, height} = useWindowDimensions();
  const diameter = Math.min(width, Petify.maxUiWidth) - Petify.maskMargin * 2;
  const radius = diameter / 2;
  const centerY = height / 2 + Petify.maskVerticalOffset;
  const scrim = Math.max(width, height);

  if (!visible) {
    return null;
  }
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <View
        style={{
          position: 'absolute',
          left: width / 2 - radius - scrim,
          top: centerY - radius - scrim,
          width: (radius + scrim) * 2,
          height: (radius + scrim) * 2,
          borderRadius: radius + scrim,
          borderWidth: scrim,
          borderColor: Petify.dimOverlay,
        }}
      />
      <View
        style={{
          position: 'absolute',
          left: width / 2 - radius,
          top: centerY - radius,
          width: diameter,
          height: diameter,
          borderRadius: radius,
          borderWidth: Petify.maskStrokeWidth,
          borderColor: Petify.brand,
        }}
      />
      {guideMessage ? (
        <View
          style={{
            position: 'absolute',
            top: centerY + radius + 16,
            left: 0,
            right: 0,
            alignItems: 'center',
          }}>
          <CameraCallout message={guideMessage} />
        </View>
      ) : null}
    </View>
  );
}

/** Brand-tinted guide bubble under the mask circle. */
export function CameraCallout({message}: {message: string}) {
  return (
    <View style={styles.callout}>
      <Text style={styles.calloutText}>{message}</Text>
    </View>
  );
}

/** Close (left) and tips (right). */
export function CameraTopBar({
  onClose,
  onTips,
}: {
  onClose: () => void;
  onTips: () => void;
}) {
  return (
    <SafeAreaView style={styles.topBarSafe}>
      <View style={styles.topBar}>
        <RoundButton label="Close" glyph={MaterialIcon.close} onPress={onClose} />
        <RoundButton
          label="Capture tips"
          glyph={MaterialIcon.helpOutline}
          onPress={onTips}
        />
      </View>
    </SafeAreaView>
  );
}

/** Bottom bar: status label (+ capture progress) and the camera switch. */
export function CameraControls({
  statusLabel,
  progress,
  onSwitchCamera,
}: {
  statusLabel: string;
  progress: number;
  onSwitchCamera: () => void;
}) {
  return (
    <SafeAreaView style={styles.controlsSafe}>
      <View style={styles.controls}>
        {/* Balances the switch button so the label stays centred. */}
        <View style={styles.roundButtonSpacer} />
        <View style={styles.controlsCenter}>
          <Text numberOfLines={2} style={styles.statusLabel}>
            {statusLabel}
          </Text>
          {progress > 0 ? (
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {width: `${progress}%`}]} />
            </View>
          ) : null}
        </View>
        <RoundButton
          label="Switch camera"
          glyph={MaterialIcon.cameraswitch}
          onPress={onSwitchCamera}
        />
      </View>
    </SafeAreaView>
  );
}

function RoundButton({
  glyph,
  label,
  onPress,
}: {
  glyph: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={styles.roundButton}>
      <Icon glyph={glyph} size={28} color="#FFFFFF" />
    </Pressable>
  );
}

/**
 * White capture-feedback banner. It sits above the controls; the tracking
 * marker on the pet is drawn by the SDK itself.
 */
export function DetectionBanner({
  message,
  tone,
}: {
  message: string;
  tone: BannerTone;
}) {
  const accent =
    tone === 'error'
      ? Petify.error
      : tone === 'success'
        ? Petify.success
        : Petify.brand;
  return (
    <View style={styles.banner}>
      <View style={[styles.bannerDot, {backgroundColor: accent}]} />
      <Text style={styles.bannerText}>{message}</Text>
    </View>
  );
}

/** Tips sheet behind the `?` button. */
export function ScanGuideSheet({
  visible,
  isCat,
  onClose,
}: {
  visible: boolean;
  isCat: boolean;
  onClose: () => void;
}) {
  const subject = isCat ? "the cat's face" : "the dog's nose";
  const cards: {glyph: string; title: string; body: string}[] = [
    {
      glyph: MaterialIcon.wbSunny,
      title: 'Bright, even light',
      body: 'Avoid backlight and hard shadows — they hide the print texture.',
    },
    {
      glyph: MaterialIcon.centerFocusStrong,
      title: 'Fill the circle',
      body: `Hold ${subject} inside the guide, about a palm's width away.`,
    },
    {
      glyph: MaterialIcon.centerFocusStrong,
      title: 'Hold still',
      body: 'Motion blur is the most common reason a frame is rejected.',
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.sheetBackdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.sheetHandle} />
        <Text style={styles.sheetTitle}>Capture tips</Text>
        <ScrollView contentContainerStyle={styles.sheetBody}>
          {cards.map(card => (
            <View key={card.title} style={styles.guideCard}>
              <Icon glyph={card.glyph} size={22} color={Petify.brand} />
              <View style={styles.guideCopy}>
                <Text style={styles.guideTitle}>{card.title}</Text>
                <Text style={styles.guideBody}>{card.body}</Text>
              </View>
            </View>
          ))}
        </ScrollView>
        <Pressable accessibilityRole="button" onPress={onClose} style={styles.sheetClose}>
          <Text style={styles.sheetCloseLabel}>Got it</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  callout: {
    maxWidth: 360,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: Petify.calloutBg,
  },
  calloutText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontFamily: Petify.fontBold,
    textAlign: 'center',
  },
  topBarSafe: {},
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  controlsSafe: {},
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: Petify.maxUiWidth,
    marginHorizontal: 24,
    marginBottom: 10,
    padding: 16,
    borderRadius: 12,
    backgroundColor: Petify.controlBar,
    gap: 12,
  },
  controlsCenter: {flex: 1},
  statusLabel: {
    textAlign: 'center',
    fontSize: 14,
    fontFamily: Petify.fontMedium,
    color: 'rgba(255,255,255,0.8)',
  },
  progressTrack: {
    marginTop: 8,
    height: 4,
    borderRadius: 2,
    backgroundColor: Petify.controlIconBg,
    overflow: 'hidden',
  },
  progressFill: {height: 4, backgroundColor: Petify.control},
  roundButton: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Petify.controlIconBg,
  },
  roundButtonSpacer: {width: 50, height: 50},
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    maxWidth: Petify.maxUiWidth - 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    gap: 10,
  },
  bannerDot: {width: 8, height: 8, borderRadius: 4},
  bannerText: {flex: 1, color: Petify.ink, fontSize: 14, fontFamily: Petify.fontMedium},
  sheetBackdrop: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)'},
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Petify.hairline,
    marginTop: 10,
    marginBottom: 12,
  },
  sheetTitle: {fontSize: 18, fontFamily: Petify.fontBold, color: Petify.ink},
  sheetBody: {paddingVertical: 12, gap: 12},
  guideCard: {
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    borderRadius: 12,
    backgroundColor: Petify.surfaceMuted,
  },
  guideCopy: {flex: 1},
  guideTitle: {fontSize: 15, fontFamily: Petify.fontBold, color: Petify.ink},
  guideBody: {
    marginTop: 4,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: Petify.font,
    color: Petify.inkMuted,
  },
  sheetClose: {
    height: 52,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(Petify.brand, 0.1),
  },
  sheetCloseLabel: {color: Petify.brand, fontSize: 16, fontFamily: Petify.fontMedium},
});
