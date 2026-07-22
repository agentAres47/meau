import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Circle, MapPin } from 'lucide-react-native';
import { Avatar } from './Avatar';
import { PlaceRow } from './PlaceRow';
import { DarkGlass } from './DarkGlass';
import { colors } from '../theme/tokens';
import { useSession } from '../store/session';

type Props = {
  title?: string;
  pickupLabel?: string;
  dropLabel?: string;
  onPressPickup: () => void;
  onPressDrop: () => void;
};

// The floating glass entry point for the map-first home screen: greeting +
// avatar, then the pickup/drop rows that open the existing location-picker
// modal (unchanged navigation — see REDESIGN_PLAN's "don't rewrite nav"
// constraint). Reused as-is by the Driver tab (title="Post a ride") so both
// roles share the literal same pickup/drop UI, not a lookalike duplicate.
export function FloatingSearchCard({ title = 'Find a ride', pickupLabel, dropLabel, onPressPickup, onPressDrop }: Props) {
  const profile = useSession((s) => s.profile);

  return (
    <DarkGlass className="p-3 gap-2" radius={24}>
      <View className="flex-row items-center justify-between px-1">
        <Text className="text-muted text-xs">{title}</Text>
        <Pressable
          onPress={() => router.push('/profile')}
          accessibilityRole="button"
          accessibilityLabel="Open profile"
          className="active:opacity-70"
        >
          <Avatar name={profile?.full_name ?? 'Meau'} uri={profile?.photo_url} size={32} />
        </Pressable>
      </View>
      <PlaceRow
        icon={<Circle color={colors.accent} size={14} />}
        label="Pickup"
        value={pickupLabel}
        onPress={onPressPickup}
      />
      <View className="h-px bg-glassBorder ml-7" />
      <PlaceRow
        icon={<MapPin color={colors.success} size={16} />}
        label="Drop"
        value={dropLabel}
        onPress={onPressDrop}
      />
    </DarkGlass>
  );
}
