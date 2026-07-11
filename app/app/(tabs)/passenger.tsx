import { View, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { useSession } from '../../store/session';

export default function Passenger() {
  const profile = useSession((s) => s.profile);
  const signOut = useSession((s) => s.signOut);

  return (
    <SafeAreaView className="flex-1 bg-bg px-6" edges={['top']}>
      <View className="pt-4">
        <Text className="text-muted text-sm">Welcome back</Text>
        <Text className="text-text text-xl font-bold">{profile?.full_name ?? 'Rider'}</Text>
      </View>

      <View className="flex-1 justify-center">
        <EmptyState
          icon={Search}
          title="Passenger search is coming"
          description="Enter pickup and drop to find rides on your way. Built in Phase 4."
        />
      </View>

      {/* ponytail: temporary dev sign-out so onboarding can be re-tested.
          Phase 2 moves sign-out into the real profile screen. */}
      <View className="pb-6">
        <Button label="Sign out (dev)" variant="ghost" onPress={signOut} />
      </View>
    </SafeAreaView>
  );
}
