import { useState } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { Redirect, router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { supabase } from '../../lib/supabase';
import { useSession, type Profile } from '../../store/session';

const ROLES: Profile['role'][] = ['student', 'faculty', 'staff'];
const ROLE_LABELS: Record<Profile['role'], string> = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Staff',
};
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
  { value: 'prefer_not', label: 'Prefer not to say' },
] as const;

function Chip({
  label,
  selected,
  onPress,
  disabled,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      className={`rounded-full px-4 py-2 border active:scale-[0.97] ${
        selected ? 'bg-accent border-accent' : 'bg-surface2 border-surface2'
      }`}
    >
      <Text className={`text-sm font-medium ${selected ? 'text-bg' : 'text-text'}`}>{label}</Text>
    </Pressable>
  );
}

export default function CompleteProfile() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [role, setRole] = useState<Profile['role']>(profile?.role ?? 'student');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reached only with a verified profile; guard the direct-nav case.
  if (!profile) return <Redirect href="/(onboarding)/welcome" />;

  async function onSave() {
    setError(null);
    if (!fullName.trim()) {
      setError('Your name is required.');
      return;
    }
    if (!/^\d{10}$/.test(phone.trim())) {
      setError('Enter a valid 10-digit phone number.');
      return;
    }
    setLoading(true);
    try {
      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          role,
          phone: phone.trim(),
          gender,
        })
        .eq('id', profile!.id);
      if (updErr) throw updErr;
      await refreshProfile(); // status flips to 'ready'
      router.replace('/(tabs)/passenger');
    } catch {
      setError("Couldn't save your profile. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="px-6 pt-6 pb-4 gap-6" keyboardShouldPersistTaps="handled">
          <View>
            <Text className="text-text text-xl font-bold">Complete your profile</Text>
            <Text className="text-muted text-sm mt-2">
              Verified as {profile.amizone_id}
              {profile.batch ? ` · ${profile.batch}` : ''}. A few more details.
            </Text>
          </View>

          <Input label="Full name" value={fullName} onChangeText={setFullName} editable={!loading} />

          <View>
            <Text className="text-sm text-muted mb-2">Role</Text>
            <View className="flex-row flex-wrap gap-2">
              {ROLES.map((r) => (
                <Chip
                  key={r}
                  label={ROLE_LABELS[r]}
                  selected={role === r}
                  onPress={() => setRole(r)}
                  disabled={loading}
                />
              ))}
            </View>
          </View>

          <Input
            label="Phone"
            placeholder="10-digit mobile number"
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            editable={!loading}
          />

          <View>
            <Text className="text-sm text-muted mb-2">Gender (optional)</Text>
            <View className="flex-row flex-wrap gap-2">
              {GENDERS.map((g) => (
                <Chip
                  key={g.value}
                  label={g.label}
                  selected={gender === g.value}
                  onPress={() => setGender(gender === g.value ? null : g.value)}
                  disabled={loading}
                />
              ))}
            </View>
          </View>

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}
        </ScrollView>

        <View className="px-6 pb-4">
          <Button label="Enter Meau" loading={loading} onPress={onSave} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
