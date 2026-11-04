/**
 * Form primitives for the pet profile page.
 *
 * The Petify app builds these out of its design system; the example keeps a
 * small hand-rolled set so it stays dependency-free — a sample that needs a
 * form kit, a date picker and a bottom-sheet library before it runs is a bad
 * sample. Everything here uses the tokens in `petifyUi.tsx`.
 */
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {Icon, MaterialIcon, Petify, PetifyPrimaryButton} from './petifyUi';

/** Screen header with a back arrow — the app's TopAppBar. */
export function ScreenBar({
  title,
  onBack,
}: {
  title: string;
  onBack: () => void;
}) {
  return (
    <View style={styles.bar}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={8}
        onPress={onBack}
        style={styles.barBack}>
        <Icon glyph={MaterialIcon.arrowBack} size={24} color={Petify.ink} />
      </Pressable>
      <Text style={styles.barTitle} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

/** Step eyebrow + headline + body, as on the app's guide pages. */
export function PageTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <View style={styles.pageTitle}>
      {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
      <Text style={styles.headline}>{title}</Text>
      {description ? <Text style={styles.body}>{description}</Text> : null}
    </View>
  );
}

function FieldLabel({label, required}: {label: string; required?: boolean}) {
  return (
    <Text style={styles.label}>
      {label}
      {required ? <Text style={styles.required}> *</Text> : null}
    </Text>
  );
}

function FieldError({error}: {error?: string}) {
  return error ? <Text style={styles.error}>{error}</Text> : null;
}

/** Single-line text entry with a counter, matching the app's name field. */
export function TextField({
  label,
  required,
  placeholder,
  value,
  onChangeText,
  maxLength,
  error,
}: {
  label: string;
  required?: boolean;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  maxLength?: number;
  error?: string;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <View style={[styles.input, !!error && styles.inputError]}>
        <TextInput
          style={styles.inputText}
          placeholder={placeholder}
          placeholderTextColor={Petify.inkFaint}
          value={value}
          onChangeText={onChangeText}
          maxLength={maxLength}
        />
        {maxLength ? (
          <Text style={styles.counter}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>
      <FieldError error={error} />
    </View>
  );
}

/** Looks like a text field, opens a picker instead of the keyboard. */
export function SelectField({
  label,
  required,
  placeholder,
  value,
  error,
  glyph = MaterialIcon.expandMore,
  onPress,
}: {
  label: string;
  required?: boolean;
  placeholder: string;
  value?: string | null;
  error?: string;
  glyph?: string;
  onPress: () => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <Pressable
        accessibilityRole="button"
        onPress={onPress}
        style={({pressed}) => [
          styles.input,
          !!error && styles.inputError,
          pressed && styles.inputPressed,
        ]}>
        <Text style={[styles.inputText, !value && styles.placeholder]} numberOfLines={1}>
          {value || placeholder}
        </Text>
        <Icon glyph={glyph} size={20} color={Petify.inkFaint} />
      </Pressable>
      <FieldError error={error} />
    </View>
  );
}

/** Two- or three-way choice rendered as filled pills (gender, species). */
export function ChoiceRow<T extends string>({
  label,
  required,
  value,
  options,
  error,
  onChange,
}: {
  label: string;
  required?: boolean;
  value: T | null;
  options: {value: T; label: string}[];
  error?: string;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.field}>
      <FieldLabel label={label} required={required} />
      <View style={styles.choiceRow}>
        {options.map(option => {
          const selected = option.value === value;
          return (
            <Pressable
              key={option.value}
              accessibilityRole="button"
              accessibilityState={{selected}}
              onPress={() => onChange(option.value)}
              style={[styles.choice, selected && styles.choiceOn]}>
              <Text style={[styles.choiceLabel, selected && styles.choiceLabelOn]}>
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <FieldError error={error} />
    </View>
  );
}

/** Optional yes/no, e.g. "Neutered". */
export function CheckRow({
  checked,
  label,
  onPress,
}: {
  checked: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{checked}}
      hitSlop={8}
      onPress={onPress}
      style={styles.checkRow}>
      <Icon
        glyph={checked ? MaterialIcon.checkBox : MaterialIcon.checkBoxBlank}
        size={22}
        color={checked ? Petify.main : Petify.inkFaint}
      />
      <Text style={styles.checkLabel}>{label}</Text>
    </Pressable>
  );
}

/** Bottom sheet with a scrollable list — the breed picker. */
export function OptionSheet({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: string[];
  value?: string | null;
  onSelect: (option: string) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>{title}</Text>
        <ScrollView style={styles.sheetList}>
          {options.map(option => {
            const selected = option === value;
            return (
              <Pressable
                key={option}
                accessibilityRole="button"
                onPress={() => onSelect(option)}
                style={({pressed}) => [
                  styles.sheetRow,
                  pressed && {backgroundColor: Petify.mainTint},
                ]}>
                <Text style={[styles.sheetRowLabel, selected && styles.sheetRowOn]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    </Modal>
  );
}

/**
 * Date of birth, as three scrolling columns.
 *
 * `@react-native-community/datetimepicker` would be the real answer in an app;
 * three lists keep the example installable with `npm install` alone.
 */
export function DateSheet({
  visible,
  value,
  onConfirm,
  onClose,
}: {
  visible: boolean;
  /** `YYYY-MM-DD`, or null when nothing has been chosen yet. */
  value: string | null;
  onConfirm: (date: string) => void;
  onClose: () => void;
}) {
  const today = new Date();
  const parsed = value ? value.split('-').map(Number) : null;
  const [year, setYear] = React.useState(parsed?.[0] ?? today.getFullYear());
  const [month, setMonth] = React.useState(parsed?.[1] ?? today.getMonth() + 1);
  const [day, setDay] = React.useState(parsed?.[2] ?? today.getDate());

  // A pet's birthday cannot be in the future, and 30 years covers every animal
  // the SDK is used on.
  const years = Array.from({length: 30}, (_, i) => today.getFullYear() - i);
  const months = Array.from({length: 12}, (_, i) => i + 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({length: daysInMonth}, (_, i) => i + 1);

  const clampedDay = Math.min(day, daysInMonth);
  const pad = (n: number) => String(n).padStart(2, '0');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} />
      <View style={styles.sheet}>
        <Text style={styles.sheetTitle}>Date of birth</Text>
        <View style={styles.wheels}>
          <Wheel label="Year" values={years} selected={year} onSelect={setYear} />
          <Wheel label="Month" values={months} selected={month} onSelect={setMonth} />
          <Wheel label="Day" values={days} selected={clampedDay} onSelect={setDay} />
        </View>
        <View style={styles.sheetFooter}>
          <PetifyPrimaryButton
            label="Confirm"
            onPress={() => onConfirm(`${year}-${pad(month)}-${pad(clampedDay)}`)}
          />
        </View>
      </View>
    </Modal>
  );
}

function Wheel({
  label,
  values,
  selected,
  onSelect,
}: {
  label: string;
  values: number[];
  selected: number;
  onSelect: (value: number) => void;
}) {
  return (
    <View style={styles.wheelColumn}>
      <Text style={styles.wheelHeader}>{label}</Text>
      <ScrollView style={styles.wheel} showsVerticalScrollIndicator={false}>
        {values.map(v => (
          <Pressable key={v} onPress={() => onSelect(v)} style={styles.wheelRow}>
            <Text style={[styles.wheelLabel, v === selected && styles.wheelLabelOn]}>
              {v}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

/** "3 years 2 months", the age pill under the birthdate field. */
export function formatAge(birthdate: string): string {
  const born = new Date(birthdate);
  const now = new Date();
  let months =
    (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth());
  if (now.getDate() < born.getDate()) {
    months -= 1;
  }
  if (months < 0) {
    return 'Not born yet';
  }
  const years = Math.floor(months / 12);
  const rest = months % 12;
  if (years === 0) {
    return `${rest} month${rest === 1 ? '' : 's'} old`;
  }
  return rest === 0
    ? `${years} year${years === 1 ? '' : 's'} old`
    : `${years} year${years === 1 ? '' : 's'} ${rest} month${rest === 1 ? '' : 's'} old`;
}

const styles = StyleSheet.create({
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    backgroundColor: Petify.surface,
  },
  barBack: {width: 32, height: 32, alignItems: 'center', justifyContent: 'center'},
  barTitle: {flex: 1, fontSize: 18, fontFamily: Petify.fontBold, color: Petify.ink},

  pageTitle: {paddingHorizontal: 16, paddingTop: 20, paddingBottom: 12, gap: 6},
  eyebrow: {fontSize: 14, fontFamily: Petify.fontBold, color: Petify.main},
  headline: {fontSize: 22, lineHeight: 30, fontFamily: Petify.fontBold, color: Petify.ink},
  body: {fontSize: 14, lineHeight: 21, fontFamily: Petify.font, color: Petify.inkMuted},

  field: {gap: 8},
  label: {fontSize: 14, fontFamily: Petify.fontBold, color: Petify.ink},
  required: {color: Petify.main},
  input: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Petify.line,
    backgroundColor: Petify.surface,
  },
  inputPressed: {borderColor: Petify.main, backgroundColor: Petify.mainTint},
  inputError: {borderColor: Petify.error},
  inputText: {
    flex: 1,
    padding: 0,
    fontSize: 16,
    fontFamily: Petify.font,
    color: Petify.ink,
  },
  placeholder: {color: Petify.inkFaint},
  counter: {fontSize: 12, fontFamily: Petify.font, color: Petify.inkFaint},
  error: {fontSize: 12, fontFamily: Petify.fontMedium, color: Petify.error},

  choiceRow: {flexDirection: 'row', gap: 8},
  choice: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Petify.line,
    backgroundColor: Petify.surface,
  },
  choiceOn: {borderColor: Petify.main, backgroundColor: Petify.mainTint},
  choiceLabel: {fontSize: 15, fontFamily: Petify.fontMedium, color: Petify.inkMuted},
  choiceLabelOn: {color: Petify.main},

  checkRow: {flexDirection: 'row', alignItems: 'center', gap: 10},
  checkLabel: {fontSize: 15, fontFamily: Petify.font, color: Petify.ink},

  scrim: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(10,11,12,0.45)'},
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    backgroundColor: Petify.surface,
    paddingTop: 18,
    // Keeps the last row clear of the system navigation bar.
    paddingBottom: 28,
  },
  sheetTitle: {
    paddingHorizontal: 20,
    paddingBottom: 12,
    fontSize: 17,
    fontFamily: Petify.fontBold,
    color: Petify.ink,
  },
  sheetList: {maxHeight: 320},
  sheetRow: {paddingHorizontal: 20, paddingVertical: 14},
  sheetRowLabel: {fontSize: 16, fontFamily: Petify.font, color: Petify.ink},
  sheetRowOn: {color: Petify.main, fontFamily: Petify.fontMedium},
  sheetFooter: {padding: 16},

  wheels: {flexDirection: 'row', height: 240, paddingHorizontal: 16},
  wheelColumn: {flex: 1},
  wheelHeader: {
    paddingBottom: 6,
    textAlign: 'center',
    fontSize: 12,
    fontFamily: Petify.fontMedium,
    color: Petify.inkFaint,
  },
  wheel: {flex: 1},
  wheelRow: {paddingVertical: 10, alignItems: 'center'},
  wheelLabel: {fontSize: 16, fontFamily: Petify.font, color: Petify.inkFaint},
  wheelLabelOn: {fontSize: 18, fontFamily: Petify.fontBold, color: Petify.main},
});
