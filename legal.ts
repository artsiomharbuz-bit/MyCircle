import AsyncStorage from '@react-native-async-storage/async-storage';

// Bump the matching date whenever the Privacy Policy or Terms of Use text
// changes. Everyone whose last acknowledged version differs gets the
// "we updated our policies" heads-up once (see LegalUpdateModal), then it
// stays quiet until the next bump.
export { LEGAL_VERSIONS } from './legalVersions';
import { LEGAL_VERSIONS } from './legalVersions';

const KEY = 'mycircle.legalAcknowledged';

function currentStamp(): string {
  return `${LEGAL_VERSIONS.privacy}|${LEGAL_VERSIONS.terms}`;
}

// Which document(s) changed since this device last acknowledged — null means
// nothing to show. An unset value (an existing user on their first launch of
// this version) counts as "both changed".
export async function getLegalUpdate(): Promise<{ privacy: boolean; terms: boolean } | null> {
  try {
    const stored = await AsyncStorage.getItem(KEY);
    if (stored === currentStamp()) return null;
    if (!stored) return { privacy: true, terms: true };
    const [privacy, terms] = stored.split('|');
    return {
      privacy: privacy !== LEGAL_VERSIONS.privacy,
      terms: terms !== LEGAL_VERSIONS.terms,
    };
  } catch {
    return null;
  }
}

export async function acknowledgeLegal(): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, currentStamp());
  } catch {
    // Best-effort — worst case the heads-up shows again next launch.
  }
}
