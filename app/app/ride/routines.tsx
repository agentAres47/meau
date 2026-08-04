import { useCallback, useEffect, useRef, useState, type ElementRef } from 'react';
import { View, Text, ScrollView, Pressable, Alert, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { ChevronLeft, CalendarClock, Circle, MapPin, Clock, Pause, Play, Trash2 } from 'lucide-react-native';
import { Screen } from '../../components/Screen';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { Stepper } from '../../components/Stepper';
import { PlaceRow } from '../../components/PlaceRow';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { TimePickerSheet } from '../../components/TimePickerSheet';
import { colors } from '../../theme/tokens';
import { useSession } from '../../store/session';
import { useDriverRideDraft } from '../../store/driverRideDraft';
import { getRoute, suggestedPrice } from '../../lib/maps';
import { getMyVehicle, type Vehicle } from '../../lib/rides';
import {
  listRoutines,
  createRoutine,
  setRoutineStatus,
  deleteRoutine,
  describeDays,
  describeTime,
  DAY_LABELS,
  type CommuteRoutine,
} from '../../lib/commute';
import { selectionHaptic } from '../../lib/haptics';

// F4 — Daily Commute routines.
//
// The point of this screen is that the driver stops posting the same ride every
// morning. They describe it once; the server publishes it on schedule (see
// publish_due_commutes in migration 0031) whether or not the app is open. So
// there is deliberately nothing here that "runs" a routine — this is pure CRUD
// over the description, and the schedule lives in the database.

export default function Routines() {
  const profile = useSession((s) => s.profile);
  const [items, setItems] = useState<CommuteRoutine[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    if (!profile) return;
    try {
      setError(null);
      setItems(await listRoutines(profile.id));
    } catch (e) {
      // Distinguish "no routines" from "couldn't load routines" — they look
      // identical otherwise, and that ambiguity has bitten this project before.
      setError(e instanceof Error ? e.message : 'Could not load your routines.');
      setItems([]);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  async function toggle(r: CommuteRoutine) {
    selectionHaptic();
    const next = r.status === 'active' ? 'paused' : 'active';
    setItems((prev) => prev?.map((x) => (x.id === r.id ? { ...x, status: next } : x)) ?? prev);
    try {
      await setRoutineStatus(r.id, next);
    } catch {
      load(); // put the real state back
    }
  }

  function confirmDelete(r: CommuteRoutine) {
    Alert.alert('Delete this routine?', `${r.origin_label} → ${r.dest_label} will stop publishing.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setItems((prev) => prev?.filter((x) => x.id !== r.id) ?? prev);
          try {
            await deleteRoutine(r.id);
          } catch {
            load();
          }
        },
      },
    ]);
  }

  if (composing) {
    return (
      <RoutineComposer
        onCancel={() => setComposing(false)}
        onSaved={() => {
          setComposing(false);
          load();
        }}
      />
    );
  }

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
        <Text className="text-text text-base font-semibold">Daily routines</Text>
      </View>

      {items === null ? (
        <View className="px-6 pt-2 gap-3">
          <Skeleton height={92} radius={16} />
          <Skeleton height={92} radius={16} />
        </View>
      ) : (
        <ScrollView contentContainerClassName="px-6 pt-2 pb-8 gap-3">
          {error ? <Text className="text-danger text-sm">{error}</Text> : null}

          {items.length === 0 && !error ? (
            <EmptyState
              icon={CalendarClock}
              title="No routines yet"
              description="Describe a trip you make regularly and Meau will publish it for you, on time, every time — without you opening the app."
            />
          ) : (
            items.map((r) => (
              <Card key={r.id} className="gap-3">
                <View className="flex-row items-start justify-between gap-3">
                  <View className="flex-1 gap-1">
                    <Text className="text-text text-sm font-semibold" numberOfLines={1}>
                      {r.origin_label}
                    </Text>
                    <Text className="text-muted text-xs">to</Text>
                    <Text className="text-text text-sm font-semibold" numberOfLines={1}>
                      {r.dest_label}
                    </Text>
                  </View>
                  <View className="flex-row gap-1">
                    <Pressable
                      onPress={() => toggle(r)}
                      accessibilityRole="button"
                      accessibilityLabel={r.status === 'active' ? 'Pause routine' : 'Resume routine'}
                      className="w-9 h-9 items-center justify-center active:opacity-60"
                    >
                      {r.status === 'active' ? (
                        <Pause color={colors.muted} size={18} />
                      ) : (
                        <Play color={colors.accent} size={18} />
                      )}
                    </Pressable>
                    <Pressable
                      onPress={() => confirmDelete(r)}
                      accessibilityRole="button"
                      accessibilityLabel="Delete routine"
                      className="w-9 h-9 items-center justify-center active:opacity-60"
                    >
                      <Trash2 color={colors.danger} size={18} />
                    </Pressable>
                  </View>
                </View>

                <View className="flex-row items-center gap-2">
                  <Clock color={colors.muted} size={14} />
                  <Text className="text-muted text-xs flex-1">
                    {describeDays(r.days_of_week)} · {describeTime(r.depart_time)} · {r.seats} seat
                    {r.seats > 1 ? 's' : ''}
                  </Text>
                  {r.status === 'paused' ? (
                    <Text className="text-muted text-[11px]">Paused</Text>
                  ) : (
                    <Text className="text-success text-[11px]">Active</Text>
                  )}
                </View>
              </Card>
            ))
          )}

          <Button label="New routine" onPress={() => setComposing(true)} />
        </ScrollView>
      )}
    </Screen>
  );
}

// ── Composer ─────────────────────────────────────────────────────────────
// Reuses the driver ride draft + the existing location-picker modal, so
// choosing pickup/drop here behaves exactly like posting a one-off ride.
function RoutineComposer({ onCancel, onSaved }: { onCancel: () => void; onSaved: () => void }) {
  const profile = useSession((s) => s.profile);
  const { origin, dest, reset } = useDriverRideDraft();
  const timeSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [days, setDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon–Fri default
  const [time, setTime] = useState<{ h: number; m: number } | null>(null);
  const [seats, setSeats] = useState(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fresh draft each time the composer opens, same idiom as driver.tsx.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!profile) return;
    getMyVehicle(profile.id).then((v) => {
      setVehicle(v);
      if (v) setSeats(Math.min(v.seats, 6));
    });
  }, [profile?.id]);

  function toggleDay(d: number) {
    selectionHaptic();
    setDays((prev) => (prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]));
  }

  async function save() {
    setError(null);
    if (!profile) return;
    if (!origin || !dest) return setError('Set where this trip starts and ends.');
    if (!vehicle) return setError('Add a vehicle in your profile first.');
    if (days.length === 0) return setError('Pick at least one day.');
    if (!time) return setError('Pick a departure time.');

    setBusy(true);
    try {
      // The route (and the fare derived from its distance) is resolved once, at
      // save time — a routine's road route doesn't change day to day, and this
      // keeps the scheduled publish free of any network call.
      const route = await getRoute(origin, dest);
      await createRoutine({
        driverId: profile.id,
        vehicleId: vehicle.id,
        origin,
        dest,
        routePolyline: route.encoded,
        daysOfWeek: days,
        departTime: `${String(time.h).padStart(2, '0')}:${String(time.m).padStart(2, '0')}`,
        seats,
        pricePerSeat: suggestedPrice(route.distanceKm),
      });
      reset();
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save this routine.');
    } finally {
      setBusy(false);
    }
  }

  const timeLabel = time
    ? describeTime(`${String(time.h).padStart(2, '0')}:${String(time.m).padStart(2, '0')}:00`)
    : 'Pick a time';

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="px-4 pt-2 pb-2 flex-row items-center">
        <Pressable
          onPress={onCancel}
          accessibilityRole="button"
          className="w-10 h-10 -ml-2 items-center justify-center active:opacity-60"
        >
          <ChevronLeft color={colors.text} size={24} />
        </Pressable>
        <Text className="text-text text-base font-semibold">New routine</Text>
      </View>

      <ScrollView contentContainerClassName="px-6 pt-2 pb-8 gap-5" keyboardShouldPersistTaps="handled">
        <Text className="text-muted text-sm">
          Meau publishes this ride for you shortly before each departure, so passengers can find it
          without you posting anything.
        </Text>

        <Card className="gap-2">
          <PlaceRow
            icon={<Circle color={colors.accent} size={14} />}
            label="Pickup"
            value={origin?.label}
            onPress={() => router.push('/modal/location-picker?field=origin&role=driver')}
          />
          <View className="h-px bg-glassBorder ml-7" />
          <PlaceRow
            icon={<MapPin color={colors.success} size={16} />}
            label="Drop"
            value={dest?.label}
            onPress={() => router.push('/modal/location-picker?field=dest&role=driver')}
          />
        </Card>

        <View className="gap-2">
          <Text className="text-sm text-muted">Repeats on</Text>
          <View className="flex-row gap-2">
            {DAY_LABELS.map((label, d) => {
              const on = days.includes(d);
              return (
                <Pressable
                  key={d}
                  onPress={() => toggleDay(d)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  className={`flex-1 aspect-square rounded-full items-center justify-center border ${
                    on ? 'bg-accent border-accent' : 'bg-surface2 border-surface2'
                  }`}
                >
                  <Text className={`text-sm font-semibold ${on ? 'text-bg' : 'text-muted'}`}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-sm text-muted">Departure time</Text>
          <Pressable onPress={() => timeSheetRef.current?.present()} accessibilityRole="button">
            <View className="flex-row items-center gap-2 rounded-full px-4 py-3 bg-surface2 border border-surface2">
              <Clock color={time ? colors.accent : colors.muted} size={16} />
              <Text className={`text-sm font-medium ${time ? 'text-text' : 'text-muted'}`}>
                {timeLabel}
              </Text>
            </View>
          </Pressable>
        </View>

        <View className="flex-row items-center justify-between">
          <Text className="text-text text-base">Seats for passengers</Text>
          <Stepper value={seats} onChange={setSeats} min={1} max={vehicle ? Math.min(vehicle.seats, 6) : 6} />
        </View>

        {error ? <Text className="text-danger text-sm">{error}</Text> : null}

        <Button label={busy ? 'Saving…' : 'Save routine'} loading={busy} onPress={save} />
      </ScrollView>

      <TimePickerSheet
        ref={timeSheetRef}
        allDay
        title="Departure time"
        onConfirm={(d) => {
          setTime({ h: d.getHours(), m: d.getMinutes() });
          timeSheetRef.current?.dismiss();
        }}
      />
    </Screen>
  );
}
