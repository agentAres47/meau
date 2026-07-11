import { View, Text } from 'react-native';
import { Link } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../components/Button';

// Phase 1 replaces the CTA below with real Amizone-login routing + session gate.
export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6" edges={['top', 'bottom']}>
      <View className="flex-1 justify-end pb-8">
        <Text className="text-text text-xxl font-bold">Meau</Text>
        <Text className="text-muted text-base mt-2 mb-10">
          Ride together with people who already belong here.
        </Text>
        <Button label="Login with Amizone" variant="primary" disabled />
        <Link href="/scratch" asChild>
          <Text className="text-muted text-xs text-center mt-6">dev: view components →</Text>
        </Link>
      </View>
    </SafeAreaView>
  );
}
