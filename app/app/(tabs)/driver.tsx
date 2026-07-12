import { useCallback, useState } from 'react';
import { View, Text } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car, Clock } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { MapPreview } from '../../components/MapPreview';
import { useSession } from '../../store/session';
import { getDriverStatus, type DriverStatus } from '../../lib/driver';
import { getMyActiveToken, cancelRideToken, type RideToken } from '../../lib/rides';
import { decodeRoute } from '../../lib/maps';
import { formatDepart } from '../../lib/format';

export default function Driver() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [token, setToken] = useState<RideToken | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    const [d, t] = await Promise.all([
      getDriverStatus(profile.id),
      profile.is_driver_verified ? getMyActiveToken(profile.id) : Promise.resolve(null),
    ]);
    setStatus(d.status);
    setToken(t);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refreshProfile().then(() => {
        if (alive) load();
      });
      return () => {
        alive = false;
      };
    }, [load, refreshProfile])
  );

  async function onCancel() {
    if (!token) return;
    setBusy(true);
    try {
      await cancelRideToken(token.id);
      setToken(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScreenHeader title="Driver" subtitle="Offer a ride" />

      {!profile?.is_driver_verified ? (
        <View className="flex-1 justify-center">
          {status === 'pending' ? (
            <EmptyState
              icon={Clock}
              title="Licence under review"
              description="We'll unlock the Driver tab once you're approved — usually within a few hours."
            />
          ) : (
            <EmptyState
              icon={Car}
              title="Verify your licence to offer rides"
              description="Drivers are licence-checked so every ride stays safe."
              actionLabel="Become a driver"
              onAction={() => router.push('/profile/become-driver')}
            />
          )}
        </View>
      ) : token ? (
        <View className="flex-1 px-6 pt-2">
          <ActiveTokenCard token={token} onCancel={onCancel} busy={busy} />
        </View>
      ) : (
        <View className="flex-1 justify-center px-6 gap-6">
          <EmptyState
            icon={Car}
            title="No live ride"
            description="Post a ride and it stays live until a passenger matches or it departs."
          />
          <Button label="Post a ride" onPress={() => router.push('/ride/post')} />
        </View>
      )}
    </SafeAreaView>
  );
}

function ActiveTokenCard({
  token,
  onCancel,
  busy,
}: {
  token: RideToken;
  onCancel: () => void;
  busy: boolean;
}) {
  const path = decodeRoute(token.route_polyline);
  const a = path[0];
  const b = path[path.length - 1];
  const region = {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.6 + 0.02,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.6 + 0.02,
  };

  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Badge label="● LIVE" tone="success" />
        <Text className="text-text text-base font-bold tabular-nums">₹{token.price_per_seat}/seat</Text>
      </View>

      <MapPreview region={region} path={path} markers={[a, b]} height={140} />

      <View className="gap-1">
        <Text className="text-text text-base" numberOfLines={1}>
          {token.origin_label}
        </Text>
        <Text className="text-muted text-xs">to</Text>
        <Text className="text-text text-base" numberOfLines={1}>
          {token.dest_label}
        </Text>
      </View>

      <View className="flex-row justify-between">
        <Info label="Departs" value={formatDepart(token.depart_at)} />
        <Info label="Seats left" value={`${token.seats_left}/${token.seats_total}`} />
      </View>

      <Button label="Cancel ride" variant="secondary" loading={busy} onPress={onCancel} />
    </Card>
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
