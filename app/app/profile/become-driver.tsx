import { ScrollView, View, Text, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { ChevronLeft } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { DriverApplicationForm } from '../../components/DriverApplicationForm';
import { useSession } from '../../store/session';
import { submitDriverApplication } from '../../lib/driver';

export default function BecomeDriver() {
  const profile = useSession((s) => s.profile);

  if (!profile) return null;

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
        <Text className="text-text text-base font-semibold">Become a driver</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="px-6 pt-4 pb-4" keyboardShouldPersistTaps="handled">
          <Text className="text-muted text-sm mb-6">
            Upload your driving licence and vehicle details. We review it before you can post rides.
          </Text>
          <DriverApplicationForm
            onSubmit={async ({ licenceUri, vehicle }) => {
              await submitDriverApplication({
                profileId: profile.id,
                authUserId: profile.auth_user_id,
                licenceUri,
                vehicle,
              });
              router.back(); // Profile shows the pending state on focus
            }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
