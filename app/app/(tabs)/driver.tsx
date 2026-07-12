import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Car, Clock } from 'lucide-react-native';
import { ScreenHeader } from '../../components/ScreenHeader';
import { EmptyState } from '../../components/EmptyState';
import { useSession } from '../../store/session';
import { getDriverStatus, type DriverStatus } from '../../lib/driver';

export default function Driver() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const [status, setStatus] = useState<DriverStatus | null>(null);

  // Refresh on focus so approval (done in Supabase) unlocks the tab, and so the
  // pending state appears after submitting.
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refreshProfile();
      if (profile) getDriverStatus(profile.id).then((d) => alive && setStatus(d.status));
      return () => {
        alive = false;
      };
    }, [profile?.id, refreshProfile])
  );

  return (
    <SafeAreaView className="flex-1 bg-bg" edges={['top']}>
      <ScreenHeader title="Driver" subtitle="Offer a ride" />
      <View className="flex-1 justify-center">
        {profile?.is_driver_verified ? (
          <EmptyState
            icon={Car}
            title="Posting rides is coming"
            description="You're verified. Post live ride tokens here in Phase 3."
          />
        ) : status === 'pending' ? (
          <EmptyState
            icon={Clock}
            title="Licence under review"
            description="We'll unlock the Driver tab once you're approved — usually within a few hours."
          />
        ) : (
          <EmptyState
            icon={Car}
            title="Verify your licence to offer rides"
            description="Drivers are licence-checked so every ride stays safe."
            actionLabel="Become a driver"
            onAction={() => router.push('/profile/become-driver')}
          />
        )}
      </View>
    </SafeAreaView>
  );
}
