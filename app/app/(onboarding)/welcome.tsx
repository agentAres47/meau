import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';

export default function Welcome() {
  return (
    <SafeAreaView className="flex-1 bg-bg px-6" edges={['top', 'bottom']}>
      <View className="flex-1 justify-end pb-8">
        <Text className="text-text text-xxl font-bold">Meau</Text>
        <Text className="text-muted text-base mt-2 mb-10">
          Ride together with people who already belong here.
        </Text>
        <Button
          label="Login with Amizone"
          variant="primary"
          onPress={() => router.push('/(onboarding)/amizone-login')}
        />
        <Text className="text-muted text-xs text-center mt-4">
          Only verified Amity Mumbai members can join.
        </Text>
      </View>
    </SafeAreaView>
  );
}
