import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { colors } from '../../theme/tokens';

export default function Welcome() {
  return (
    <Screen edges={['top', 'bottom']} className="px-6">
      {/* Deliberately subtle -- admin is not for students to notice or tap by
          accident. See REDESIGN_PLAN "Admin = in-app" for the full flow. */}
      <Pressable
        onPress={() => router.push('/(admin)/login')}
        accessibilityRole="button"
        accessibilityLabel="Admin sign in"
        hitSlop={12}
        className="absolute top-4 left-4 z-10 w-9 h-9 items-center justify-center active:opacity-60"
      >
        <Settings color={colors.muted} size={18} opacity={0.35} />
      </Pressable>

      <View className="flex-1 justify-end pb-8">
        <Text className="text-text text-xxl font-bold">Meau</Text>
        <Text className="text-accent text-lg font-semibold mt-1">Find your Humsafar.</Text>
        <Text className="text-muted text-sm mt-3 mb-10">
          Verified rides with people who already belong at Amity Mumbai.
        </Text>
        <Button
          label="Login with Amizone"
          variant="primary"
          onPress={() => router.push('/(onboarding)/amizone-webview')}
        />
        <Text className="text-muted text-xs text-center mt-4">
          Only verified Amity Mumbai members can join.
        </Text>
      </View>
    </Screen>
  );
}
