import { useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Redirect, router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Screen } from '../../components/Screen';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Avatar } from '../../components/Avatar';
import { DriverApplicationForm } from '../../components/DriverApplicationForm';
import { supabase } from '../../lib/supabase';
import { submitDriverApplication } from '../../lib/driver';
import { DEPARTMENTS } from '../../lib/departments';
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

// Uploads to the public `avatars` bucket at `${authUserId}/avatar-*`, owner-write RLS.
async function uploadAvatar(authUserId: string, uri: string): Promise<string> {
  const ext = (uri.split('.').pop() || 'jpg').toLowerCase();
  const path = `${authUserId}/avatar-${Date.now()}.${ext}`;
  const bytes = await fetch(uri).then((r) => r.arrayBuffer());
  const { error } = await supabase.storage.from('avatars').upload(path, bytes, {
    contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    upsert: true,
  });
  if (error) throw new Error('Could not upload your photo. Try again.');
  return supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl;
}

export default function CompleteProfile() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const signOut = useSession((s) => s.signOut);

  const [step, setStep] = useState<1 | 2>(1);

  const [fullName, setFullName] = useState(profile?.full_name ?? '');
  const [role, setRole] = useState<Profile['role']>(profile?.role ?? 'student');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState<string | null>(null);
  const [department, setDepartment] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reached only with a verified profile; guard the direct-nav case.
  if (!profile) return <Redirect href="/(onboarding)/welcome" />;

  async function onSignOut() {
    await signOut();
    router.replace('/(onboarding)/welcome');
  }

  async function finish() {
    await refreshProfile(); // status flips to 'ready'
    // dismissTo, not replace: this screen is nested in the (onboarding) stack,
    // exiting to a different top-level group (tabs) — plain replace() only
    // swaps the current screen within its own stack, leaving stale history.
    router.dismissTo('/(tabs)/passenger');
  }

  async function pickPhoto() {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError('Allow photo access to choose a profile photo.');
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7 });
    if (!res.canceled) setPhotoUri(res.assets[0].uri);
  }

  async function onContinue() {
    setError(null);
    if (!fullName.trim()) return setError('Your name is required.');
    if (!/^\d{10}$/.test(phone.trim())) return setError('Enter a valid 10-digit phone number.');

    setLoading(true);
    try {
      const photo_url = photoUri ? await uploadAvatar(profile!.auth_user_id, photoUri) : null;
      const { error: updErr } = await supabase
        .from('profiles')
        .update({
          full_name: fullName.trim(),
          role,
          phone: phone.trim(),
          gender,
          department,
          ...(photo_url ? { photo_url } : {}),
        })
        .eq('id', profile!.id);
      if (updErr) throw updErr;
      setStep(2);
    } catch {
      setError("Couldn't save your profile. Try again.");
    } finally {
      setLoading(false);
    }
  }

  if (step === 2) {
    return (
      <Screen edges={['top', 'bottom']}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
          <ScrollView contentContainerClassName="px-6 pt-6 pb-4" keyboardShouldPersistTaps="handled">
            <Text className="text-text text-xl font-bold">Want to drive too?</Text>
            <Text className="text-muted text-sm mt-2 mb-6">
              Upload your licence now, or skip and do this later from your profile.
            </Text>
            <DriverApplicationForm
              submitLabel="Submit for review"
              onSubmit={async ({ licenceUri, vehicle }) => {
                await submitDriverApplication({
                  profileId: profile!.id,
                  authUserId: profile!.auth_user_id,
                  licenceUri,
                  vehicle,
                });
                await finish();
              }}
              footer={
                <Pressable
                  onPress={finish}
                  accessibilityRole="button"
                  className="py-3 active:opacity-60"
                >
                  <Text className="text-muted text-sm text-center">Skip for now</Text>
                </Pressable>
              }
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <ScrollView contentContainerClassName="px-6 pt-6 pb-4 gap-6" keyboardShouldPersistTaps="handled">
          <View>
            <Text className="text-text text-xl font-bold">Complete your profile</Text>
            <Text className="text-muted text-sm mt-2">
              Verified as {profile.amizone_id}
              {profile.batch ? ` · ${profile.batch}` : ''}. A few more details.
            </Text>
          </View>

          <Pressable
            onPress={pickPhoto}
            disabled={loading}
            accessibilityRole="button"
            className="self-center active:opacity-80"
          >
            <Avatar uri={photoUri} name={fullName || profile.amizone_id} size={88} />
            <Text className="text-accent text-xs text-center mt-2">
              {photoUri ? 'Change photo' : 'Add photo'}
            </Text>
          </Pressable>

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
            <Text className="text-sm text-muted mb-2">Department (optional)</Text>
            <View className="flex-row flex-wrap gap-2">
              {DEPARTMENTS.map((d) => (
                <Chip
                  key={d}
                  label={d}
                  selected={department === d}
                  onPress={() => setDepartment(department === d ? null : d)}
                  disabled={loading}
                />
              ))}
            </View>
          </View>

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
          <Button label="Continue" loading={loading} onPress={onContinue} />
          <Pressable
            onPress={onSignOut}
            disabled={loading}
            accessibilityRole="button"
            className="py-3 active:opacity-60"
          >
            <Text className="text-muted text-sm text-center">Not you? Sign out</Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
