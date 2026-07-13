import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import { X, MapPin, LocateFixed, Clock } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Input } from '../../components/Input';
import { useRideDraft } from '../../store/rideDraft';
import {
  placesAutocomplete,
  placeDetails,
  currentPlace,
  type Suggestion,
  type Place,
} from '../../lib/maps';
import { getRecent, saveRecent } from '../../lib/recent';

export default function LocationPicker() {
  const { field } = useLocalSearchParams<{ field: 'origin' | 'dest' }>();
  const setPlace = useRideDraft((s) => s.setPlace);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [recent, setRecent] = useState<Place[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bias, setBias] = useState<{ latitude: number; longitude: number } | undefined>();

  useEffect(() => {
    getRecent().then(setRecent);
    // Silent location for search bias (no prompt; null if not granted).
    Location.getLastKnownPositionAsync()
      .then((p) => p && setBias({ latitude: p.coords.latitude, longitude: p.coords.longitude }))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      placesAutocomplete(query, bias).then(setSuggestions);
    }, 300);
    return () => clearTimeout(t);
  }, [query, bias]);

  async function pick(place: Place | null) {
    if (!place) {
      setError("Couldn't get that location. Check your connection and try again.");
      return;
    }
    if (field) {
      await saveRecent(place);
      setPlace(field, place);
      router.back();
    }
  }

  async function choose(placeId: string) {
    setBusy(true);
    setError(null);
    try {
      pick(await placeDetails(placeId));
    } catch {
      setError("Couldn't get that location. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function useCurrent() {
    setBusy(true);
    setError(null);
    try {
      const place = await currentPlace();
      if (!place) {
        setError('Location permission denied or unavailable. Search instead.');
        return;
      }
      pick(place);
    } catch {
      setError("Couldn't get your location. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  const showRecent = query.trim().length < 3 && recent.length > 0;

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <View className="px-4 pt-2 pb-2 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="w-10 h-10 -ml-2 items-center justify-center active:opacity-60"
        >
          <X color={colors.text} size={22} />
        </Pressable>
        <Text className="text-text text-base font-semibold">
          {field === 'dest' ? 'Set destination' : 'Set pickup'}
        </Text>
      </View>

      <View className="px-6 pt-2 gap-3">
        <Input
          placeholder="Search a place"
          autoFocus
          value={query}
          onChangeText={(t) => {
            setQuery(t);
            setError(null);
          }}
        />
        <Pressable
          onPress={useCurrent}
          accessibilityRole="button"
          className="flex-row items-center gap-2 py-2 active:opacity-60"
        >
          <LocateFixed color={colors.accent} size={18} />
          <Text className="text-accent text-sm font-medium">Use current location</Text>
        </Pressable>
        {error ? <Text className="text-danger text-sm">{error}</Text> : null}
      </View>

      {busy ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : showRecent ? (
        <View className="px-6 pt-2 flex-1">
          <Text className="text-muted text-xs mb-1">Recent</Text>
          {recent.map((p) => (
            <Pressable
              key={p.label}
              onPress={() => pick(p)}
              accessibilityRole="button"
              className="flex-row items-center gap-3 py-3 border-b border-surface2 active:opacity-60"
            >
              <Clock color={colors.muted} size={18} />
              <Text className="text-text text-sm flex-1" numberOfLines={1}>
                {p.label}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <FlatList
          data={suggestions}
          keyExtractor={(s) => s.placeId}
          keyboardShouldPersistTaps="handled"
          contentContainerClassName="px-6 pt-2"
          renderItem={({ item }) => (
            <Pressable
              onPress={() => choose(item.placeId)}
              accessibilityRole="button"
              className="flex-row items-center gap-3 py-3 border-b border-surface2 active:opacity-60"
            >
              <MapPin color={colors.muted} size={18} />
              <Text className="text-text text-sm flex-1">{item.label}</Text>
            </Pressable>
          )}
          ListEmptyComponent={
            query.trim().length >= 3 ? (
              <Text className="text-muted text-sm text-center pt-6">
                No matches. Check the Maps key is set, or use current location.
              </Text>
            ) : null
          }
        />
      )}
    </SafeAreaView>
  );
}
