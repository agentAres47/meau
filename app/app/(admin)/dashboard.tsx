import { useEffect, useState, useCallback } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, Image, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { supabase } from '../../lib/supabase';
import {
  checkIsAdmin,
  getAdminStats,
  getPendingDriverApplications,
  getAdminProfiles,
  getLicenceSignedUrl,
  approveDriverApplication,
  rejectDriverApplication,
  type AdminStats,
  type PendingDriverApplication,
  type AdminProfile,
} from '../../lib/admin';

type LoadState = 'loading' | 'ready' | 'unauthorized' | 'error';

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <Card className="flex-1 items-center gap-1">
      <Text className="text-text text-2xl font-bold">{value}</Text>
      <Text className="text-muted text-xs text-center">{label}</Text>
    </Card>
  );
}

function DriverApplicationCard({
  app,
  onDecide,
}: {
  app: PendingDriverApplication;
  onDecide: (amizoneId: string, approve: boolean) => Promise<void>;
}) {
  const [licenceUrl, setLicenceUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);

  useEffect(() => {
    getLicenceSignedUrl(app.licence_path)
      .then(setLicenceUrl)
      .catch(() => setLicenceUrl(null));
  }, [app.licence_path]);

  async function decide(approve: boolean) {
    setBusy(approve ? 'approve' : 'reject');
    try {
      await onDecide(app.amizone_id, approve);
    } finally {
      setBusy(null);
    }
  }

  return (
    <Card className="gap-3">
      <View>
        <Text className="text-text text-base font-semibold">{app.full_name}</Text>
        <Text className="text-muted text-xs mt-0.5">
          {app.amizone_id} · {app.phone ?? 'no phone'}
        </Text>
      </View>

      {licenceUrl ? (
        <Image source={{ uri: licenceUrl }} style={{ width: '100%', height: 160, borderRadius: 16 }} />
      ) : (
        <View className="h-16 items-center justify-center">
          <ActivityIndicator color="#9A9298" />
        </View>
      )}

      <Text className="text-text text-sm">
        {app.vehicle_type ?? 'unknown'} · {app.make_model ?? '—'} {app.color ? `(${app.color})` : ''}
      </Text>
      <Text className="text-muted text-xs">
        {app.plate_number ?? '—'} · {app.seats ?? '—'} seats
      </Text>

      <View className="flex-row gap-3">
        <Button
          label="Reject"
          variant="secondary"
          className="flex-1"
          loading={busy === 'reject'}
          disabled={busy !== null}
          onPress={() => decide(false)}
        />
        <Button
          label="Approve"
          variant="primary"
          className="flex-1"
          loading={busy === 'approve'}
          disabled={busy !== null}
          onPress={() => decide(true)}
        />
      </View>
    </Card>
  );
}

export default function AdminDashboard() {
  const [state, setState] = useState<LoadState>('loading');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [pending, setPending] = useState<PendingDriverApplication[]>([]);
  const [profiles, setProfiles] = useState<AdminProfile[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        setState('unauthorized');
        return;
      }
      const isAdmin = await checkIsAdmin();
      if (!isAdmin) {
        setState('unauthorized');
        return;
      }
      const [statsRes, pendingRes, profilesRes] = await Promise.all([
        getAdminStats(),
        getPendingDriverApplications(),
        getAdminProfiles(),
      ]);
      setStats(statsRes);
      setPending(pendingRes);
      setProfiles(profilesRes);
      setState('ready');
    } catch {
      setState('error');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (state === 'unauthorized') router.replace('/(admin)/login');
  }, [state]);

  async function onDecide(amizoneId: string, approve: boolean) {
    if (approve) await approveDriverApplication(amizoneId);
    else await rejectDriverApplication(amizoneId, 'Rejected by admin');
    await load();
  }

  async function onLogout() {
    await supabase.auth.signOut();
    router.replace('/(onboarding)/welcome');
  }

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

  if (state === 'loading' || state === 'unauthorized') {
    return (
      <Screen edges={['top', 'bottom']} className="items-center justify-center">
        <ActivityIndicator color="#F7A6C1" />
      </Screen>
    );
  }

  if (state === 'error') {
    return (
      <Screen edges={['top', 'bottom']} className="items-center justify-center px-6">
        <Text className="text-text text-base text-center mb-4">Couldn't load the dashboard.</Text>
        <Button label="Retry" onPress={load} />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <ScrollView
        contentContainerClassName="px-6 pt-6 pb-10 gap-6"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F7A6C1" />}
      >
        <View className="flex-row items-center justify-between">
          <Text className="text-text text-xl font-bold">Admin</Text>
          <Pressable onPress={onLogout} accessibilityRole="button" className="active:opacity-60">
            <Text className="text-muted text-sm">Log out</Text>
          </Pressable>
        </View>

        {stats ? (
          <View className="gap-3">
            <View className="flex-row gap-3">
              <StatTile label="Total users" value={stats.total_users} />
              <StatTile label="Onboarded" value={stats.onboarded_users} />
            </View>
            <View className="flex-row gap-3">
              <StatTile label="Pending DLs" value={stats.pending_driver_applications} />
              <StatTile label="Live tokens" value={stats.active_ride_tokens} />
              <StatTile label="Rides today" value={stats.rides_today} />
            </View>
          </View>
        ) : null}

        <View className="gap-3">
          <Text className="text-text text-base font-semibold">Driver licence queue</Text>
          {pending.length === 0 ? (
            <Card>
              <Text className="text-muted text-sm text-center">No pending applications.</Text>
            </Card>
          ) : (
            pending.map((app) => (
              <DriverApplicationCard key={app.verification_id} app={app} onDecide={onDecide} />
            ))
          )}
        </View>

        <View className="gap-3">
          <Text className="text-text text-base font-semibold">Users ({profiles.length})</Text>
          <Card className="gap-3">
            {profiles.map((p) => (
              <View key={p.id} className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-text text-sm">{p.full_name}</Text>
                  <Text className="text-muted text-xs">
                    {p.amizone_id} · {p.role}
                  </Text>
                </View>
                {p.is_driver_verified ? <Text className="text-success text-xs">driver</Text> : null}
              </View>
            ))}
          </Card>
        </View>
      </ScrollView>
    </Screen>
  );
}
