import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Avatar } from './Avatar';
import { useSession } from '../store/session';

type Props = {
  title: string;
  subtitle?: string;
};

// Top bar for the main tabs: greeting + tappable avatar that opens Profile.
export function ScreenHeader({ title, subtitle }: Props) {
  const profile = useSession((s) => s.profile);

  return (
    <View className="flex-row items-center justify-between px-6 pt-4 pb-2">
      <View className="flex-1 pr-3">
        {subtitle ? <Text className="text-muted text-sm">{subtitle}</Text> : null}
        <Text className="text-text text-xl font-bold" numberOfLines={1}>
          {title}
        </Text>
      </View>
      <Pressable
        onPress={() => router.push('/profile')}
        accessibilityRole="button"
        accessibilityLabel="Open profile"
        className="active:opacity-70"
      >
        <Avatar name={profile?.full_name ?? 'Meau'} uri={profile?.photo_url} size={40} />
      </Pressable>
    </View>
  );
}
