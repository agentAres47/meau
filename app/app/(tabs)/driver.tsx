import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car } from 'lucide-react-native';
import { EmptyState } from '../../components/EmptyState';

export default function Driver() {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6" edges={['top']}>
      <View className="flex-1 justify-center">
        <EmptyState
          icon={Car}
          title="Driver mode is coming"
          description="Verify your licence and post live rides. Gating lands in Phase 2, posting in Phase 3."
        />
      </View>
    </SafeAreaView>
  );
}
