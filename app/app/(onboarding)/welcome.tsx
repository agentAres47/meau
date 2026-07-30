import { useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Settings } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { colors } from '../../theme/tokens';

// Amity runs two SEPARATE Amizone portals with different login pages (see
// amizone-webview for the per-portal selectors). We must know which one to
// send the user to before opening the WebView.
type Portal = 'student' | 'staff';

export default function Welcome() {
  const [portal, setPortal] = useState<Portal>('student');

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
        <Text className="text-muted text-sm mt-3 mb-6">
          Verified rides with people who already belong at Amity Mumbai.
        </Text>

        <Text className="text-muted text-sm mb-2">I'm a</Text>
        <View className="flex-row gap-2 mb-8">
          <Chip
            label="Student"
            selected={portal === 'student'}
            onPress={() => setPortal('student')}
          />
          <Chip
            label="Staff / Faculty"
            selected={portal === 'staff'}
            onPress={() => setPortal('staff')}
          />
        </View>

        <Button
          label="Login with Amizone"
          variant="primary"
          onPress={() => router.push(`/(onboarding)/amizone-webview?portal=${portal}`)}
        />
        <Text className="text-muted text-xs text-center mt-4">
          Only verified Amity Mumbai members can join.
        </Text>
      </View>
    </Screen>
  );
}
