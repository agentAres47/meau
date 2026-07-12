import { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Circle, MapPin, Clock } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { PlaceRow } from '../../components/PlaceRow';
import { PriceSlider } from '../../components/PriceSlider';
import { useSession } from '../../store/session';
import { useRideDraft } from '../../store/rideDraft';
import { useSearch } from '../../store/search';
import { getRoute, suggestedPrice } from '../../lib/maps';
import { createRideRequest, matchRides } from '../../lib/passenger';
import { formatDepart } from '../../lib/format';

export default function Passenger() {
  const profile = useSession((s) => s.profile);
  const { origin: pickup, dest: drop, reset } = useRideDraft();
  const setResults = useSearch((s) => s.setResults);

  const [now, setNow] = useState(true);
  const [when, setWhen] = useState(() => new Date(Date.now() + 10 * 60_000));
  const [offer, setOffer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Suggest a fair offer from the route distance once both ends are set.
  useEffect(() => {
    if (pickup && drop) getRoute(pickup, drop).then((r) => setOffer(suggestedPrice(r.distanceKm)));
  }, [pickup, drop]);

  function pickWhen() {
    DateTimePickerAndroid.open({
      value: when,
      mode: 'date',
      minimumDate: new Date(),
      onChange: (e, d) => {
        if (e.type !== 'set' || !d) return;
        DateTimePickerAndroid.open({
          value: d,
          mode: 'time',
          onChange: (e2, t) => {
            if (e2.type !== 'set' || !t) return;
            const c = new Date(d);
            c.setHours(t.getHours(), t.getMinutes(), 0, 0);
            setWhen(c);
            setNow(false);
          },
        });
      },
    });
  }

  async function findRides() {
    setError(null);
    if (!pickup || !drop) return setError('Set your pickup and drop.');
    setLoading(true);
    try {
      const desiredTime = now ? new Date() : when;
      const requestId = await createRideRequest({
        passengerId: profile!.id,
        pickup,
        drop,
        desiredTime,
        offeredPrice: offer,
      });
      const matches = await matchRides(requestId);
      setResults({ requestId, pickup, drop, matches });
      router.push('/ride/search-results');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScreenHeader title={(profile?.full_name ?? 'Rider').split(' ')[0]} subtitle="Find a ride" />
      <ScrollView contentContainerClassName="px-6 pt-2 pb-4 gap-5" keyboardShouldPersistTaps="handled">
        <Card className="gap-3">
          <PlaceRow
            icon={<Circle color={colors.accent} size={14} />}
            label="Pickup"
            value={pickup?.label}
            onPress={() => router.push('/modal/location-picker?field=origin')}
          />
          <View className="h-px bg-surface2 ml-7" />
          <PlaceRow
            icon={<MapPin color={colors.success} size={16} />}
            label="Drop"
            value={drop?.label}
            onPress={() => router.push('/modal/location-picker?field=dest')}
          />
        </Card>

        <View className="gap-2">
          <Text className="text-sm text-muted">When</Text>
          <View className="flex-row items-center gap-2">
            <Chip label="Now" selected={now} onPress={() => setNow(true)} />
            <Pressable onPress={pickWhen} accessibilityRole="button" className="flex-1">
              <View
                className={`flex-row items-center gap-2 rounded-full px-4 py-2 border ${
                  !now ? 'bg-accent border-accent' : 'bg-surface2 border-surface2'
                }`}
              >
                <Clock color={now ? colors.text : colors.bg} size={16} />
                <Text className={`text-sm font-medium ${now ? 'text-text' : 'text-bg'}`}>
                  {now ? 'Pick a time' : formatDepart(when)}
                </Text>
              </View>
            </Pressable>
          </View>
        </View>

        <Card>
          <Text className="text-muted text-sm mb-2">Your offer per seat</Text>
          <PriceSlider value={offer} onChange={setOffer} />
        </Card>

        {error ? <Text className="text-danger text-sm">{error}</Text> : null}

        <Button label="Find rides" loading={loading} onPress={findRides} />
      </ScrollView>
    </SafeAreaView>
  );
}
