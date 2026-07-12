import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search } from 'lucide-react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import { useSession } from '../../store/session';

export default function Passenger() {
  const profile = useSession((s) => s.profile);
  const firstName = (profile?.full_name ?? 'Rider').split(' ')[0];

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScreenHeader title={firstName} subtitle="Welcome back" />
      <View className="flex-1 justify-center">
        <EmptyState
          icon={Search}
          title="Passenger search is coming"
          description="Enter pickup and drop to find rides on your way. Built in Phase 4."
        />
      </View>
    </SafeAreaView>
  );
}
