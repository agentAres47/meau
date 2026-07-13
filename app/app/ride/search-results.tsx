import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, Search, BadgeCheck, Route } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { MapPreview } from '../../components/MapPreview';
import { EmptyState } from '../../components/EmptyState';
import { useSearch } from '../../store/search';
import { decodeRoute, type Place } from '../../lib/maps';
import { requestDrivers, type Match } from '../../lib/passenger';
import { formatDepart } from '../../lib/format';

export default function SearchResults() {
  const { requestId, pickup, drop, offer, matches } = useSearch();
  const [busy, setBusy] = useState<string | null>(null);

  async function request(tokenId: string) {
    if (!requestId) return;
    setBusy(tokenId);
    try {
      await requestDrivers(requestId, [tokenId]);
      router.push(`/ride/waiting?rid=${requestId}`);
    } catch {
      // keep the button; user can retry
    } finally {
      setBusy(null);
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
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <Text className="text-text text-base font-semibold">
          {matches.length ? `${matches.length} ride${matches.length > 1 ? 's' : ''} your way` : 'Rides'}
        </Text>
      </View>

      {matches.length === 0 ? (
        <View className="flex-1 justify-center">
          <EmptyState
            icon={Search}
            title="No rides your way right now"
            description="No live rides match your route and time. Try a wider time, or check back soon."
            actionLabel="Back to search"
            onAction={() => router.back()}
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-6 pt-2 pb-6 gap-4">
          {matches.map((m) => (
            <MatchCard
              key={m.token_id}
              match={m}
              pickup={pickup}
              drop={drop}
              offer={offer}
              busy={busy === m.token_id}
              onRequest={() => request(m.token_id)}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function MatchCard({
  match,
  pickup,
  drop,
  offer,
  busy,
  onRequest,
}: {
  match: Match;
  pickup: Place | null;
  drop: Place | null;
  offer: number;
  busy: boolean;
  onRequest: () => void;
}) {
  const path = decodeRoute(match.route_polyline);
  const markers = pickup && drop ? [pickup, drop] : [path[0], path[path.length - 1]];
  const a = markers[0];
  const b = markers[markers.length - 1];
  const region = {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.6 + 0.02,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.6 + 0.02,
  };

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Avatar name={match.driver.name || 'Driver'} uri={match.driver.photo} size={40} />
        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            <Text className="text-text text-base font-semibold" numberOfLines={1}>
              {match.driver.name || 'Driver'}
            </Text>
            {match.driver.verified ? <BadgeCheck color={colors.accent} size={16} /> : null}
          </View>
          {match.vehicle.make_model ? (
            <Text className="text-muted text-xs">
              {[match.vehicle.color, match.vehicle.make_model].filter(Boolean).join(' ')}
            </Text>
          ) : null}
        </View>
        <View className="items-end">
          <Text className="text-text text-base font-bold tabular-nums">₹{offer}</Text>
          <Text className="text-muted text-[10px]">you offer</Text>
        </View>
      </View>

      <MapPreview region={region} path={path} markers={markers} height={130} />

      <View className="flex-row items-center gap-2">
        <Route color={colors.success} size={14} />
        <Text className="text-muted text-xs flex-1">
          On your way · {match.detour_m} m detour · driver asks ₹{match.price_per_seat} full
        </Text>
        <Badge label={`${match.seats_left} seat${match.seats_left > 1 ? 's' : ''}`} tone="muted" />
      </View>

      <Text className="text-muted text-xs">
        Departs {formatDepart(match.depart_at)} · {match.time_delta_min} min from your time
      </Text>

      <Button label="Request this ride" loading={busy} onPress={onRequest} />
    </Card>
  );
}
