import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import type MapView from 'react-native-maps';
import { Car, Clock } from 'lucide-react-native';
import { colors, darkGlass, radius, spacing } from '../../theme/tokens';
import { HomeMap } from '../../components/HomeMap';
import { Avatar } from '../../components/Avatar';
import { EmptyState } from '../../components/EmptyState';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Skeleton } from '../../components/Skeleton';
import { IncomingRequests } from '../../components/IncomingRequests';
import { MatchedPassengers } from '../../components/MatchedPassengers';
import { DOCK_MARGIN, DOCK_HEIGHT } from '../../components/TabBar';
import { useSession } from '../../store/session';
import { getDriverStatus, type DriverStatus } from '../../lib/driver';
import { getMyActiveToken, cancelRideToken, type RideToken } from '../../lib/rides';
import { getMatchedPassengers, subscribeMatchedRequests, type MatchedPassenger } from '../../lib/requests';
import { decodeRoute, currentPlace, type Place } from '../../lib/maps';
import { formatDepart } from '../../lib/format';

// Map-first driver home (PRODUCT_MEMORY "Driver Mode": the map remains, the
// sheet transforms — this tab should feel like the same stitched surface as
// Passenger, not a separate screen). Own HomeMap instance (not a single map
// instance shared across tabs — that's a bigger navigation-shell change,
// tracked separately); data-loading logic below is unchanged from before.
const DEFAULT_REGION = { latitude: 19.076, longitude: 72.8777, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const SHEET_SNAP_POINTS = [220, 560];

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

  // --- Map-first presentation (new) ---
  const mapRef = useRef<MapView>(null);
  const insets = useSafeAreaInsets();
  const [headerHeight, setHeaderHeight] = useState(0);
  const [currentLocation, setCurrentLocation] = useState<Place | null>(null);

  // Silent, best-effort — same idiom as passenger.tsx's auto-pickup. Only used
  // to center the map when there's no active route to show instead.
  useEffect(() => {
    currentPlace().then(setCurrentLocation);
  }, []);

  const path = token ? decodeRoute(token.route_polyline) : undefined;
  const routeA = path?.[0];
  const routeB = path && path.length > 0 ? path[path.length - 1] : undefined;

  useEffect(() => {
    if (routeA && routeB) {
      mapRef.current?.animateToRegion(
        {
          latitude: (routeA.latitude + routeB.latitude) / 2,
          longitude: (routeA.longitude + routeB.longitude) / 2,
          latitudeDelta: Math.abs(routeA.latitude - routeB.latitude) * 1.6 + 0.02,
          longitudeDelta: Math.abs(routeA.longitude - routeB.longitude) * 1.6 + 0.02,
        },
        700
      );
    } else if (currentLocation) {
      mapRef.current?.animateToRegion(
        { latitude: currentLocation.latitude, longitude: currentLocation.longitude, latitudeDelta: 0.05, longitudeDelta: 0.05 },
        600
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token?.id, currentLocation?.label]);

  const dockFootprint = insets.bottom + DOCK_MARGIN + DOCK_HEIGHT + spacing.md;
  const topOffset = insets.top + spacing.md;

  return (
    <View style={{ flex: 1 }}>
      <HomeMap
        ref={mapRef}
        initialRegion={DEFAULT_REGION}
        currentLocation={!token && currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null}
        pickup={token && routeA ? routeA : null}
        drop={token && routeB ? routeB : null}
        path={token ? path : undefined}
        mapPadding={{
          top: topOffset + headerHeight + spacing.md,
          bottom: dockFootprint + SHEET_SNAP_POINTS[0],
          left: 0,
          right: 0,
        }}
      />

      {/* Floating header — mirrors FloatingSearchCard's treatment (solid dark
          glass, not translucent, so it never shows the map "through" it). */}
      <View
        style={{ position: 'absolute', top: topOffset, left: 0, right: 0 }}
        className="px-6"
        onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}
      >
        <View
          className="flex-row items-center justify-between px-4 py-3"
          style={[darkGlass, { borderRadius: 24 }]}
        >
          <View>
            <Text className="text-muted text-xs">Offer a ride</Text>
            <Text className="text-text text-lg font-bold">Driver</Text>
          </View>
          <Pressable
            onPress={() => router.push('/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            className="active:opacity-70"
          >
            <Avatar name={profile?.full_name ?? 'Meau'} uri={profile?.photo_url} size={40} />
          </Pressable>
        </View>
      </View>

      {/* Persistent sheet — same non-modal BottomSheet + dock-clearance pattern
          as passenger.tsx. Content transforms per state; the map never remounts. */}
      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: dockFootprint }}>
        <BottomSheet
          snapPoints={SHEET_SNAP_POINTS}
          index={0}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          backgroundStyle={{
            backgroundColor: darkGlass.backgroundColor,
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
              <View className="items-center gap-6 py-4">
                <EmptyState
                  icon={Car}
                  title="No live ride"
                  description="Post a ride and it stays live until a passenger matches or it departs."
                />
                <Button label="Post a ride" onPress={() => router.push('/ride/post')} />
              </View>
            )}
          </BottomSheetScrollView>
        </BottomSheet>
      </View>
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
  // No embedded MapPreview here anymore — the background map already shows
  // this exact route, so a second small map would be a redundant "map inside
  // a map" (decluttering per the same instinct that removed the old prompt-
  // centric empty state).
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
