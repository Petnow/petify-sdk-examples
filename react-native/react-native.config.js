/**
 * The example bundles two fonts so it renders identically on both platforms:
 *
 *   Roboto                  — iOS would otherwise use SF Pro
 *   MaterialIcons-Regular   — the icon glyphs
 *
 * Run `npx react-native-asset` after changing this (it copies the files into
 * android/app/src/main/assets/fonts and adds UIAppFonts to Info.plist).
 * Both fonts are Apache-2.0; their licences sit next to them.
 */
module.exports = {
  project: {ios: {}, android: {}},
  assets: ['./assets/fonts'],
};
