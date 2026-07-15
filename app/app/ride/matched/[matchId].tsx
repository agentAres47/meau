import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { ShieldCheck } from 'lucide-react-native';
import { colors, motion } from '../../../theme/tokens';
import { Avatar } from '../../../components/Avatar';
import { Badge } from '../../../components/Badge';
import { Button } from '../../../components/Button';
import { Card } from '../../../components/Card';
import { MapPreview } from '../../../components/MapPreview';
import { VehicleSeats } from '../../../components/VehicleSeats';
import { getMatchStatus, cancelMatch, type MatchStatus } from '../../../lib/match';
import { subscribeRequest } from '../../../lib/passenger';
import { decodeRoute } from '../../../lib/maps';
import { formatDepart } from '../../../lib/format';
import { useReducedMotion } from '../../../lib/reducedMotion';

// Shared by both sides of a match so driver + passenger see the exact same
// "we're on the same page" screen: each other's info, the route, a seat
// map, and Message/Cancel. Cancelling disbands only THIS match (other
// passengers matched to the same driver token, if any, are unaffected) and
// gives the driver's seat back (cancel_match RPC).
export default function MatchedRide() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const [status, setStatus] = useState<MatchStatus | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Signature match-moment entrance (11-UI-DESIGN.md) — a quiet spring/fade
  // on the "you matched" block, once, on mount. Everything else on this
  // screen stays still; this is the one deliberate beat. Uses the shared
  // no-overshoot spring so it reads as premium, not playful.
  const reducedMotion = useReducedMotion();
  const entrance = useSharedValue(0);
  useEffect(() => {
    entrance.value = reducedMotion ? 1 : withSpring(1, motion.spring);
  }, [reducedMotion, entrance]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: entrance.value,
    transform: [{ scale: 0.85 + entrance.value * 0.15 }],
  }));

  const load = useCallback(async () => {
    if (!matchId) return;
    const s = await getMatchStatus(matchId);
    setStatus(s);
  }, [matchId]);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: if the OTHER side cancels while we're both looking at this
  // screen, we should leave too instead of sitting on a dead match.
  useEffect(() => {
    if (!status?.ride_request_id) return;
    return subscribeRequest(status.ride_request_id, load);
  }, [status?.ride_request_id, load]);

  useEffect(() => {
    if (status && status.request_status !== 'matched') {
      router.replace(status.my_role === 'driver' ? '/(tabs)/driver' : '/(tabs)/passenger');
    }
  }, [status]);

  async function onCancel() {
    if (!matchId || !status) return;
    setBusy(true);
    setError(null);
    try {
      await cancelMatch(matchId);
      router.replace(status.my_role === 'driver' ? '/(tabs)/driver' : '/(tabs)/passenger');
    } catch {
      setError('Could not cancel. Try again.');
      setBusy(false);
    }
  }

  if (status === undefined) {
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (!status) {
    return (
      <Screen className="items-center justify-center px-6" edges={['top']}>
        <Text className="text-muted text-sm text-center">Couldn't load this ride.</Text>
        <Button
          label="Back"
          variant="secondary"
          className="mt-4"
          onPress={() => router.replace('/(tabs)/passenger')}
        />
      </Screen>
    );
  }

  if (status.request_status !== 'matched') {
    // Already cancelled/expired -- the effect above is redirecting us away.
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const path = status.route_polyline ? decodeRoute(status.route_polyline) : [];
  const pickup =
    status.pickup_lat != null && status.pickup_lng != null
      ? { latitude: status.pickup_lat, longitude: status.pickup_lng }
      : path[0];
  const drop =
    status.drop_lat != null && status.drop_lng != null
      ? { latitude: status.drop_lat, longitude: status.drop_lng }
      : path[path.length - 1];
  const region =
    pickup && drop
      ? {
          latitude: (pickup.latitude + drop.latitude) / 2,
          longitude: (pickup.longitude + drop.longitude) / 2,
          latitudeDelta: Math.abs(pickup.latitude - drop.latitude) * 1.6 + 0.02,
          longitudeDelta: Math.abs(pickup.longitude - drop.longitude) * 1.6 + 0.02,
        }
      : undefined;

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView contentContainerClassName="px-6 pt-4 pb-6 gap-4">
        <Animated.View style={entranceStyle} className="items-center gap-2">
          <Badge label="MATCHED" tone="success" />
          <Avatar name={status.other_name || 'Rider'} uri={status.other_photo} size={64} />
          <View className="flex-row items-center gap-1.5">
            <Text className="text-text text-lg font-bold">
              {status.other_name || (status.other_role === 'driver' ? 'Your driver' : 'Your passenger')}
            </Text>
            <ShieldCheck color={colors.success} size={16} />
          </View>
          <Text className="text-muted text-xs capitalize">{status.other_role}</Text>
        </Animated.View>

        {region ? (
          <MapPreview
            region={region}
            path={path}
            markers={[pickup, drop].filter(Boolean) as { latitude: number; longitude: number }[]}
            height={160}
          />
        ) : null}

        <Card className="gap-1">
          <Text className="text-text text-sm" numberOfLines={1}>
            {status.pickup_label ?? status.origin_label}
          </Text>
          <Text className="text-muted text-xs">to</Text>
          <Text className="text-text text-sm" numberOfLines={1}>
            {status.drop_label ?? status.dest_label}
          </Text>
          <View className="flex-row justify-between mt-2">
            <Text className="text-muted text-xs">{status.depart_at ? formatDepart(status.depart_at) : ''}</Text>
            <Text className="text-text text-sm font-semibold tabular-nums">₹{status.price_per_seat}/seat</Text>
          </View>
        </Card>

        {status.vehicle_type ? (
          <Card>
            <VehicleSeats
              vehicleType={status.vehicle_type}
              seatsTotal={status.vehicle_seats_total ?? 1}
              seatsOccupied={status.seats_occupied}
              mySeatIndex={status.my_role === 'passenger' ? status.my_seat_index : null}
            />
          </Card>
        ) : null}

        {error ? <Text className="text-danger text-sm text-center">{error}</Text> : null}

        <Button label="Message" onPress={() => router.push(`/match/${matchId}`)} />
        <Button label="Cancel ride" variant="secondary" loading={busy} onPress={onCancel} />
      </ScrollView>
    </Screen>
  );
}
