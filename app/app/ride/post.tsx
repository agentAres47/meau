import { useEffect, useRef, useState, type ElementRef } from 'react';
import { View, Text, ScrollView, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import { BottomSheetModal } from '@gorhom/bottom-sheet';
import { Screen } from '../../components/Screen';
import { TimePickerSheet } from '../../components/TimePickerSheet';
import { ChevronLeft, Circle, MapPin, Clock } from 'lucide-react-native';
import { colors } from '../../theme/tokens';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Stepper } from '../../components/Stepper';
import { PriceSlider } from '../../components/PriceSlider';
import { MapPreview } from '../../components/MapPreview';
import { PlaceRow } from '../../components/PlaceRow';
import { useSession } from '../../store/session';
import { useRideDraft } from '../../store/rideDraft';
import { getRoute, decodeRoute, suggestedPrice, type Route, type Place } from '../../lib/maps';
import { createRideToken, getMyVehicle, type Vehicle } from '../../lib/rides';
import { formatDepart } from '../../lib/format';

function plusMinutes(min: number) {
  return new Date(Date.now() + min * 60_000);
}

function regionFor(a: Place, b: Place) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.6 + 0.02,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.6 + 0.02,
  };
}

export default function PostRide() {
  const profile = useSession((s) => s.profile);
  const { origin, dest, reset } = useRideDraft();

  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [departAt, setDepartAt] = useState(() => plusMinutes(15));
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(60);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const departSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);

  // Start each post fresh, then load the driver's vehicle for seat defaults.
  useEffect(() => {
    reset();
    if (profile) getMyVehicle(profile.id).then((v) => {
      setVehicle(v);
      if (v) setSeats(Math.min(v.seats, 6));
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch the route (and suggest a fare) whenever both ends are set.
  useEffect(() => {
    if (!origin || !dest) {
      setRoute(null);
      return;
    }
    setRouteBusy(true);
    getRoute(origin, dest).then((r) => {
      setRoute(r);
      setPrice(suggestedPrice(r.distanceKm));
      setRouteBusy(false);
    });
  }, [origin, dest]);

  function pickDepart() {
    departSheetRef.current?.present();
  }

  async function goLive() {
    setError(null);
    if (!origin || !dest) return setError('Set your pickup and destination.');
    if (!vehicle) return setError('Add a vehicle in your profile first.');
    if (!route) return setError('Still getting the route — try again in a moment.');
    if (departAt.getTime() <= Date.now()) return setError('Pick a departure time in the future.');

    setLoading(true);
    try {
      await createRideToken({
        driverId: profile!.id,
        vehicleId: vehicle.id,
        origin,
        dest,
        routePolyline: route.encoded,
        departAt,
        seats,
        pricePerSeat: price,
      });
      reset();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
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
        <Text className="text-text text-base font-semibold">Post a ride</Text>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerClassName="px-6 pt-4 pb-4 gap-5" keyboardShouldPersistTaps="handled">
          <Card className="gap-3">
            <PlaceRow
              icon={<Circle color={colors.accent} size={14} />}
              label="Pickup"
              value={origin?.label}
              onPress={() => router.push('/modal/location-picker?field=origin')}
            />
            <View className="h-px bg-glassBorder ml-7" />
            <PlaceRow
              icon={<MapPin color={colors.success} size={16} />}
              label="Destination"
              value={dest?.label}
              onPress={() => router.push('/modal/location-picker?field=dest')}
            />
          </Card>

          {origin && dest ? (
            <View className="gap-2">
              <MapPreview
                region={regionFor(origin, dest)}
                path={route ? decodeRoute(route.encoded) : undefined}
                markers={[origin, dest]}
                height={160}
              />
              {routeBusy ? (
                <Text className="text-muted text-xs">Finding the route…</Text>
              ) : route ? (
                <Text className="text-muted text-xs">
                  ~{route.distanceKm.toFixed(1)} km{route.approximate ? ' (approx — maps key not set)' : ''}
                </Text>
              ) : null}
            </View>
          ) : null}

          <Pressable onPress={pickDepart} accessibilityRole="button">
            <Card className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3">
                <Clock color={colors.accent} size={20} />
                <Text className="text-text text-base">Depart</Text>
              </View>
              <Text className="text-text text-base font-medium tabular-nums">{formatDepart(departAt)}</Text>
            </Card>
          </Pressable>

          <Card className="flex-row items-center justify-between">
            <Text className="text-text text-base">Seats</Text>
            <Stepper value={seats} onChange={setSeats} min={1} max={vehicle ? Math.min(vehicle.seats, 6) : 6} />
          </Card>

          <Card>
            <Text className="text-muted text-sm mb-2">Price per seat</Text>
            <PriceSlider value={price} onChange={setPrice} />
          </Card>

          {error ? <Text className="text-danger text-sm">{error}</Text> : null}
        </ScrollView>

        <View className="px-6 pb-4">
          <Button label="Go live" loading={loading} onPress={goLive} />
        </View>
      </KeyboardAvoidingView>

      <TimePickerSheet
        ref={departSheetRef}
        onConfirm={(d) => {
          setDepartAt(d);
          departSheetRef.current?.dismiss();
        }}
      />
    </Screen>
  );
}
