/**
 * The building blocks the screens share: the palette, Material icons, a screen
 * with a title, a card, and two buttons.
 */
import React from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';

/** The Petify app's palette. */
export const colors = {
  appBg: '#F3F3F4',
  surface: '#FFFFFF',
  main: '#FF592C',
  mainPressed: '#CE4926',
  mainTint: '#FFF3F1',
  /** The two action cards on Home. */
  actionCard: '#5476CD',
  brand: '#0033B5',
  surfaceTint: '#E8EDF9',
  ink: '#111111',
  inkMuted: '#4B5563',
  inkFaint: '#9CA3AF',
  hairline: '#E5E7EB',
  success: '#2FC869',
  error: '#FF323E',
};

/**
 * Material icons, drawn from the bundled `assets/fonts/MaterialIcons-Regular.otf`
 * (the font Flutter ships; CC BY 4.0, licence next to it). The codepoints are
 * the ones Flutter's `Icons` uses for the same names. Linked on Android through
 * `sourceSets` in android/app/build.gradle and on iOS through `UIAppFonts`.
 */
export const MaterialIcon = {
  arrowBack: '',
  cancel: '',
  centerFocusStrong: '',
  checkCircle: '',
  chevronRight: '',
  close: '',
  errorOutline: '',
  infoOutline: '',
  keyOff: '󰔬', // U+F052C, outside the BMP
  pets: '',
  photoCamera: '',
  qrCodeScanner: '',
  volumeUp: '',
  wbSunny: '',
} as const;

export function Icon({
  glyph,
  size = 24,
  color = colors.ink,
}: {
  glyph: string;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      allowFontScaling={false}
      accessible={false}
      style={[styles.icon, {fontSize: size, lineHeight: size, color}]}>
      {glyph}
    </Text>
  );
}

export function Screen({
  title,
  subtitle,
  onBack,
  children,
}: {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.screen}>
      {/* Two safe areas: the white header takes the top inset, the body the bottom one. */}
      <SafeAreaView style={styles.headerBar}>
        <View style={styles.header}>
          {onBack ? (
            <Pressable
              onPress={onBack}
              accessibilityRole="button"
              accessibilityLabel="Back"
              hitSlop={12}
              style={styles.back}>
              <Icon glyph={MaterialIcon.arrowBack} color={colors.ink} />
            </Pressable>
          ) : null}
          <View style={styles.titles}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          </View>
        </View>
      </SafeAreaView>
      <SafeAreaView style={styles.fill}>
        <View style={styles.body}>{children}</View>
      </SafeAreaView>
    </View>
  );
}

/** A white card with an icon and a title on top. */
export function Card({
  title,
  glyph,
  children,
}: {
  title: string;
  glyph: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Icon glyph={glyph} size={24} color={colors.main} />
        <Text style={styles.cardTitle} accessibilityRole="header">
          {title}
        </Text>
      </View>
      {children}
    </View>
  );
}

export function Button({
  label,
  onPress,
  disabled = false,
  secondary = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  secondary?: boolean;
}) {
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      accessibilityRole="button"
      accessibilityState={{disabled}}
      style={({pressed}) => [
        styles.button,
        secondary && styles.secondary,
        pressed && !secondary && {backgroundColor: colors.mainPressed},
        pressed && secondary && {backgroundColor: colors.mainTint},
        disabled && styles.disabled,
      ]}>
      <Text style={[styles.buttonLabel, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  icon: {fontFamily: 'MaterialIcons-Regular'},
  screen: {flex: 1, backgroundColor: colors.appBg},
  headerBar: {backgroundColor: colors.surface},
  header: {flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12},
  fill: {flex: 1},
  back: {padding: 4},
  titles: {flex: 1},
  title: {fontSize: 20, fontWeight: '700', color: colors.ink},
  subtitle: {fontSize: 13, color: colors.inkMuted, marginTop: 2},
  body: {flex: 1, padding: 16, gap: 12},
  card: {backgroundColor: colors.surface, borderRadius: 16, padding: 16, gap: 16},
  cardHeader: {flexDirection: 'row', alignItems: 'center', gap: 8},
  cardTitle: {fontSize: 18, fontWeight: '700', color: colors.ink},
  button: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.main,
  },
  secondary: {backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.main},
  disabled: {opacity: 0.4},
  buttonLabel: {fontSize: 16, fontWeight: '600', color: '#FFFFFF'},
  secondaryLabel: {color: colors.main},
});
