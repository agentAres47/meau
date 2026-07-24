import { useCallback, useEffect, useState } from 'react';
import { View, Text, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Screen } from '../../../components/Screen';
import { ScreenHeader } from '../../../components/ScreenHeader';
import { Avatar } from '../../../components/Avatar';
import { Card } from '../../../components/Card';
import { Button } from '../../../components/Button';
import { MapPreview } from '../../../components/MapPreview';
import { colors } from '../../../theme/tokens';
import { useSession } from '../../../store/session';
import { getIncomingDetail, acceptRequest, declineTarget, type IncomingDetail } from '../../../lib/requests';
import { decodeRoute, getEta, type Eta } from '../../../lib/maps';
import { formatDepart, formatEta } from '../../../lib/format';
import { matchHaptic } from '../../../lib/haptics';

// Dedicated decision screen a request push opens into (BUG 1). Minimal: reuses
// existing components + accept/decline logic. Shows the driver-origin→pickup
// ETA (F1) so the driver can judge the detour before accepting.
export default function RideRequest() {
  const { requestId } = useLocalSearchParams<{ requestId: string }>();
  const profile = useSession((s) => s.profile);
  const [detail, setDetail] = useState<IncomingDetail | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!requestId) return;
    setDetail(await getIncomingDetail(requestId));
  }, [requestId]);

  useEffect(() => {
    load();
  }, [load]);

  // F1 — driver-origin (route start) → pickup ETA, computed once on load.
  const [eta, setEta] = useState<Eta | null>(null);
  useEffect(() => {
    if (!detail?.route_polyline) return;
    const origin = decodeRoute(detail.route_polyline)[0];
    if (!origin) return;
    let alive = true;
    getEta(origin, { latitude: detail.pickup_lat, longitude: detail.pickup_lng }).then((e) => {
      if (alive) setEta(e);
    });
    return () => {
      alive = false;
    };
  }, [detail?.route_polyline, detail?.pickup_lat, detail?.pickup_lng]);

  async function onAccept() {
    if (!detail || !profile) return;
    setBusy(true);
    setError(null);
    try {
      const matchId = await acceptRequest({
        requestId: requestId!,
        tokenId: detail.token_id,
        driverId: profile.id,
      });
      matchHaptic();
      router.replace(`/ride/matched/${matchId}`);
    } catch {
      setError('That request was already taken.');
      setBusy(false);
    }
  }

  async function onDecline() {
    if (!detail) return;
    setBusy(true);
    setError(null);
    try {
      await declineTarget(detail.target_id);
      router.dismissTo('/(tabs)/driver');
    } catch {
      setError('Could not decline. Try again.');
      setBusy(false);
    }
  }

  if (detail === undefined) {
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // No longer pending (accepted elsewhere / cancelled / not ours).
  if (!detail) {
    return (
      <Screen edges={['top']}>
        <ScreenHeader title="Ride request" />
        <View className="flex-1 items-center justify-center px-6 gap-4">
          <Text className="text-muted text-sm text-center">
            This request is no longer available.
          </Text>
          <Button label="Back" variant="secondary" onPress={() => router.dismissTo('/(tabs)/driver')} />
        </View>
      </Screen>
    );
  }

  const path = detail.route_polyline ? decodeRoute(detail.route_polyline) : [];
  const pickup = { latitude: detail.pickup_lat, longitude: detail.pickup_lng };
  const drop = { latitude: detail.drop_lat, longitude: detail.drop_lng };
  const region = {
    latitude: (pickup.latitude + drop.latitude) / 2,
    longitude: (pickup.longitude + drop.longitude) / 2,
    latitudeDelta: Math.abs(pickup.latitude - drop.latitude) * 1.6 + 0.02,
    longitudeDelta: Math.abs(pickup.longitude - drop.longitude) * 1.6 + 0.02,
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <ScreenHeader title="Ride request" subtitle="Accept or decline" />
      <View className="flex-1 px-6 pt-2 gap-4">
        <Card className="items-center gap-2">
          <Avatar name={detail.passenger_name || 'Passenger'} uri={detail.passenger_photo} size={64} />
          <Text className="text-text text-lg font-bold">{detail.passenger_name || 'Passenger'}</Text>
        </Card>

        <MapPreview region={region} path={path} markers={[pickup, drop]} height={150} />

        <Card className="gap-1">
          <Text className="text-text text-sm" numberOfLines={1}>{detail.pickup_label}</Text>
          <Text className="text-muted text-xs">to</Text>
          <Text className="text-text text-sm" numberOfLines={1}>{detail.drop_label}</Text>
          {eta ? (
            <Text className="text-accent text-xs font-medium mt-1">
              Pickup in {formatEta(eta.seconds, eta.meters)}
            </Text>
          ) : null}
          <View className="flex-row justify-between mt-2">
            <Info label="Departs" value={formatDepart(detail.depart_at)} />
            <Info label="Fare" value={`₹${detail.offered_price}`} />
          </View>
        </Card>

        {error ? <Text className="text-danger text-sm text-center">{error}</Text> : null}

        <View className="flex-1 justify-end gap-3 pb-2">
          <Button label="Accept" loading={busy} onPress={onAccept} />
          <Button label="Decline" variant="secondary" disabled={busy} onPress={onDecline} />
        </View>
      </View>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-muted text-xs">{label}</Text>
      <Text className="text-text text-sm font-medium tabular-nums">{value}</Text>
    </View>
  );
}
