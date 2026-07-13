import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect, Redirect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Circle, MapPin, Clock, CheckCircle2 } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Avatar } from '../../components/Avatar';
import { PlaceRow } from '../../components/PlaceRow';
import { PriceSlider } from '../../components/PriceSlider';
import { useSession } from '../../store/session';
import { useRideDraft } from '../../store/rideDraft';
import { useSearch } from '../../store/search';
import { getRoute, suggestedPrice } from '../../lib/maps';
import {
  createRideRequest,
  matchRides,
  getActiveRequest,
  endRide,
  getDriverProfile,
  getMatchId,
  type ActiveRequest,
  type MatchedDriver,
} from '../../lib/passenger';
import { formatDepart } from '../../lib/format';

export default function Passenger() {
  const profile = useSession((s) => s.profile);
  const [active, setActive] = useState<ActiveRequest | null | undefined>(undefined);
  const [driver, setDriver] = useState<MatchedDriver | null>(null);
  const [matchId, setMatchId] = useState<string | null>(null);

  const loadActive = useCallback(async () => {
    if (!profile) return;
    const a = await getActiveRequest(profile.id);
    setActive(a);
    if (a?.status === 'matched' && a.matched_driver_id) {
      setDriver(await getDriverProfile(a.matched_driver_id));
      setMatchId(await getMatchId(a.id));
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadActive();
    }, [loadActive])
  );

  if (active === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-bg items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  // Mid-search → waiting screen (also gates re-requesting).
  if (active?.status === 'searching') {
    return <Redirect href={`/ride/waiting?rid=${active.id}`} />;
  }

  if (active?.status === 'matched') {
    return (
      <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
        <ScreenHeader title={(profile?.full_name ?? 'Rider').split(' ')[0]} subtitle="Your ride" />
        <View className="flex-1 justify-center px-6">
          <Card className="items-center gap-4 py-8">
            <CheckCircle2 color={colors.success} size={40} />
            <Text className="text-text text-lg font-bold">You're matched</Text>
            <Avatar name={driver?.full_name || 'Driver'} uri={driver?.photo_url} size={64} />
            <Text className="text-text text-base font-semibold">{driver?.full_name || 'Your driver'}</Text>
            <Text className="text-muted text-sm text-center">
              Message your driver to sort out the pickup. End the ride to search again.
            </Text>
            {matchId ? (
              <Button
                label="Open chat"
                className="w-full"
                onPress={() => router.push(`/match/${matchId}`)}
              />
            ) : null}
            <Button
              label="End ride"
              variant="secondary"
              className="w-full"
              onPress={async () => {
                if (profile) await endRide(profile.id);
                setActive(null);
                setDriver(null);
                setMatchId(null);
              }}
            />
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  return <SearchForm />;
}

function SearchForm() {
  const profile = useSession((s) => s.profile);
  const { origin: pickup, dest: drop, reset } = useRideDraft();
  const setResults = useSearch((s) => s.setResults);

  const [now, setNow] = useState(true);
  const [when, setWhen] = useState(() => new Date(Date.now() + 10 * 60_000));
  const [offer, setOffer] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset once on mount only — NOT on every focus. The location-picker modal
  // returns focus to this same (still-mounted) screen when it closes, and a
  // focus-effect reset here would wipe the just-picked location right back out.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      setResults({ requestId, pickup, drop, offer, matches });
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
          <Text className="text-muted text-sm mb-1">Your offer per seat</Text>
          <Text className="text-muted text-xs mb-2">What you'll pay for your part of the trip.</Text>
          <PriceSlider value={offer} onChange={setOffer} />
        </Card>

        {error ? <Text className="text-danger text-sm">{error}</Text> : null}

        <Button label="Find rides" loading={loading} onPress={findRides} />
      </ScrollView>
    </SafeAreaView>
  );
}
