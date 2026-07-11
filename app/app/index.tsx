import { View, ActivityIndicator } from 'react-native';
import { Redirect } from 'expo-router';
import { colors } from '../theme/tokens';
import { useSession } from '../store/session';

// Session gate (04-APP-STRUCTURE.md). Reads auth/profile status and redirects.
export default function Index() {
  const status = useSession((s) => s.status);

  if (status === 'loading') {
    return (
      <View className="flex-1 bg-bg items-center justify-center">
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  if (status === 'onboarding') return <Redirect href="/(onboarding)/welcome" />;
  if (status === 'incomplete') return <Redirect href="/(onboarding)/complete-profile" />;
  return <Redirect href="/(tabs)/passenger" />;
}
