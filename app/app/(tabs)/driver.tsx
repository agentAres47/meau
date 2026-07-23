import { useCallback, useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView, BottomSheetModal } from '@gorhom/bottom-sheet';
import type MapView from 'react-native-maps';
import { Car, Clock } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { DarkGlass } from '../../components/DarkGlass';
import { HomeMap } from '../../components/HomeMap';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Chip } from '../../components/Chip';
import { Skeleton } from '../../components/Skeleton';
import { FloatingSearchCard } from '../../components/FloatingSearchCard';
import { SeatsConfirmSheet } from '../../components/SeatsConfirmSheet';
import { TimePickerSheet } from '../../components/TimePickerSheet';
import { IncomingRequests } from '../../components/IncomingRequests';
import { MatchedPassengers } from '../../components/MatchedPassengers';
import { DOCK_MARGIN, DOCK_HEIGHT } from '../../components/TabBar';
import { useSession } from '../../store/session';
import { useDriverRideDraft } from '../../store/driverRideDraft';
import { useDriverLive } from '../../store/driverLive';
import { getDriverStatus, type DriverStatus } from '../../lib/driver';
import { getMyActiveToken, cancelRideToken, createRideToken, getMyVehicle, type RideToken, type Vehicle } from '../../lib/rides';
import { getMatchedPassengers, subscribeMatchedRequests, type MatchedPassenger } from '../../lib/requests';
import { decodeRoute, currentPlace, getRoute, suggestedPrice, type Place, type Route } from '../../lib/maps';
import { formatDepart } from '../../lib/format';

// Map-first driver home (PRODUCT_MEMORY "Driver Mode": the map remains, the
// sheet transforms — this tab should feel like the same stitched surface as
// Passenger, not a separate screen). Own HomeMap instance (not a single map
// instance shared across tabs — that's a bigger navigation-shell change,
// tracked separately); ride-status data-loading logic below is unchanged.
//
// Posting a ride is now inline here (pickup/drop on the map + a seats-only
// confirm), replacing the old separate /ride/post form screen — mirrors
// Passenger's exact search flow structurally: FloatingSearchCard for
// pickup/drop, a "When" row + one CTA in the persistent sheet, a confirm
// drawer for the one remaining choice (seats, not price — price is
// auto-suggested from distance, same as before, just not editable here).
const DEFAULT_REGION = { latitude: 19.076, longitude: 72.8777, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const SHEET_SNAP_POINTS = [220, 560];

function regionFor(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.6 + 0.02,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.6 + 0.02,
  };
}

export default function Driver() {
  const profile = useSession((s) => s.profile);
  const refreshProfile = useSession((s) => s.refreshProfile);
  const [status, setStatus] = useState<DriverStatus | null>(null);
  const [token, setToken] = useState<RideToken | null>(null);
  const [matched, setMatched] = useState<MatchedPassenger[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const p = useSession.getState().profile;
    if (!p) return;
    const [d, t] = await Promise.all([
      getDriverStatus(p.id),
      p.is_driver_verified ? getMyActiveToken(p.id) : Promise.resolve(null),
    ]);
    setStatus(d.status);
    setToken(t);
    setMatched(t ? await getMatchedPassengers(t.id) : []);
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      refreshProfile().then(() => {
        if (alive) refresh();
      });
      return () => {
        alive = false;
      };
    }, [refreshProfile, refresh])
  );

  // Realtime: a passenger cancelling a matched ride flips their ride_requests
  // row to 'cancelled' -> re-run refresh so the stale card drops without a
  // manual refocus (BUG 3).
  useEffect(() => {
    if (!profile?.id) return;
    return subscribeMatchedRequests(profile.id, refresh);
  }, [profile?.id, refresh]);

  async function onCancel() {
    if (!token) return;
    setBusy(true);
    try {
      await cancelRideToken(token.id);
      setToken(null);
    } finally {
      setBusy(false);
    }
  }

  // Lock the other tabs while a ride is live (store/driverLive) so the driver
  // can't switch to Passenger and request their own ride.
  const setLive = useDriverLive((s) => s.setLive);
  useEffect(() => {
    setLive(!!token);
  }, [token, setLive]);

  // Live ride -> open the sheet expanded so the whole live card (incoming
  // requests, matched passengers, and the Cancel ride button) is reachable; at
  // the collapsed snap the Cancel button sat below the fold, hidden behind the
  // dock with nothing signalling the sheet could be dragged up.
  const sheetRef = useRef<ElementRef<typeof BottomSheet>>(null);
  useEffect(() => {
    sheetRef.current?.snapToIndex(token ? 1 : 0);
  }, [token]);

  // --- Map-first presentation ---
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Place | null>(null);
  // The Driver tab mounts lazily (first tab switch), so its native map is often
  // still initializing when currentLocation/origin resolve — a camera move then
  // is dropped, stranding the view at DEFAULT_REGION. Gate the camera effect on
  // this and it re-runs the move the moment the map is ready.
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    currentPlace().then(setCurrentLocation);
  }, []);

  // --- Posting flow (only relevant once verified & no live token) ---
  const { origin, dest, reset: resetDraft } = useDriverRideDraft();
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [seats, setSeats] = useState(3);
  const [price, setPrice] = useState(60);
  const [now, setNow] = useState(true);
  const [when, setWhen] = useState(() => new Date(Date.now() + 10 * 60_000));
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [startBusy, setStartBusy] = useState(false);
  const seatSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const whenSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);

  // Fresh start each time the driver has no live ride to post one — mirrors
  // passenger.tsx's mount-only reset (not on every focus, so returning from
  // the location-picker modal doesn't wipe what was just picked).
  useEffect(() => {
    resetDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (profile?.is_driver_verified) {
      getMyVehicle(profile.id).then((v) => {
        setVehicle(v);
        if (v) setSeats(Math.min(v.seats, 6));
      });
    }
  }, [profile?.id, profile?.is_driver_verified]);

  // Auto-fill origin with current location once, same idiom as Passenger's
  // auto-pickup (only while there's no live token and nothing picked yet).
  useEffect(() => {
    if (!token && !origin && currentLocation) {
      useDriverRideDraft.getState().setPlace('origin', currentLocation);
    }
  }, [token, origin, currentLocation]);

  useEffect(() => {
    if (!origin || !dest) {
      setRoute(null);
      return;
    }
    getRoute(origin, dest).then((r) => {
      setRoute(r);
      setPrice(suggestedPrice(r.distanceKm));
    });
  }, [origin, dest]);

  const path = useMemo(() => (token ? decodeRoute(token.route_polyline) : undefined), [token?.route_polyline]);
  const routeA = path?.[0];
  const routeB = path && path.length > 0 ? path[path.length - 1] : undefined;

  // Camera follows: a live token's route > the in-progress pickup/drop draft >
  // just-picked origin > current location. Mirrors passenger.tsx's structure.
  useEffect(() => {
    if (!mapReady) return; // wait for the native map, or the move is dropped
    if (token && routeA && routeB) {
      mapRef.current?.animateToRegion(regionFor(routeA, routeB), 700);
    } else if (origin && dest) {
      mapRef.current?.animateToRegion(regionFor(origin, dest), 700);
    } else if (origin) {
      mapRef.current?.animateToRegion(
        { latitude: origin.latitude, longitude: origin.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
        600
      );
    } else if (currentLocation) {
      mapRef.current?.animateToRegion(
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        600
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, token?.id, origin, dest, currentLocation?.label]);

  function pickWhen() {
    whenSheetRef.current?.present();
  }

  function openSeatsConfirm() {
    setFormError(null);
    if (!origin || !dest) return setFormError('Set your pickup and destination.');
    if (!vehicle) return setFormError('Add a vehicle in your profile first.');
    if (!route) return setFormError('Still getting the route — try again in a moment.');
    setConfirmError(null);
    seatSheetRef.current?.present();
  }

  async function confirmStartRide() {
    setConfirmError(null);
    setStartBusy(true);
    try {
      const departAt = now ? new Date() : when;
      // Only a *scheduled* time must be in the future. For "now", departAt is
      // captured a few ms before this check, so guarding it would always fail.
      if (!now && departAt.getTime() <= Date.now()) throw new Error('Pick a departure time in the future.');
      await createRideToken({
        driverId: profile!.id,
        vehicleId: vehicle!.id,
        origin: origin!,
        dest: dest!,
        routePolyline: route!.encoded,
        departAt,
        seats,
        pricePerSeat: price,
      });
      resetDraft();
      seatSheetRef.current?.dismiss();
      await refresh();
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setStartBusy(false);
    }
  }

  const dockFootprint = insets.bottom + DOCK_MARGIN + DOCK_HEIGHT + spacing.md;
  const topOffset = insets.top + spacing.md;

  // Stable object/array identities — recreating either every render makes
  // react-native-maps re-apply them via the native bridge on every re-render
  // (subscriptions, focus effects fire often), a real jank source.
  const mapPadding = useMemo(
    () => ({
      top: topOffset + headerHeight + spacing.md,
      bottom: dockFootprint + SHEET_SNAP_POINTS[0],
      left: 0,
      right: 0,
    }),
    [topOffset, headerHeight, dockFootprint]
  );

  const posting = !!profile?.is_driver_verified && !loading && !token;
  // Memoized on route.encoded (not on every render) — same reason as `path`
  // above: decodeRoute allocates a new array each call.
  const draftPath = useMemo(() => (route ? decodeRoute(route.encoded) : undefined), [route?.encoded]);
  const mapPickup = token && routeA ? routeA : posting && origin ? origin : null;
  const mapDrop = token && routeB ? routeB : posting && dest ? dest : null;
  const mapPath = token ? path : posting ? draftPath : undefined;

  return (
    <View style={{ flex: 1 }}>
      <HomeMap
        ref={mapRef}
        initialRegion={DEFAULT_REGION}
        // Matches passenger.tsx's exact gate (!pickup && currentLocation) — an
        // earlier extra `!posting` condition here could go false (loading
        // resolves) BEFORE `origin` auto-filled (geolocation resolves at its
        // own pace), leaving a window with neither marker shown and a visibly
        // different transition than Passenger's. `!origin` alone is the
        // correct, equivalent condition; `!token` is still needed since Driver
        // (unlike Passenger) renders the live-ride state in this same component
        // rather than an early return.
        currentLocation={!token && !origin && currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null}
        pickup={mapPickup}
        drop={mapDrop}
        path={mapPath}
        mapPadding={mapPadding}
        recenterBottomOffset={dockFootprint + SHEET_SNAP_POINTS[0] + spacing.md}
        onReady={() => setMapReady(true)}
      />

      {/* Floating header — pickup/drop picker while posting (the literal same
          component Passenger uses, just relabeled), otherwise a simple
          title+avatar row. Solid dark glass either way, matching the tab bar. */}
      <View
        style={{ position: 'absolute', top: topOffset, left: 0, right: 0 }}
        className="px-6"
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        {posting ? (
          <FloatingSearchCard
            title="Post a ride"
            pickupLabel={origin?.label}
            dropLabel={dest?.label}
            onPressPickup={() => router.push('/modal/location-picker?field=origin&role=driver')}
            onPressDrop={() => router.push('/modal/location-picker?field=dest&role=driver')}
          />
        ) : (
          <DarkGlass className="flex-row items-center justify-between px-4 py-3" radius={24}>
            <View>
              <Text className="text-muted text-xs">Driver</Text>
              <Text className="text-text text-lg font-bold">
                {token ? 'Live' : status === 'pending' ? 'Under review' : 'Driver'}
              </Text>
            </View>
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              className="active:opacity-70"
            >
              <Avatar name={profile?.full_name ?? 'Meau'} uri={profile?.photo_url} size={40} />
            </Pressable>
          </DarkGlass>
        )}
      </View>

      {/* Persistent sheet — same non-modal BottomSheet + dock-clearance pattern
          as passenger.tsx. Content transforms per state; the map never remounts. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: dockFootprint }}>
        <BottomSheet
          ref={sheetRef}
          snapPoints={SHEET_SNAP_POINTS}
          index={0}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          backgroundStyle={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
          }}
          handleIndicatorStyle={{ backgroundColor: colors.glassBorder }}
        >
          <BottomSheetScrollView contentContainerClassName="px-6 pt-2 pb-8 gap-4">
            {!profile?.is_driver_verified ? (
              status === 'pending' ? (
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
              )
            ) : loading ? (
              <TokenCardSkeleton />
            ) : token ? (
              <>
                <IncomingRequests driverId={profile.id} onMatched={refresh} />
                <MatchedPassengers passengers={matched} />
                <ActiveTokenCard token={token} onCancel={onCancel} busy={busy} />
              </>
            ) : (
              <View className="gap-4">
                <View className="gap-2">
                  <Text className="text-sm text-muted">When</Text>
                  <View className="flex-row items-center gap-2">
                    <Chip label="Now" selected={now} onPress={() => setNow(true)} />
                    <Pressable onPress={pickWhen} accessibilityRole="button" className="flex-1">
                      <View
                        className={`flex-row items-center gap-2 rounded-full px-4 py-2 border ${
                          !now ? 'bg-accent border-accent' : 'bg-surface2 border-surface2'
                        }`}
                      >
                        <Clock color={now ? colors.text : colors.bg} size={16} />
                        <Text className={`text-sm font-medium ${now ? 'text-text' : 'text-bg'}`}>
                          {now ? 'Pick a time' : formatDepart(when)}
                        </Text>
                      </View>
                    </Pressable>
                  </View>
                </View>

                {formError ? <Text className="text-danger text-sm">{formError}</Text> : null}

                <Button label="Start ride" onPress={openSeatsConfirm} />
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>

      <SeatsConfirmSheet
        ref={seatSheetRef}
        seats={seats}
        onSeatsChange={setSeats}
        maxSeats={vehicle ? Math.min(vehicle.seats, 6) : 6}
        onConfirm={confirmStartRide}
        loading={startBusy}
        error={confirmError}
      />

      <TimePickerSheet
        ref={whenSheetRef}
        onConfirm={(d) => {
          setWhen(d);
          setNow(false);
          whenSheetRef.current?.dismiss();
        }}
      />
    </View>
  );
}

function ActiveTokenCard({
  token,
  onCancel,
  busy,
}: {
  token: RideToken;
  onCancel: () => void;
  busy: boolean;
}) {
  // No embedded MapPreview here — the background map already shows this exact
  // route, so a second small map would be a redundant "map inside a map."
  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Badge label="● LIVE" tone="success" />
        <Text className="text-text text-base font-bold tabular-nums">₹{token.price_per_seat}/seat</Text>
      </View>

      <View className="gap-1">
        <Text className="text-text text-base" numberOfLines={1}>
          {token.origin_label}
        </Text>
        <Text className="text-muted text-xs">to</Text>
        <Text className="text-text text-base" numberOfLines={1}>
          {token.dest_label}
        </Text>
      </View>

      <View className="flex-row justify-between">
        <Info label="Departs" value={formatDepart(token.depart_at)} />
        <Info label="Seats left" value={`${token.seats_left}/${token.seats_total}`} />
      </View>

      <Button label="Cancel ride" variant="secondary" loading={busy} onPress={onCancel} />
    </Card>
  );
}

function TokenCardSkeleton() {
  return (
    <Card className="gap-4">
      <View className="flex-row items-center justify-between">
        <Skeleton width={70} height={20} radius={10} />
        <Skeleton width={64} height={20} radius={6} />
      </View>
      <View className="gap-2">
        <Skeleton width="80%" height={16} />
        <Skeleton width="30%" height={12} />
        <Skeleton width="60%" height={16} />
      </View>
      <View className="flex-row justify-between">
        <Skeleton width={80} height={32} />
        <Skeleton width={80} height={32} />
      </View>
      <Skeleton height={48} radius={12} />
    </Card>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-muted text-xs">{label}</Text>
      <Text className="text-text text-sm font-medium tabular-nums">{value}</Text>
    </View>
  );
}
