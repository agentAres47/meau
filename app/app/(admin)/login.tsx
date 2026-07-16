import { useState } from 'react';
import { View, Text, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { supabase } from '../../lib/supabase';
import { checkIsAdmin } from '../../lib/admin';

// Admin "ID" is labeled that way in the UI but maps to a Supabase Auth email
// under the hood (see REDESIGN_PLAN open items) -- one real Auth user,
// created manually in the dashboard, marked admin via the `admins` table.
export default function AdminLogin() {
  const [adminId, setAdminId] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit() {
    setError(null);
    if (!adminId.trim() || !password) {
      setError('Enter your admin ID and password.');
      return;
    }
    setLoading(true);
    try {
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: adminId.trim(),
        password,
      });
      if (authErr) throw new Error('Invalid admin ID or password.');

      const isAdmin = await checkIsAdmin();
      if (!isAdmin) {
        await supabase.auth.signOut();
        throw new Error('This account is not an admin.');
      }

      router.replace('/(admin)/dashboard');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} className="px-6">
      <KeyboardAvoidingView
        className="flex-1 justify-center"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View className="gap-6">
          <View>
            <Text className="text-text text-xl font-bold">Admin sign in</Text>
            <Text className="text-muted text-sm mt-2">Staff access only.</Text>
          </View>

          <Input
            label="Admin ID"
            autoCapitalize="none"
            keyboardType="email-address"
            value={adminId}
            onChangeText={setAdminId}
            editable={!loading}
          />
          <Input
            label="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            editable={!loading}
          />

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}

          <Button label="Sign in" loading={loading} onPress={onSubmit} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
