import { View, Text, Pressable } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { BadgeCheck, Route, Check } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { Card } from './Card';
import { Badge } from './Badge';
import { Avatar } from './Avatar';
import { formatDepart } from '../lib/format';
import type { Match } from '../lib/passenger';

type Props = {
  match: Match;
  offer: number;
  selected: boolean;
  onToggle: () => void;
  // Position in the list — drives the stagger, so the results arrive as a
  // sequence rather than a block appearing at once.
  index: number;
};

// A matched ride, as it appears in the passenger home's bottom sheet.
//
// Deliberately no per-card map preview: the full-screen map behind the sheet
// IS the preview, and it redraws to the selected driver's route on tap. One
// map showing the thing you're looking at beats N thumbnails competing with
// it — and it keeps a single MapView on screen instead of one per card.
export function MatchCard({ match, offer, selected, onToggle, index }: Props) {
  return (
    <Animated.View entering={FadeInDown.springify().damping(20).delay(index * 70)}>
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

          {/* Selection affordance — F3 batches the request across every selected
              driver via the sheet's bottom CTA. */}
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
    </Animated.View>
  );
}
