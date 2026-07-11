import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Users } from 'lucide-react-native';
import { EmptyState } from '../../components/EmptyState';

export default function AutoPool() {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6" edges={['top']}>
      <View className="flex-1 justify-center">
        <EmptyState
          icon={Users}
          title="Auto Pool is coming"
          description="Share an auto on campus routes, now or scheduled. Built in Phase 7."
        />
      </View>
    </SafeAreaView>
  );
}
