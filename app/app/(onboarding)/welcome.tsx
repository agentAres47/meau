import { View, Text } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';

export default function Welcome() {
  return (
    <Screen edges={['top', 'bottom']} className="px-6">
      <View className="flex-1 justify-end pb-8">
        <Text className="text-text text-xxl font-bold">Meau</Text>
        <Text className="text-accent text-lg font-semibold mt-1">Find your Humsafar.</Text>
        <Text className="text-muted text-sm mt-3 mb-10">
          Verified rides with people who already belong at Amity Mumbai.
        </Text>
        <Button
          label="Login with Amizone"
          variant="primary"
          onPress={() => router.push('/(onboarding)/amizone-webview')}
        />
        <Text className="text-muted text-xs text-center mt-4">
          Only verified Amity Mumbai members can join.
        </Text>
      </View>
    </Screen>
  );
}
