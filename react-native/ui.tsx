/** The few building blocks the screens share: a screen with a title, and a button. */
import React from 'react';
import {Pressable, SafeAreaView, StyleSheet, Text, View} from 'react-native';

export const colors = {
  accent: '#FF592C',
  background: '#FFFFFF',
  text: '#111111',
  muted: '#5F6368',
  error: '#D93025',
};

export function Screen({
  title,
  onBack,
  children,
}: {
  title: string;
  onBack?: () => void;
  children: React.ReactNode;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" hitSlop={12}>
            <Text style={styles.back}>‹ Back</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title} accessibilityRole="header">
          {title}
        </Text>
      </View>
      <View style={styles.body}>{children}</View>
    </SafeAreaView>
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
      style={[styles.button, secondary && styles.secondary, disabled && styles.disabled]}>
      <Text style={[styles.buttonLabel, secondary && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, backgroundColor: colors.background},
  header: {paddingHorizontal: 24, paddingTop: 16, gap: 8},
  back: {fontSize: 16, color: colors.accent},
  title: {fontSize: 26, fontWeight: '700', color: colors.text},
  body: {flex: 1, padding: 24, gap: 16},
  button: {
    minHeight: 52,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: colors.accent,
  },
  secondary: {backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.accent},
  disabled: {opacity: 0.4},
  buttonLabel: {fontSize: 16, fontWeight: '600', color: '#FFFFFF'},
  secondaryLabel: {color: colors.accent},
});
