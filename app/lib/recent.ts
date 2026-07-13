import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Place } from './maps';

const KEY = 'meau.recentPlaces';
const MAX = 6;

export async function getRecent(): Promise<Place[]> {
  try {
    const json = await AsyncStorage.getItem(KEY);
    return json ? (JSON.parse(json) as Place[]) : [];
  } catch {
    return [];
  }
}

// Prepend, dedupe by label, cap. Most-recent first.
export async function saveRecent(place: Place): Promise<void> {
  const list = await getRecent();
  const next = [place, ...list.filter((p) => p.label !== place.label)].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
}
