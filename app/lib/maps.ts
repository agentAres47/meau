import { Linking, Platform } from 'react-native';
import polyline from '@mapbox/polyline';
import * as Location from 'expo-location';

const KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
const BASE = 'https://maps.googleapis.com/maps/api';

export type Place = { label: string; latitude: number; longitude: number };
export type Suggestion = { placeId: string; label: string };

// Places Autocomplete (REST — works in Expo Go). Biased to India, and to the
// user's location when provided (so "Amity" surfaces the nearest campus first).
export async function placesAutocomplete(
  query: string,
  bias?: { latitude: number; longitude: number }
): Promise<Suggestion[]> {
  if (!KEY || query.trim().length < 3) return [];
  const loc = bias ? `&location=${bias.latitude},${bias.longitude}&radius=30000` : '';
  const url = `${BASE}/place/autocomplete/json?input=${encodeURIComponent(query)}&components=country:in${loc}&key=${KEY}`;
  const res = await fetch(url).then((r) => r.json());
  if (res.status !== 'OK') return [];
  return (res.predictions ?? []).map((p: any) => ({ placeId: p.place_id, label: p.description }));
}

export async function placeDetails(placeId: string): Promise<Place | null> {
  if (!KEY) return null;
  const url = `${BASE}/place/details/json?place_id=${placeId}&fields=geometry,name,formatted_address&key=${KEY}`;
  const res = await fetch(url).then((r) => r.json());
  const loc = res.result?.geometry?.location;
  if (!loc) return null;
  return {
    label: res.result.formatted_address ?? res.result.name ?? 'Selected place',
    latitude: loc.lat,
    longitude: loc.lng,
  };
}

// Fast coordinate-only fix — prefers the OS's last-known location (instant) and
// only waits on a fresh GPS lock if there's no cached fix; skips reverse
// geocoding entirely. For camera recentering, where only lat/lng matter and
// waiting on a fresh fix + a geocode network round-trip felt sluggish.
export async function currentCoords(): Promise<{ latitude: number; longitude: number } | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const last = await Location.getLastKnownPositionAsync();
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
}

// Device location + reverse geocode (free, no key). Returns null if denied.
// Uses the last-known fix first (same reason as currentCoords) so the pickup
// auto-fill and its camera move don't stall on a cold GPS lock.
export async function currentPlace(): Promise<Place | null> {
  const perm = await Location.requestForegroundPermissionsAsync();
  if (!perm.granted) return null;
  const last = await Location.getLastKnownPositionAsync();
  const pos = last ?? (await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }));
  const { latitude, longitude } = pos.coords;
  let label = 'Current location';
  try {
    const [g] = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (g) label = [g.name, g.street, g.city].filter(Boolean).join(', ') || label;
  } catch {
    // reverse geocode is best-effort
  }
  return { label, latitude, longitude };
}

export type Route = { encoded: string; distanceKm: number; approximate: boolean };

// Google Directions (REST). Falls back to a straight line so a token can still be
// created (and matching still works, just without road-following) if Directions
// is unavailable — e.g. no key yet.
export async function getRoute(origin: Place, dest: Place): Promise<Route> {
  if (KEY) {
    try {
      const url = `${BASE}/directions/json?origin=${origin.latitude},${origin.longitude}&destination=${dest.latitude},${dest.longitude}&key=${KEY}`;
      const res = await fetch(url).then((r) => r.json());
      const route = res.routes?.[0];
      if (route?.overview_polyline?.points) {
        const meters = route.legs?.[0]?.distance?.value ?? 0;
        return { encoded: route.overview_polyline.points, distanceKm: meters / 1000, approximate: false };
      }
    } catch {
      // fall through to straight line
    }
  }
  const encoded = polyline.encode([
    [origin.latitude, origin.longitude],
    [dest.latitude, dest.longitude],
  ]);
  return { encoded, distanceKm: haversineKm(origin, dest), approximate: true };
}

export function decodeRoute(encoded: string): { latitude: number; longitude: number }[] {
  return polyline.decode(encoded).map(([latitude, longitude]) => ({ latitude, longitude }));
}

// Distance-based suggested fare per seat (05-DRIVER-FLOW.md): clamp(20,150, 8/km).
export function suggestedPrice(distanceKm: number): number {
  return Math.min(150, Math.max(20, Math.round(8 * distanceKm)));
}

// One-tap: open the device's maps app with turn-by-turn to a coordinate.
// Android → Google Maps navigation intent; iOS → Apple/Google; falls back to the
// universal Maps URL. No native module — just Linking (core RN).
export async function openNavigationTo(latitude: number, longitude: number): Promise<void> {
  const native =
    Platform.OS === 'android'
      ? `google.navigation:q=${latitude},${longitude}`
      : `maps://?daddr=${latitude},${longitude}&dirflg=d`;
  const web = `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}&travelmode=driving`;
  try {
    const canNative = await Linking.canOpenURL(native);
    await Linking.openURL(canNative ? native : web);
  } catch {
    await Linking.openURL(web).catch(() => {});
  }
}

function haversineKm(a: Place, b: Place): number {
  const R = 6371;
  const dLat = ((b.latitude - a.latitude) * Math.PI) / 180;
  const dLng = ((b.longitude - a.longitude) * Math.PI) / 180;
  const lat1 = (a.latitude * Math.PI) / 180;
  const lat2 = (b.latitude * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(h));
}
