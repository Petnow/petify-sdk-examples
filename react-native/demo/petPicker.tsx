import React, {useCallback, useEffect, useState} from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {Icon, MaterialIcon, PetAvatar, Petify} from '../ui/petifyUi';
import {petLabel, type DemoPet} from './demoBackend';

/**
 * Picks a registered pet for a 1:1 verification (`GET /v2/pets`).
 *
 * Pets with fingerprints can be verified against. A pet without them is a
 * registration that never finished (the capture session has to be scoped to a
 * pet before the camera opens); the example discards its own as they happen,
 * and lists any it missed — an app killed mid-scan — so they can be deleted.
 *
 * Pets this example registered can be deleted from here. Deleting removes the
 * pet on the server, which takes its fingerprints with it.
 */
export function PetPickerSheet({
  visible,
  loadPets,
  onDelete,
  onPick,
  onClose,
}: {
  visible: boolean;
  loadPets: () => Promise<DemoPet[]>;
  onDelete: (pet: DemoPet) => Promise<void>;
  onPick: (pet: DemoPet) => void;
  onClose: () => void;
}) {
  const [pets, setPets] = useState<DemoPet[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const reload = useCallback(() => {
    setPets(null);
    setError(null);
    loadPets()
      .then(list => setPets(list.filter(pet => pet.hasFingerprint || pet.fromExample)))
      .catch(e => setError(String(e)));
  }, [loadPets]);

  useEffect(() => {
    if (visible) {
      reload();
    }
  }, [visible, reload]);

  const confirmDelete = (pet: DemoPet) => {
    Alert.alert(
      `Delete ${petLabel(pet)}?`,
      'This deletes the pet on the Petify server, including the fingerprints ' +
        'registered for it. It cannot be undone.',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setDeleting(pet.id);
            try {
              await onDelete(pet);
              setDeleting(null);
              reload();
            } catch (e) {
              setDeleting(null);
              Alert.alert('Could not delete', String(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <SafeAreaView style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={styles.title}>Verify against</Text>

        {pets === null && error === null ? (
          <View style={styles.center}>
            <ActivityIndicator color={Petify.brand} />
          </View>
        ) : error !== null ? (
          <View style={styles.center}>
            <Text style={styles.error}>Could not load pets: {error}</Text>
          </View>
        ) : pets!.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.empty}>
              No pet with fingerprints yet — register one first.
            </Text>
          </View>
        ) : (
          <FlatList
            data={pets!}
            keyExtractor={pet => pet.id}
            contentContainerStyle={styles.list}
            renderItem={({item: pet}) => {
              const busy = deleting === pet.id;
              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={busy || !pet.hasFingerprint}
                  onPress={() => onPick(pet)}
                  style={styles.row}>
                  <PetAvatar size={48} />
                  <View style={styles.rowCopy}>
                    <Text style={styles.rowTitle}>{petLabel(pet)}</Text>
                    <Text numberOfLines={1} style={styles.rowSubtitle}>
                      {pet.hasFingerprint ? pet.id : 'Unfinished registration'}
                    </Text>
                  </View>
                  {/* Only pets this example registered can be deleted here —
                      the rest of the account is not the example's to remove. */}
                  {pet.fromExample ? (
                    busy ? (
                      <ActivityIndicator size="small" color={Petify.inkFaint} />
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel="Delete pet and fingerprints"
                        hitSlop={8}
                        onPress={() => confirmDelete(pet)}>
                        <Icon
                          glyph={MaterialIcon.deleteOutline}
                          size={22}
                          color={Petify.inkFaint}
                        />
                      </Pressable>
                    )
                  ) : null}
                </Pressable>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.4)'},
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: '70%',
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  handle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Petify.hairline,
    marginTop: 10,
    marginBottom: 12,
  },
  title: {
    paddingHorizontal: 16,
    paddingBottom: 8,
    fontSize: 16,
    fontFamily: Petify.fontBold,
    color: Petify.ink,
  },
  center: {height: 180, alignItems: 'center', justifyContent: 'center', padding: 24},
  error: {color: Petify.error, textAlign: 'center', fontFamily: Petify.font},
  empty: {color: Petify.inkMuted, textAlign: 'center', fontFamily: Petify.font},
  list: {paddingHorizontal: 16, paddingBottom: 16},
  row: {flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 12},
  rowCopy: {flex: 1},
  rowTitle: {fontSize: 15, fontFamily: Petify.fontMedium, color: Petify.ink},
  rowSubtitle: {fontSize: 12, fontFamily: Petify.font, color: Petify.inkFaint},
});
