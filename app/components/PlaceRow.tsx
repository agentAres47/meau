import { View, Text, Pressable } from 'react-native';

type Props = {
  icon: React.ReactNode;
  label: string;
  value?: string;
  onPress: () => void;
};

// Tappable pickup/destination row used in the post-ride and passenger-search forms.
export function PlaceRow({ icon, label, value, onPress }: Props) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" className="flex-row items-center gap-3 active:opacity-70">
      <View className="w-4 items-center">{icon}</View>
      <View className="flex-1">
        <Text className="text-muted text-xs">{label}</Text>
        <Text className={value ? 'text-text text-base' : 'text-muted text-base'} numberOfLines={1}>
          {value ?? `Set ${label.toLowerCase()}`}
        </Text>
      </View>
    </Pressable>
  );
}
