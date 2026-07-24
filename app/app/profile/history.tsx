import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { ChevronLeft, History as HistoryIcon, XCircle } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Skeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import { Avatar } from '../../components/Avatar';
import { getRideHistory, type HistoryEntry } from '../../lib/match';
import { PRESET_ROUTES } from '../../lib/autopool';
import { formatDepart } from '../../lib/format';

// Autopool has no per-ride origin/dest/fare row (see 0021's my_ride_history
// comment) — resolve the same way the autopool chat header already does.
function autopoolDisplay(h: HistoryEntry): { label: string; fare: number | null } {
  const route = PRESET_ROUTES.find((r) => r.code === h.route_code);
  if (!route) return { label: 'Auto Pool ride', fare: null };
  return { label: route.label, fare: Math.round(route.typicalFare / Math.max(h.pool_size, 1)) };
}

// F8 — past rides. Completed + cancelled, newest first. Read-only list; rating
// happens from the matched-ride screen right after a ride ends, not from here.
export default function RideHistory() {
  const [items, setItems] = useState<HistoryEntry[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      getRideHistory().then((h) => alive && setItems(h));
      return () => {
        alive = false;
      };
    }, [])
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="px-4 pt-2 pb-2 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="w-10 h-10 -ml-2 items-center justify-center active:opacity-60"
        >
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <Text className="text-text text-base font-semibold">Ride history</Text>
      </View>

      {items === null ? (
        <View className="px-6 pt-2 gap-3">
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
          <Skeleton height={84} radius={16} />
        </View>
      ) : items.length === 0 ? (
        <View className="flex-1 justify-center">
          <EmptyState
            icon={HistoryIcon}
            title="No rides yet"
            description="Your completed and cancelled rides will show up here."
          />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-6 pt-2 pb-8 gap-3">
          {items.map((h) => {
            const auto = h.kind === 'autopool' ? autopoolDisplay(h) : null;
            const fare = auto ? auto.fare : h.fare;
            return (
              <Card key={h.match_id} className="flex-row items-center gap-3">
                <Avatar name={h.other_name || 'Rider'} uri={h.other_photo} size={40} />
                <View className="flex-1">
                  <Text className="text-text text-sm font-semibold" numberOfLines={1}>
                    {auto ? auto.label : `${h.origin_label} → ${h.dest_label}`}
                  </Text>
                  <Text className="text-muted text-xs">{formatDepart(h.when_at)}</Text>
                </View>
                <View className="items-end gap-1">
                  {!h.completed ? (
                    <View className="flex-row items-center gap-1">
                      <XCircle color={colors.danger} size={14} />
                      <Text className="text-muted text-[11px]">Cancelled</Text>
                    </View>
                  ) : null}
                  {fare != null ? (
                    <Text className="text-text text-xs font-medium tabular-nums">₹{fare}</Text>
                  ) : null}
                </View>
              </Card>
            );
          })}
        </ScrollView>
      )}
    </Screen>
  );
}
