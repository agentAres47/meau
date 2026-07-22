import { useState } from 'react';
import { View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { Star } from 'lucide-react-native';
import { colors } from '../../../theme/tokens';
import { Button } from '../../../components/Button';
import { Input } from '../../../components/Input';
import { submitRating, type Sentiment } from '../../../lib/match';
import { matchHaptic } from '../../../lib/haptics';

// F8 feedback flow — PRODUCT_MEMORY: ask sentiment BEFORE stars, and only ask
// for a written note on the negative path. We want genuine feedback more than
// ratings, so a rating is never required to move on ("Skip" always works).
const SENTIMENTS: { value: Sentiment; emoji: string; label: string }[] = [
  { value: 'smooth', emoji: '😊', label: 'Yes' },
  { value: 'mostly', emoji: '😐', label: 'Mostly' },
  { value: 'not_smooth', emoji: '😞', label: 'Not really' },
];

export default function RateRide() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [sentiment, setSentiment] = useState<Sentiment | null>(null);
  const [stars, setStars] = useState(0);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  function done() {
    router.replace('/(tabs)/passenger');
  }

  async function submit() {
    if (!matchId || !sentiment) return;
    setBusy(true);
    try {
      await submitRating({
        matchId,
        sentiment,
        stars: sentiment !== 'not_smooth' && stars > 0 ? stars : null,
        note: sentiment === 'not_smooth' ? note : null,
      });
      matchHaptic();
      done();
    } catch {
      done(); // feedback is best-effort; never block the user from moving on
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1 items-center justify-center px-6"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
      {!sentiment ? (
        <View className="items-center gap-8 w-full">
          <View className="items-center gap-1">
            <Text className="text-text text-lg font-bold">Ride complete</Text>
            <Text className="text-muted text-sm">Did everything go smoothly?</Text>
          </View>
          <View className="flex-row gap-4">
            {SENTIMENTS.map((s) => (
              <Pressable
                key={s.value}
                onPress={() => setSentiment(s.value)}
                accessibilityRole="button"
                className="items-center gap-2 active:opacity-70"
              >
                <Text style={{ fontSize: 40 }}>{s.emoji}</Text>
                <Text className="text-muted text-xs">{s.label}</Text>
              </Pressable>
            ))}
          </View>
          <Button label="Skip" variant="ghost" onPress={done} />
        </View>
      ) : sentiment === 'not_smooth' ? (
        <View className="w-full gap-4">
          <Text className="text-text text-lg font-bold text-center">What went wrong?</Text>
          <Input
            placeholder="Tell us what happened (optional)"
            value={note}
            onChangeText={setNote}
            multiline
          />
          <Button label="Send" loading={busy} onPress={submit} />
          <Button label="Skip" variant="ghost" onPress={done} />
        </View>
      ) : (
        <View className="items-center gap-6 w-full">
          <Text className="text-text text-lg font-bold">Rate your ride</Text>
          <View className="flex-row gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable key={n} onPress={() => setStars(n)} accessibilityRole="button">
                <Star
                  color={colors.accent}
                  fill={n <= stars ? colors.accent : 'none'}
                  size={36}
                />
              </Pressable>
            ))}
          </View>
          <Button label="Submit" loading={busy} disabled={stars === 0} onPress={submit} />
          <Button label="Skip" variant="ghost" onPress={done} />
        </View>
      )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
