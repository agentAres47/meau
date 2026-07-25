import { useCallback, useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { View, Text, Pressable, ActivityIndicator } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView, BottomSheetModal } from '@gorhom/bottom-sheet';
import type MapView from 'react-native-maps';
import { Clock } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { HomeMap } from '../../components/HomeMap';
import { FloatingSearchCard } from '../../components/FloatingSearchCard';
import { FareConfirmSheet } from '../../components/FareConfirmSheet';
import { TimePickerSheet } from '../../components/TimePickerSheet';
import { DOCK_MARGIN, DOCK_HEIGHT } from '../../components/TabBar';
import { useSession } from '../../store/session';
import { useRideDraft } from '../../store/rideDraft';
import { useSearch } from '../../store/search';
import { getRoute, suggestedPrice, currentPlace, decodeRoute, type Place, type Route } from '../../lib/maps';
import { createRideRequest, matchRides, getActiveRequest, getMatchId, type ActiveRequest } from '../../lib/passenger';
import { formatDepart } from '../../lib/format';

export default function Passenger() {
  const profile = useSession((s) => s.profile);
  const [active, setActive] = useState<ActiveRequest | null | undefined>(undefined);
  // undefined = resolving, null = failed after retries, string = ready (H2).
  const [matchId, setMatchId] = useState<string | null | undefined>(undefined);

  const loadActive = useCallback(async () => {
    if (!profile) return;
    const a = await getActiveRequest(profile.id);
    setActive(a);
    if (a?.status === 'matched') {
      // The match row can lag the request's status flip. Brief bounded retry so
      // we don't sit on an unbounded spinner if the first read is null (H2).
      let mid = await getMatchId(a.id);
      for (let i = 0; i < 3 && !mid; i++) {
        await new Promise((r) => setTimeout(r, 700));
        mid = await getMatchId(a.id);
      }
      setMatchId(mid ?? null);
    }
  }, [profile]);

  useFocusEffect(
    useCallback(() => {
      loadActive();
    }, [loadActive])
  );

  // dismissTo, not a declarative <Redirect>: Redirect performs a
  // replace()-equivalent navigation, which doesn't unwind this (tabs)
  // navigator when crossing into the nested `ride` stack — the tab dock
  // stayed mounted underneath, this screen kept regaining focus, and
  // useFocusEffect above kept re-firing loadActive() and re-redirecting: an
  // actual infinite bounce between this tab and the waiting/matched screen.
  useEffect(() => {
    if (active?.status === 'searching') {
      router.dismissTo(`/ride/waiting?rid=${active.id}`);
    } else if (active?.status === 'matched' && matchId) {
      router.dismissTo(`/ride/matched/${matchId}`);
    }
  }, [active, matchId]);

  if (active === undefined) {
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // Mid-search → waiting screen (also gates re-requesting). Navigation itself
  // happens in the effect above; this is just what shows for the one frame
  // before it takes effect.
  if (active?.status === 'searching') {
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // Matched → the shared matched-ride screen (same one the driver sees).
  if (active?.status === 'matched') {
    if (matchId === undefined) {
      return (
        <Screen className="items-center justify-center" edges={['top']}>
          <ActivityIndicator color={colors.accent} />
        </Screen>
      );
    }
    // Couldn't resolve the match after retries — offer a way out instead of an
    // endless spinner (H2).
    if (matchId === null) {
      return (
        <Screen className="items-center justify-center px-6 gap-4" edges={['top']}>
          <Text className="text-muted text-sm text-center">
            Couldn't open your matched ride. Please try again.
          </Text>
          <Button label="Retry" onPress={loadActive} />
        </Screen>
      );
    }
    // Navigation itself happens in the effect above.
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  return <SearchForm />;
}

// Fallback map center if location permission is denied/unavailable — Mumbai,
// wide enough to be a reasonable starting point rather than an empty ocean.
const DEFAULT_REGION = { latitude: 19.076, longitude: 72.8777, latitudeDelta: 0.15, longitudeDelta: 0.15 };
const SHEET_SNAP_POINTS = [180, 320];

function regionFor(a: Place, b: Place) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.6 + 0.02,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.6 + 0.02,
  };
}

// Map-first passenger home: full-screen interactive map is the canvas: a
// floating glass search card (pickup/drop — still opens the existing
// location-picker modal, unchanged nav) sits on top, and a persistent glass
// bottom sheet (When + Find rides) floats over the bottom. Tapping "Find
// rides" opens a separate fare-confirm drawer (offer slider) rather than
// searching immediately; only confirming there fires the actual request —
// same matching/backend logic as before, just re-presented.
function SearchForm() {
  const profile = useSession((s) => s.profile);
  const { origin: pickup, dest: drop, reset } = useRideDraft();
  const setResults = useSearch((s) => s.setResults);
  const insets = useSafeAreaInsets();

  const mapRef = useRef<MapView>(null);
  const fareSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const whenSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);

  const [currentLocation, setCurrentLocation] = useState<Place | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [searchCardHeight, setSearchCardHeight] = useState(0);
  const [now, setNow] = useState(true);
  const [when, setWhen] = useState(() => new Date(Date.now() + 10 * 60_000));
  const [offer, setOffer] = useState(60);
  const [loading, setLoading] = useState(false);
  // Separate error states so a search failure (shown in the fare-confirm
  // drawer) never bleeds through into the always-visible persistent sheet
  // behind it, and vice versa.
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Reset once on mount only — NOT on every focus. The location-picker modal
  // returns focus to this same (still-mounted) screen when it closes, and a
  // focus-effect reset here would wipe the just-picked location right back out.
  useEffect(() => {
    reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-fill pickup with the user's current location on open (Ola/Uber/
  // Google Maps behavior — the user should only need to choose a
  // destination). Also centers the map + drops the "you are here" marker.
  // Silently falls back to leaving pickup empty for manual selection if
  // permission is denied or location can't be resolved — never blocks the
  // screen. Reads the draft store's live state (not the closed-over
  // pickup/drop) since this effect's closure is fixed at the first render —
  // a remount with stale leftover draft state would otherwise read
  // pre-reset values here (same pattern as driver.tsx's getState() fix for
  // an analogous stale-closure issue).
  useEffect(() => {
    currentPlace().then((p) => {
      setCurrentLocation(p);
      if (!p) return;
      const draft = useRideDraft.getState();
      if (!draft.origin && !draft.dest) {
        useRideDraft.getState().setPlace('origin', p);
        mapRef.current?.animateToRegion(
          { latitude: p.latitude, longitude: p.longitude, latitudeDelta: 0.03, longitudeDelta: 0.03 },
          600
        );
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Camera + route preview follow whichever of pickup/drop are set.
  useEffect(() => {
    if (pickup && drop) {
      getRoute(pickup, drop).then((r) => {
        setOffer(suggestedPrice(r.distanceKm));
        setRoute(r);
      });
      mapRef.current?.animateToRegion(regionFor(pickup, drop), 700);
    } else {
      setRoute(null);
      if (pickup) {
        mapRef.current?.animateToRegion(
          { latitude: pickup.latitude, longitude: pickup.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          600
        );
      }
    }
  }, [pickup, drop]);

  function pickWhen() {
    whenSheetRef.current?.present();
  }

  function openFareConfirm() {
    setFormError(null);
    if (!pickup || !drop) return setFormError('Set your pickup and drop.');
    setConfirmError(null);
    fareSheetRef.current?.present();
  }

  async function confirmAndFindRides() {
    setConfirmError(null);
    setLoading(true);
    try {
      const desiredTime = now ? new Date() : when;
      const requestId = await createRideRequest({
        passengerId: profile!.id,
        pickup: pickup!,
        drop: drop!,
        desiredTime,
        offeredPrice: offer,
      });
      const matches = await matchRides(requestId);
      setResults({ requestId, pickup: pickup!, drop: drop!, offer, matches });
      fareSheetRef.current?.dismiss();
      router.push('/ride/search-results');
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  }

  // The floating dock (TabBar) is rendered by the outer Tab Navigator, OUTSIDE
  // this screen's own tree, and stacks visually on top of it — so the sheet's
  // own bottom content (the "Find rides" button) could otherwise end up
  // sitting underneath the dock. Fix: constrain the View that WRAPS
  // <BottomSheet> to stop short of the dock's footprint. BottomSheet
  // auto-measures its own container via onLayout when no explicit height is
  // given, so a wrapper with a definite (non-flex) height — via top:0 +
  // bottom:dockFootprint on an absolutely positioned view — is all it needs
  // to correctly treat "the dock's top edge" as its own floor.
  // (BottomSheet's `bottomInset` prop does NOT do this — traced through the
  // library source: it only affects modal/detached sheets, a no-op for the
  // plain non-modal <BottomSheet> used here.)
  const dockFootprint = insets.bottom + DOCK_MARGIN + DOCK_HEIGHT + spacing.md;
  const topOffset = insets.top + spacing.md;

  // Stable identities for the two array/object props react-native-maps takes —
  // recreating either every render (decodeRoute allocates a new array; the
  // padding literal is a new object) makes the native view re-apply them via
  // the bridge on every re-render, a real jank source now that this screen
  // re-renders often (subscriptions, focus effects). Only recompute on actual
  // change.
  const path = useMemo(() => (route ? decodeRoute(route.encoded) : undefined), [route?.encoded]);
  const mapPadding = useMemo(
    () => ({
      top: topOffset + searchCardHeight + spacing.md,
      bottom: dockFootprint + SHEET_SNAP_POINTS[0],
      left: 0,
      right: 0,
    }),
    [topOffset, searchCardHeight, dockFootprint]
  );

  return (
    <View style={{ flex: 1 }}>
      <HomeMap
        ref={mapRef}
        initialRegion={DEFAULT_REGION}
        // Suppress the "you are here" marker once pickup is set — pickup is
        // auto-filled FROM current location, so both would otherwise render
        // stacked on the identical coordinate (the two markers' differing
        // sizes create a visible stray edge where one peeks out from behind
        // the other). Once there's an explicit pickup marker, it's the
        // relevant reference point; a redundant "current location" dot
        // underneath it is just clutter anyway.
        currentLocation={!pickup && currentLocation ? { latitude: currentLocation.latitude, longitude: currentLocation.longitude } : null}
        pickup={pickup ? { latitude: pickup.latitude, longitude: pickup.longitude } : null}
        drop={drop ? { latitude: drop.latitude, longitude: drop.longitude } : null}
        path={path}
        mapPadding={mapPadding}
        recenterBottomOffset={dockFootprint + SHEET_SNAP_POINTS[0] + spacing.md}
      />

      <View
        style={{ position: 'absolute', top: topOffset, left: 0, right: 0 }}
        className="px-6"
        onLayout={(e) => setSearchCardHeight(e.nativeEvent.layout.height)}
      >
        <FloatingSearchCard
          pickupLabel={pickup?.label}
          dropLabel={drop?.label}
          onPressPickup={() => router.push('/modal/location-picker?field=origin')}
          onPressDrop={() => router.push('/modal/location-picker?field=dest')}
        />
      </View>

      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: dockFootprint }}>
        <BottomSheet
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
          <BottomSheetView className="px-6 pt-2 pb-8 gap-4">
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

            <Button label="Find rides" onPress={openFareConfirm} />
          </BottomSheetView>
        </BottomSheet>
      </View>

      <FareConfirmSheet
        ref={fareSheetRef}
        offer={offer}
        onOfferChange={setOffer}
        onConfirm={confirmAndFindRides}
        loading={loading}
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
