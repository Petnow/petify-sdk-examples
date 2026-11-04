import RNFS from 'react-native-fs';

/**
 * A pet's profile as the example shows it: a name and a photo.
 *
 * The B2B API stores the name (in the pet's free-form `metadata`) but has no
 * pet image, so the photo — one of the appearance (face) frames from the
 * registration capture — is kept on the device by {@link PetProfileStore}. A
 * real product would put both in its own database next to the PetNow pet id.
 *
 * The example uses `react-native-fs` for this; your app already has somewhere
 * to put a photo, and that is where it belongs.
 */
export interface PetProfile {
  petId: string;
  name: string;
  /** Absolute path of the saved profile photo, if one was kept. */
  imagePath?: string;
}

const DIR = `${RNFS.DocumentDirectoryPath}/pet_profiles`;
const INDEX = `${DIR}/profiles.json`;

/** Device-local profile storage: `profiles.json` plus one photo per pet. */
export class PetProfileStore {
  private cache: Record<string, PetProfile> = {};

  get profiles(): Record<string, PetProfile> {
    return this.cache;
  }

  get(petId: string): PetProfile | undefined {
    return this.cache[petId];
  }

  /** Reads the stored profiles into {@link profiles}. Safe on a fresh install. */
  async load(): Promise<Record<string, PetProfile>> {
    try {
      if (!(await RNFS.exists(INDEX))) {
        this.cache = {};
        return this.cache;
      }
      const raw = JSON.parse(await RNFS.readFile(INDEX, 'utf8')) as PetProfile[];
      this.cache = Object.fromEntries(raw.map(profile => [profile.petId, profile]));
    } catch {
      // A corrupt or unreadable index should not break the demo.
      this.cache = {};
    }
    return this.cache;
  }

  /** Stores `name` for `petId`, copying `sourceImagePath` in as the photo. */
  async save(args: {
    petId: string;
    name: string;
    sourceImagePath?: string | null;
  }): Promise<PetProfile> {
    let imagePath: string | undefined;
    const source = stripScheme(args.sourceImagePath);
    if (source && (await RNFS.exists(source))) {
      await RNFS.mkdir(DIR);
      imagePath = `${DIR}/${args.petId}.jpg`;
      // copyFile refuses to overwrite, so clear a previous photo first.
      if (await RNFS.exists(imagePath)) {
        await RNFS.unlink(imagePath);
      }
      await RNFS.copyFile(source, imagePath);
    }
    const profile: PetProfile = {petId: args.petId, name: args.name, imagePath};
    this.cache = {...this.cache, [args.petId]: profile};
    await this.writeIndex();
    return profile;
  }

  /** Forgets `petId`: drops the entry and its photo. */
  async remove(petId: string): Promise<void> {
    const profile = this.cache[petId];
    if (!profile) {
      return;
    }
    if (profile.imagePath) {
      try {
        if (await RNFS.exists(profile.imagePath)) {
          await RNFS.unlink(profile.imagePath);
        }
      } catch {
        // A photo we cannot delete should not block forgetting the profile.
      }
    }
    const next = {...this.cache};
    delete next[petId];
    this.cache = next;
    await this.writeIndex();
  }

  private async writeIndex(): Promise<void> {
    await RNFS.mkdir(DIR);
    await RNFS.writeFile(INDEX, JSON.stringify(Object.values(this.cache)), 'utf8');
  }
}

/** RNFS takes plain paths; the SDK may hand back a `file://` URI. */
function stripScheme(path?: string | null): string | undefined {
  if (!path) {
    return undefined;
  }
  return path.startsWith('file://') ? path.slice('file://'.length) : path;
}
