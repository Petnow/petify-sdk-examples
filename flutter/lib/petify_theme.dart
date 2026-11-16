import 'package:flutter/material.dart';

/// The Petify app's palette, shared by the iOS, Android and React Native
/// examples. Only the example's own screens use it; the SDK's camera overlay
/// keeps its own look.
abstract final class Petify {
  static const appBg = Color(0xFFF3F3F4);
  static const surface = Color(0xFFFFFFFF);
  static const main = Color(0xFFFF592C);
  static const mainPressed = Color(0xFFCE4926);
  static const mainTint = Color(0xFFFFF3F1);

  /// The two action cards on Home.
  static const actionCard = Color(0xFF5476CD);

  /// The paw in a pet's avatar, on [surfaceTint].
  static const brand = Color(0xFF0033B5);
  static const surfaceTint = Color(0xFFE8EDF9);

  static const ink = Color(0xFF111111);
  static const inkMuted = Color(0xFF4B5563);
  static const inkFaint = Color(0xFF9CA3AF);
  static const hairline = Color(0xFFE5E7EB);
  static const success = Color(0xFF2FC869);
  static const error = Color(0xFFFF323E);
}

ThemeData petifyTheme() {
  final shape = RoundedRectangleBorder(borderRadius: BorderRadius.circular(12));
  const size = Size.fromHeight(52);
  const label = TextStyle(fontSize: 16, fontWeight: FontWeight.w500);
  return ThemeData(
    useMaterial3: true,
    colorScheme: ColorScheme.fromSeed(seedColor: Petify.main).copyWith(
      primary: Petify.main,
      onPrimary: Colors.white,
      error: Petify.error,
      surface: Petify.surface,
      onSurface: Petify.ink,
    ),
    scaffoldBackgroundColor: Petify.appBg,
    appBarTheme: const AppBarTheme(
      backgroundColor: Petify.surface,
      foregroundColor: Petify.ink,
      surfaceTintColor: Colors.transparent,
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: size,
        shape: shape,
        textStyle: label,
        backgroundColor: Petify.main,
        foregroundColor: Colors.white,
      ).copyWith(
        overlayColor: WidgetStateProperty.resolveWith((states) =>
            states.contains(WidgetState.pressed) ? Petify.mainPressed : null),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: size,
        shape: shape,
        textStyle: label,
        foregroundColor: Petify.main,
        side: const BorderSide(color: Petify.main),
      ),
    ),
    textButtonTheme: TextButtonThemeData(
      style: TextButton.styleFrom(foregroundColor: Petify.main),
    ),
    progressIndicatorTheme:
        const ProgressIndicatorThemeData(color: Petify.main),
  );
}

/// The first 8 characters of a pet ID, for lists and subtitles.
String shortPetId(String petId) =>
    petId.length > 8 ? '${petId.substring(0, 8)}…' : petId;
