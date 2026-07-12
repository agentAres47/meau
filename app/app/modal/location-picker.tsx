import { useEffect, useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, FlatList } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, MapPin, LocateFixed } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Input } from '../../components/Input';
import { useRideDraft } from '../../store/rideDraft';
import {
  placesAutocomplete,
  placeDetails,
  currentPlace,
  type Suggestion,
} from '../../lib/maps';

export default function LocationPicker() {
  const { field } = useLocalSearchParams<{ field: 'origin' | 'dest' }>();
  const setPlace = useRideDraft((s) => s.setPlace);

  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [busy, setBusy] = useState(false);

  // Debounced autocomplete.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 3) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      placesAutocomplete(q).then(setSuggestions);
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  async function choose(placeId: string) {
    setBusy(true);
    const place = await placeDetails(placeId);
    setBusy(false);
    if (place && field) {
      setPlace(field, place);
      router.back();
    }
  }

  async function useCurrent() {
    setBusy(true);
    const place = await currentPlace();
    setBusy(false);
    if (place && field) {
      setPlace(field, place);
      router.back();
    }
  }

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
          onChangeText={setQuery}
        />
        <Pressable
          onPress={useCurrent}
          accessibilityRole="button"
          className="flex-row items-center gap-2 py-2 active:opacity-60"
        >
          <LocateFixed color={colors.accent} size={18} />
          <Text className="text-accent text-sm font-medium">Use current location</Text>
        </Pressable>
      </View>

      {busy ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={colors.accent} />
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
