import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform, Pressable } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { ChevronLeft } from 'lucide-react-native';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { colors } from '../../theme/tokens';
import { useSession } from '../../store/session';
import { verifyAmizone } from '../../lib/amizone';

export default function AmizoneLogin() {
  const ensureSession = useSession((s) => s.ensureSession);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [amizoneId, setAmizoneId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onVerify() {
    setError(null);
    if (!amizoneId.trim() || !password) {
      setError('Enter your Amizone ID and password.');
      return;
    }
    setLoading(true);
    try {
      const token = await ensureSession();
      await verifyAmizone({ amizoneId: amizoneId.trim(), password, token });
      setPassword(''); // drop the password from state the moment we're done with it
      await refreshProfile();
      router.replace('/(onboarding)/complete-profile');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="px-6 pt-2">
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="w-10 h-10 -ml-2 items-center justify-center active:opacity-60"
          >
            <ChevronLeft color={colors.text} size={24} />
          </Pressable>
        </View>

        <View className="flex-1 px-6 pt-6">
          <Text className="text-text text-xl font-bold">Login with Amizone</Text>
          <Text className="text-muted text-sm mt-2 mb-8">
            We verify you once with Amizone and never store your password.
          </Text>

          <View className="gap-4">
            <Input
              label="Amizone ID"
              placeholder="Enrollment / Employee ID"
              autoCapitalize="characters"
              autoCorrect={false}
              value={amizoneId}
              onChangeText={setAmizoneId}
              editable={!loading}
            />
            <Input
              label="Password"
              placeholder="Amizone password"
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              value={password}
              onChangeText={setPassword}
              editable={!loading}
              error={error ?? undefined}
            />
          </View>
        </View>

        <View className="px-6 pb-4">
          <Button label="Verify & continue" loading={loading} onPress={onVerify} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
