import { useCallback, useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { Users } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { ScreenHeader } from '../../components/ScreenHeader';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Radar } from '../../components/Radar';
import { useSession } from '../../store/session';
import {
  PRESET_ROUTES,
  nextSlots,
  createPoolSession,
  getActivePoolSession,
  cancelPoolSession,
  subscribePoolSession,
  getPoolMatchId,
  type PoolSession,
  type PoolMode,
  type RouteCode,
} from '../../lib/autopool';
import { matchHaptic } from '../../lib/haptics';
import { formatDepart } from '../../lib/format';

export default function AutoPool() {
  const profile = useSession((s) => s.profile);
  const [session, setSession] = useState<PoolSession | null | undefined>(undefined);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profile) return;
    const s = await getActivePoolSession(profile.id);
    setSession(s);
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // While waiting, watch our own session row for a match (or expiry/cancel).
  useEffect(() => {
    if (!session || session.status !== 'waiting' || !profile) return;
    return subscribePoolSession(session.id, async () => {
      const s = await getActivePoolSession(profile.id);
      if (!s) {
        setNotice('No one right now — try scheduled or retry.');
        setSession(null);
        return;
      }
      if (s.status === 'matched' && s.pool_group_id) {
        matchHaptic();
        const matchId = await getPoolMatchId(s.pool_group_id);
        if (matchId) router.replace(`/match/${matchId}`);
        return;
      }
      setSession(s);
    });
  }, [session, profile]);

  if (session === undefined) {
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  if (session?.status === 'waiting') {
    return (
      <Waiting
        session={session}
        onCancel={async () => {
          await cancelPoolSession(session.id);
          setSession(null);
        }}
      />
    );
  }

  return (
    <Picker
      notice={notice}
      onStarted={(s) => {
        setNotice(null);
        setSession(s);
      }}
    />
  );
}

function Waiting({ session, onCancel }: { session: PoolSession; onCancel: () => void }) {
  const route = PRESET_ROUTES.find((r) => r.code === session.route_code);
  return (
    <Screen className="items-center justify-center px-6" edges={['top', 'bottom']}>
      <View className="items-center gap-6">
        <Radar icon={Users} />
        <View className="items-center gap-1">
          <Text className="text-text text-lg font-bold">
            {session.mode === 'now' ? 'Searching now…' : `Queued for ${formatDepart(session.slot_time!)}`}
          </Text>
          <Text className="text-muted text-sm text-center">
            {route?.label} · we'll pool you with others on this route.
          </Text>
        </View>
        <Button label="Cancel" variant="ghost" onPress={onCancel} />
      </View>
    </Screen>
  );
}

function Picker({
  notice,
  onStarted,
}: {
  notice: string | null;
  onStarted: (s: PoolSession) => void;
}) {
  const profile = useSession((s) => s.profile);
  const [mode, setMode] = useState<PoolMode>('now');
  const [route, setRoute] = useState<RouteCode | null>(null);
  const [slot, setSlot] = useState<Date | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const slots = nextSlots();

  async function start() {
    setError(null);
    if (!route || !profile) return setError('Pick a route.');
    if (mode === 'scheduled' && !slot) return setError('Pick a time slot.');
    setBusy(true);
    try {
      const id = await createPoolSession({
        profileId: profile.id,
        routeCode: route,
        mode,
        slotTime: mode === 'scheduled' ? slot! : undefined,
      });
      onStarted({
        id,
        route_code: route,
        mode,
        slot_time: slot ? slot.toISOString() : null,
        status: 'waiting',
        pool_group_id: null,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top']}>
      <ScreenHeader title="Auto Pool" subtitle="Share an auto" />
      <ScrollView contentContainerClassName="px-6 pt-2 pb-28 gap-5">
        {notice ? <Text className="text-danger text-sm">{notice}</Text> : null}

        <View className="flex-row gap-2">
          <Chip label="Right now" selected={mode === 'now'} onPress={() => setMode('now')} />
          <Chip label="Scheduled" selected={mode === 'scheduled'} onPress={() => setMode('scheduled')} />
        </View>

        <View className="gap-2">
          <Text className="text-sm text-muted">Route</Text>
          <View className="gap-2">
            {PRESET_ROUTES.map((r) => (
              <Pressable key={r.code} onPress={() => setRoute(r.code)} accessibilityRole="button">
                <View
                  className={`bg-surface rounded-2xl p-4 border ${
                    route === r.code ? 'border-accent' : 'border-surface2'
                  }`}
                >
                  <View className="flex-row items-center justify-between">
                    <Text className="text-text text-base font-semibold">{r.label}</Text>
                    <Text className="text-muted text-xs">~₹{r.typicalFare} full auto</Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>
        </View>

        {mode === 'scheduled' ? (
          <View className="gap-2">
            <Text className="text-sm text-muted">Time slot</Text>
            <View className="flex-row flex-wrap gap-2">
              {slots.map((s) => (
                <Chip
                  key={s.toISOString()}
                  label={formatDepart(s)}
                  selected={slot?.getTime() === s.getTime()}
                  onPress={() => setSlot(s)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {error ? <Text className="text-danger text-sm">{error}</Text> : null}

        <Button label={mode === 'now' ? 'Find a pool now' : 'Join this slot'} loading={busy} onPress={start} />
      </ScrollView>
    </Screen>
  );
}
