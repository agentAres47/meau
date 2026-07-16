import { Stack } from 'expo-router';
import { colors } from '../../theme/tokens';

// Admin is a second, separate auth branch from the student session state
// machine (see REDESIGN_PLAN "Admin security model") -- exempted from the
// global useAuthGuard in the root layout. Each screen here checks its own
// auth state instead of relying on the student onboarding/ready gate.
export default function AdminLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    />
  );
}
