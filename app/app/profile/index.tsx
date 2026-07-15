import { useCallback, useState } from 'react';
import { View, Text, ScrollView, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { ChevronLeft, ShieldCheck, Car, Clock, CircleAlert } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Avatar } from '../../components/Avatar';
import { Badge } from '../../components/Badge';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { useSession } from '../../store/session';
import { getDriverStatus, type DriverStatus } from '../../lib/driver';

const ROLE_LABEL: Record<string, string> = {
  student: 'Student',
  faculty: 'Faculty',
  staff: 'Staff',
};

export default function Profile() {
  const profile = useSession((s) => s.profile);
  const signOut = useSession((s) => s.signOut);
  const [driver, setDriver] = useState<{ status: DriverStatus; reason: string | null } | null>(null);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (profile) getDriverStatus(profile.id).then((d) => alive && setDriver(d));
      return () => {
        alive = false;
      };
    }, [profile])
  );

  if (!profile) return null;

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="px-4 pt-2 pb-2 flex-row items-center">
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          className="w-10 h-10 -ml-2 items-center justify-center active:opacity-60"
        >
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <Text className="text-text text-base font-semibold">Profile</Text>
      </View>

      <ScrollView contentContainerClassName="px-6 pt-4 pb-8 gap-5">
        <View className="items-center gap-3">
          <Avatar name={profile.full_name || 'Meau'} uri={profile.photo_url} size={88} />
          <View className="items-center gap-1">
            <Text className="text-text text-xl font-bold">{profile.full_name || 'Amity member'}</Text>
            <Text className="text-muted text-sm">{profile.amizone_id}</Text>
          </View>
          <View className="flex-row gap-2">
            {profile.verified_amity ? <Badge label="Verified Amity" tone="accent" /> : null}
            <Badge label={ROLE_LABEL[profile.role] ?? profile.role} tone="muted" />
          </View>
        </View>

        <Card className="gap-3">
          <Text className="text-muted text-sm">Details</Text>
          <Row label="Phone" value={profile.phone ?? '—'} />
          {profile.batch ? <Row label="Batch" value={profile.batch} /> : null}
          {profile.department ? <Row label="Department" value={profile.department} /> : null}
        </Card>

        <DriverSection isVerified={profile.is_driver_verified} driver={driver} />

        <Button label="Sign out" variant="secondary" onPress={signOut} />
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between">
      <Text className="text-muted text-sm">{label}</Text>
      <Text className="text-text text-sm">{value}</Text>
    </View>
  );
}

function DriverSection({
  isVerified,
  driver,
}: {
  isVerified: boolean;
  driver: { status: DriverStatus; reason: string | null } | null;
}) {
  if (isVerified) {
    return (
      <Card className="flex-row items-center gap-3">
        <ShieldCheck color={colors.success} size={22} />
        <View className="flex-1">
          <Text className="text-text font-semibold">You're a verified driver</Text>
          <Text className="text-muted text-sm">Post rides from the Driver tab.</Text>
        </View>
      </Card>
    );
  }

  if (driver?.status === 'pending') {
    return (
      <Card className="flex-row items-center gap-3">
        <Clock color={colors.accent} size={22} />
        <View className="flex-1">
          <Text className="text-text font-semibold">Licence under review</Text>
          <Text className="text-muted text-sm">Usually within a few hours.</Text>
        </View>
      </Card>
    );
  }

  return (
    <Card className="gap-3">
      <View className="flex-row items-center gap-3">
        <Car color={colors.accent} size={22} />
        <View className="flex-1">
          <Text className="text-text font-semibold">Become a driver</Text>
          <Text className="text-muted text-sm">Verify your licence to offer rides.</Text>
        </View>
      </View>
      {driver?.status === 'rejected' ? (
        <View className="flex-row items-start gap-2">
          <CircleAlert color={colors.danger} size={16} />
          <Text className="text-danger text-sm flex-1">
            {driver.reason ? `Rejected: ${driver.reason}` : 'Your last submission was rejected.'}
          </Text>
        </View>
      ) : null}
      <Button
        label={driver?.status === 'rejected' ? 'Re-submit' : 'Become a driver'}
        onPress={() => router.push('/profile/become-driver')}
      />
    </Card>
  );
}
