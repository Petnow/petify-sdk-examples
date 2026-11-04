/**
 * The example bundles one font, Material Icons, for its icon glyphs (text uses
 * the system font). Run `npx react-native-asset` after changing this: it copies
 * the files into android/app/src/main/assets/fonts and lists them under
 * UIAppFonts in Info.plist. The font is Apache-2.0; its licence sits next to it.
 */
module.exports = {
  project: {ios: {}, android: {}},
  assets: ['./assets/fonts'],
};
