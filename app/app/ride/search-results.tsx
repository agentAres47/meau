import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { ChevronLeft, Search, BadgeCheck, Route, Check } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Avatar } from '../../components/Avatar';
import { MapPreview } from '../../components/MapPreview';
import { EmptyState } from '../../components/EmptyState';
import { useSearch } from '../../store/search';
import { decodeRoute, type Place } from '../../lib/maps';
import { requestDrivers, cancelRequest, type Match } from '../../lib/passenger';
import { formatDepart } from '../../lib/format';

export default function SearchResults() {
  const { requestId, pickup, drop, offer, matches } = useSearch();
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  function toggle(tokenId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  }

  // F3 — fan out to every selected driver at once; the first to accept wins and
  // the rest auto-void (accept_ride_request dismisses sibling targets, and F7
  // push cancels the losers' notifications).
  async function requestSelected() {
    if (!requestId || selected.size === 0) return;
    setBusy(true);
    try {
      await requestDrivers(requestId, [...selected]);
      router.push(`/ride/waiting?rid=${requestId}&n=${selected.size}`);
    } catch {
      // keep the selection; user can retry
    } finally {
      setBusy(false);
    }
  }

  // Leaving without requesting any driver would otherwise strand the
  // ride_requests row in 'searching' forever — the passenger tab's active-
  // request gate would then redirect straight back into "Finding your
  // ride..." with no way out. Cancel it first, then dismissTo (not back()) so
  // this is safe even if we got here via a Redirect that ate history, and
  // cleanly unwinds the `ride` stack instead of leaving it to resurface.
  async function backToSearch() {
    if (requestId) await cancelRequest(requestId);
    router.dismissTo('/(tabs)/passenger');
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="px-4 pt-2 pb-2 flex-row items-center">
        <Pressable
          onPress={backToSearch}
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
            onAction={backToSearch}
          />
        </View>
      ) : (
        <>
          <Text className="text-muted text-xs px-6 pb-1">
            Select one or more drivers — the first to accept gets you.
          </Text>
          <ScrollView contentContainerClassName="px-6 pt-1 pb-6 gap-4">
            {matches.map((m) => (
              <MatchCard
                key={m.token_id}
                match={m}
                pickup={pickup}
                drop={drop}
                offer={offer}
                selected={selected.has(m.token_id)}
                onToggle={() => toggle(m.token_id)}
              />
            ))}
          </ScrollView>
          {selected.size > 0 ? (
            <View className="px-6 pt-2 pb-2 border-t border-surface2">
              <Button
                label={`Request ${selected.size} driver${selected.size > 1 ? 's' : ''}`}
                loading={busy}
                onPress={requestSelected}
              />
            </View>
          ) : null}
        </>
      )}
    </Screen>
  );
}

function MatchCard({
  match,
  pickup,
  drop,
  offer,
  selected,
  onToggle,
}: {
  match: Match;
  pickup: Place | null;
  drop: Place | null;
  offer: number;
  selected: boolean;
  onToggle: () => void;
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
    <Pressable
      onPress={onToggle}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className="active:opacity-90"
    >
    <Card className={`gap-3 border ${selected ? 'border-accent' : 'border-transparent'}`}>
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

      {/* Selection affordance (replaces the old per-card Request button — F3
          batches the request across every selected driver via the bottom CTA). */}
      <View
        className={`flex-row items-center justify-center gap-1.5 rounded-full py-2 ${
          selected ? 'bg-accent' : 'bg-surface2'
        }`}
      >
        {selected ? <Check color={colors.bg} size={16} /> : null}
        <Text className={`text-sm font-medium ${selected ? 'text-bg' : 'text-muted'}`}>
          {selected ? 'Selected' : 'Tap to select'}
        </Text>
      </View>
    </Card>
    </Pressable>
  );
}
