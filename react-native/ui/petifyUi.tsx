import React from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

/**
 * Design tokens and shared chrome for this example. None of it is part of the
 * SDK: it is one app's look, and yours will differ.
 */
export const Petify = {
  /** Brand blue — ring, primary buttons, callout. */
  brand: '#0033B5',
  control: '#5476CD',
  success: '#2FC869',
  error: '#FF323E',

  /** Bottom control bar. */
  controlBar: '#050608',

  /** Sheets and floating dark panels. */
  sheet: '#1A1D21',

  /** Dim outside the mask circle — rgba(10,11,12,0.55). */
  dimOverlay: 'rgba(10,11,12,0.55)',

  /** Control-bar icon buttons — white 15% idle, brand 30% active. */
  controlIconBg: 'rgba(255,255,255,0.15)',
  controlIconActive: 'rgba(0,51,181,0.30)',

  /** Guide callout under the circle — brand 80%. */
  calloutBg: 'rgba(0,51,181,0.80)',

  /**
   * App chrome. The capture surface above keeps its own colours, so the SDK's
   * overlay still looks like itself; everything the example draws around it
   * uses these.
   */
  main: '#FF592C',
  mainPressed: '#CE4926',
  mainTint: '#FFF3F1',
  sub: '#4389E5',
  /** The action cards on the home screen. */
  actionCard: '#5476CD',
  appBg: '#F3F3F4',
  surface: '#FFFFFF',
  line: '#D8DADC',

  ink: '#111111',
  inkMuted: '#4B5563',
  inkFaint: '#9CA3AF',
  hairline: '#E5E7EB',
  surfaceTint: '#E8EDF9',
  surfaceMuted: '#F3F4F6',

  /** Text uses the system font; icons come from the bundled Material Icons. */
  font: undefined,
  fontMedium: undefined,
  fontBold: undefined,
  iconFont: 'MaterialIcons-Regular',

  /** Overlay chrome is centred and capped at this width. */
  maxUiWidth: 400,

  /** Mask circle geometry. */
  maskMargin: 12,
  maskVerticalOffset: -44,
  maskStrokeWidth: 5,
} as const;

/** Full-width filled action ("Next", "Confirm"). */
export function PetifyPrimaryButton({
  label,
  onPress,
  busy = false,
}: {
  label: string;
  onPress?: (() => void) | null;
  busy?: boolean;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress ?? undefined}
      style={[styles.primary, disabled && styles.primaryDisabled]}>
      {busy ? <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" /> : null}
      <Text style={[styles.primaryLabel, disabled && styles.primaryLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );
}

/** Full-width outlined action ("Scan again"). */
export function PetifySecondaryButton({
  label,
  onPress,
}: {
  label: string;
  onPress?: (() => void) | null;
}) {
  const disabled = !onPress;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress ?? undefined}
      style={[styles.secondary, disabled && {opacity: 0.4}]}>
      <Text style={styles.secondaryLabel}>{label}</Text>
    </Pressable>
  );
}

/** A pet's avatar: a paw on a tinted tile. */
export function PetAvatar({size = 48}: {size?: number}) {
  return (
    <View
      style={[styles.avatarFallback, {width: size, height: size, borderRadius: size / 4}]}>
      <Icon glyph={MaterialIcon.pets} size={size / 2} color={Petify.brand} />
    </View>
  );
}

/**
 * The SDK hands back plain filesystem paths on Android and `file://` URIs on
 * iOS; `<Image>` needs a URI either way.
 */
export function toFileUri(path: string): string {
  return path.startsWith('file://') || path.startsWith('content://')
    ? path
    : `file://${path}`;
}

/** Small notice card used for the API-key / SDK-state hints. */
export function PetifyNotice({
  message,
  tone = Petify.brand,
  icon = MaterialIcon.infoOutline,
}: {
  message: string;
  tone?: string;
  icon?: string;
}) {
  return (
    <View
      style={[
        styles.notice,
        {backgroundColor: withAlpha(tone, 0.08), borderColor: withAlpha(tone, 0.25)},
      ]}>
      <Icon glyph={icon} size={18} color={tone} />
      <Text style={[styles.noticeText, {color: tone}]}>{message}</Text>
    </View>
  );
}

/** `#RRGGBB` + alpha → `rgba(...)`, so tokens can be tinted like the web app. */
export function withAlpha(hex: string, alpha: number): string {
  const v = hex.replace('#', '');
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

/**
 * A Material icon, drawn from the bundled Material Icons font by codepoint.
 */
export const MaterialIcon = {
  wbSunny: '\uf4bc',
  centerFocusStrong: '\uef3a',
  close: '\ue16a',
  helpOutline: '\ue30b',
  cameraswitch: '\uef26',
  pets: '\ue4a1',
  infoOutline: '\ue33d',
  keyOff: '\udb81\udd2c', // U+F052C, outside the BMP
  errorOutline: '\ue238',
  hourglassEmpty: '\ue325',
  deleteOutline: '\ue1bb',
  chevronRight: '\ue15f',
  qrCodeScanner: '\ue4f7',
  photoCamera: '\ue4b6',
  arrowBack: '\ue092',
} as const;

export function Icon({
  glyph,
  size = 24,
  color = Petify.ink,
}: {
  glyph: string;
  size?: number;
  color?: string;
}) {
  return (
    <Text
      allowFontScaling={false}
      style={{fontFamily: Petify.iconFont, fontSize: size, color, lineHeight: size * 1.1}}>
      {glyph}
    </Text>
  );
}

const styles = StyleSheet.create({
  primary: {
    height: 56,
    borderRadius: 10,
    backgroundColor: Petify.brand,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  primaryDisabled: {backgroundColor: withAlpha(Petify.brand, 0.35)},
  primaryLabel: {color: '#FFFFFF', fontSize: 16, fontFamily: Petify.fontMedium},
  primaryLabelDisabled: {color: 'rgba(255,255,255,0.7)'},
  secondary: {
    height: 56,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Petify.brand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryLabel: {color: Petify.brand, fontSize: 16, fontFamily: Petify.fontMedium},
  avatarFallback: {
    backgroundColor: Petify.surfaceTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  noticeText: {flex: 1, fontSize: 13, lineHeight: 19, fontFamily: Petify.fontMedium},
});

// ---------------------------------------------------------------------------
// App chrome — the Petify app's home shell: a logo bar, cards, and the two big
// action cards that start a scan.
// ---------------------------------------------------------------------------

/** Top bar with the Petify logo. 56pt tall, white, no actions. */
export function AppBar() {
  return (
    <View style={appStyles.appBar}>
      <Image
        source={require('../assets/images/petify-logo.png')}
        style={appStyles.logo}
        resizeMode="contain"
      />
    </View>
  );
}

/** White rounded panel; everything on the home screen sits in one. */
export function Card({children}: {children: React.ReactNode}) {
  return <View style={appStyles.card}>{children}</View>;
}

/** Card title row, with an optional trailing action ("See more"). */
export function CardHeader({
  title,
  glyph,
  action,
}: {
  title: string;
  glyph?: string;
  action?: {label: string; onPress: (() => void) | null};
}) {
  return (
    <View style={appStyles.cardHeader}>
      {glyph ? <Icon glyph={glyph} size={22} color={Petify.main} /> : null}
      <Text style={appStyles.cardTitle}>{title}</Text>
      {action ? (
        <Pressable onPress={action.onPress ?? undefined} disabled={!action.onPress}>
          <Text
            style={[
              appStyles.cardAction,
              !action.onPress && appStyles.cardActionOff,
            ]}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}

/**
 * The home screen's primary call to action: a coloured tile with the title at
 * the top left and a large glyph bottom right.
 */
export function ActionCard({
  title,
  glyph,
  onPress,
}: {
  title: string;
  glyph: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({pressed}) => [appStyles.action, pressed && appStyles.actionPressed]}
      onPress={onPress}>
      <Text style={appStyles.actionTitle}>{title}</Text>
      <View style={appStyles.actionGlyph}>
        <Icon glyph={glyph} size={64} color="rgba(255,255,255,0.28)" />
      </View>
    </Pressable>
  );
}

/** One pet in the home screen's list card. */
export function ListRow({
  title,
  subtitle,
  onPress,
  last = false,
}: {
  title: string;
  subtitle?: string;
  onPress?: () => void;
  last?: boolean;
}) {
  return (
    <Pressable
      style={({pressed}) => [
        appStyles.row,
        !last && appStyles.rowLine,
        pressed && {backgroundColor: Petify.mainTint},
      ]}
      onPress={onPress}>
      <PetAvatar size={44} />
      <View style={{flex: 1}}>
        <Text style={appStyles.rowTitle} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={appStyles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <Icon glyph={MaterialIcon.chevronRight} size={20} color={Petify.inkFaint} />
    </Pressable>
  );
}

/** Empty / error / loading line inside a card. */
export function CardMessage({text}: {text: string}) {
  return <Text style={appStyles.cardMessage}>{text}</Text>;
}

/**
 * Species chooser, shown when an action card is tapped. The app asks which
 * animal before it opens the camera, because the capture is species-specific.
 */
export function SpeciesPopup({
  visible,
  title,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  onSelect: (species: 'DOG' | 'CAT') => void;
  onClose: () => void;
}) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <Pressable style={appStyles.popupScrim} onPress={onClose}>
        <Pressable style={appStyles.popup} onPress={() => {}}>
          <Text style={appStyles.popupTitle}>{title}</Text>
          <View style={appStyles.popupRow}>
            {(
              [
                {value: 'DOG' as const, label: 'Dog', glyph: MaterialIcon.pets},
                {value: 'CAT' as const, label: 'Cat', glyph: MaterialIcon.pets},
              ]
            ).map(option => (
              <Pressable
                key={option.value}
                style={({pressed}) => [
                  appStyles.popupChoice,
                  pressed && {borderColor: Petify.main, backgroundColor: Petify.mainTint},
                ]}
                onPress={() => onSelect(option.value)}>
                <Icon glyph={option.glyph} size={32} color={Petify.main} />
                <Text style={appStyles.popupChoiceLabel}>{option.label}</Text>
              </Pressable>
            ))}
          </View>
          <Pressable style={appStyles.popupCancel} onPress={onClose}>
            <Text style={appStyles.popupCancelLabel}>Cancel</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const appStyles = StyleSheet.create({
  appBar: {
    height: 56,
    justifyContent: 'center',
    paddingHorizontal: 16,
    backgroundColor: Petify.surface,
  },
  logo: {width: 96, height: 26},
  card: {
    borderRadius: 12,
    backgroundColor: Petify.surface,
    overflow: 'hidden',
  },
  cardHeader: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  cardTitle: {
    flex: 1,
    color: Petify.ink,
    fontSize: 18,
    fontFamily: Petify.fontBold,
  },
  cardAction: {color: Petify.main, fontSize: 14, fontFamily: Petify.fontMedium},
  cardActionOff: {color: Petify.inkFaint},
  action: {
    flex: 1,
    height: 160,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Petify.actionCard,
    padding: 16,
  },
  actionPressed: {opacity: 0.9},
  actionTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    lineHeight: 24,
    fontFamily: Petify.fontBold,
    maxWidth: 120,
  },
  actionGlyph: {position: 'absolute', right: 6, bottom: 2},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowLine: {borderBottomWidth: 1, borderBottomColor: Petify.surfaceMuted},
  rowTitle: {color: Petify.ink, fontSize: 16, fontFamily: Petify.fontMedium},
  rowSubtitle: {marginTop: 2, color: Petify.inkMuted, fontSize: 13, fontFamily: Petify.font},
  cardMessage: {
    paddingHorizontal: 16,
    paddingBottom: 20,
    color: Petify.inkMuted,
    fontSize: 14,
    fontFamily: Petify.font,
  },
  popupScrim: {
    flex: 1,
    backgroundColor: 'rgba(10,11,12,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  popup: {
    width: '100%',
    maxWidth: 360,
    borderRadius: 16,
    backgroundColor: Petify.surface,
    padding: 20,
    gap: 16,
  },
  popupTitle: {
    color: Petify.ink,
    fontSize: 18,
    fontFamily: Petify.fontBold,
    textAlign: 'center',
  },
  popupRow: {flexDirection: 'row', gap: 12},
  popupChoice: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Petify.line,
  },
  popupChoiceLabel: {color: Petify.ink, fontSize: 16, fontFamily: Petify.fontMedium},
  popupCancel: {alignItems: 'center', paddingVertical: 8},
  popupCancelLabel: {color: Petify.inkMuted, fontSize: 15, fontFamily: Petify.fontMedium},
});
