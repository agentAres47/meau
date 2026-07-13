import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { Card } from './Card';
import { Avatar } from './Avatar';
import type { MatchedPassenger } from '../lib/requests';

export function MatchedPassengers({ passengers }: { passengers: MatchedPassenger[] }) {
  if (passengers.length === 0) return null;

  return (
    <View className="gap-3">
      <Text className="text-text text-base font-semibold">Matched passengers</Text>
      {passengers.map((m) => (
        <Pressable
          key={m.match_id}
          onPress={() => router.push(`/ride/matched/${m.match_id}`)}
          accessibilityRole="button"
        >
          <Card className="gap-2">
            <View className="flex-row items-center gap-3">
              <Avatar name={m.passenger_name || 'Passenger'} uri={m.passenger_photo} size={36} />
              <Text className="text-text text-sm font-semibold flex-1" numberOfLines={1}>
                {m.passenger_name || 'Passenger'}
              </Text>
              <Text className="text-text text-sm font-bold tabular-nums">₹{m.offered_price}</Text>
            </View>
            <View className="flex-row items-center gap-2">
              <Text className="text-muted text-xs flex-1" numberOfLines={1}>
                {m.pickup_label}
              </Text>
              <ArrowRight color={colors.muted} size={12} />
              <Text className="text-muted text-xs flex-1 text-right" numberOfLines={1}>
                {m.drop_label}
              </Text>
            </View>
          </Card>
        </Pressable>
      ))}
    </View>
  );
}
