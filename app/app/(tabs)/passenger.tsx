import { useCallback, useEffect, useMemo, useRef, useState, type ElementRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, useWindowDimensions } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Screen } from '../../components/Screen';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView, BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import Animated, { FadeIn, FadeInDown, FadeOut, FadeOutUp } from 'react-native-reanimated';
import type MapView from 'react-native-maps';
import type { LatLng } from 'react-native-maps';
import { Clock, ChevronLeft, Circle, MapPin, SearchX } from 'lucide-react-native';
import { colors, radius, spacing } from '../../theme/tokens';
import { Button } from '../../components/Button';
import { Chip } from '../../components/Chip';
import { HomeMap } from '../../components/HomeMap';
import { FloatingSearchCard } from '../../components/FloatingSearchCard';
import { FareConfirmSheet } from '../../components/FareConfirmSheet';
import { TimePickerSheet } from '../../components/TimePickerSheet';
import { SearchAura, PulseDot } from '../../components/SearchAura';
import { MatchCard } from '../../components/MatchCard';
import { DOCK_MARGIN, DOCK_HEIGHT } from '../../components/TabBar';
import { useSession } from '../../store/session';
import { useRideDraft } from '../../store/rideDraft';
import { useSearch } from '../../store/search';
import { getRoute, suggestedPrice, currentPlace, decodeRoute, type Place, type Route } from '../../lib/maps';
import {
  createRideRequest,
  matchRides,
  requestDrivers,
  cancelRequest,
  getActiveRequest,
  getMatchId,
  type ActiveRequest,
  type Match,
} from '../../lib/passenger';
import { arriveHaptic, selectionHaptic } from '../../lib/haptics';
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

  // A 'searching' request that THIS screen is already presenting in place (the
  // search/results choreography below) must not be bounced to the standalone
  // waiting screen — that would tear the user out of the very state they're
  // looking at, every time the tab regains focus.
  const presentedInline = active?.status === 'searching' && useSearch.getState().requestId === active.id;

  // dismissTo, not a declarative <Redirect>: Redirect performs a
  // replace()-equivalent navigation, which doesn't unwind this (tabs)
  // navigator when crossing into the nested `ride` stack — the tab dock
  // stayed mounted underneath, this screen kept regaining focus, and
  // useFocusEffect above kept re-firing loadActive() and re-redirecting: an
  // actual infinite bounce between this tab and the waiting/matched screen.
  useEffect(() => {
    if (active?.status === 'searching' && !presentedInline) {
      router.dismissTo(`/ride/waiting?rid=${active.id}`);
    } else if (active?.status === 'matched' && matchId) {
      router.dismissTo(`/ride/matched/${matchId}`);
    }
  }, [active, matchId, presentedInline]);

  if (active === undefined) {
    return (
      <Screen className="items-center justify-center" edges={['top']}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  // Mid-search → waiting screen (also gates re-requesting). Navigation itself
  // happens in the effect above; this is just what shows for the one frame
  // before it takes effect. Skipped when we're presenting that same search in
  // place — then the form below IS the live state.
  if (active?.status === 'searching' && !presentedInline) {
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

// One screen, three states. There is no navigation between them and no
// separate loading screen — the same map, the same search card and the same
// sheet carry the user from "compose a search" to "here are your rides".
type Phase = 'idle' | 'searching' | 'results';

const IDLE_SNAPS = [180, 320];
const SEARCHING_HEIGHT = 300;

// How wide the camera pulls back to while searching. Deliberately modest: far
// enough to show the neighbourhood being scanned, close enough that the roads
// you recognise are still legible, so the pull-back reads as "looking around
// you" rather than "leaving".
const SEARCH_DELTA = 0.075;
// The camera breathes between SEARCH_DELTA and this — about a 5% swing, a
// third of what it was. Enough that the map is never a still image, small
// enough that the pickup pin never appears to drift or lose its place.
const DRIFT_DELTA = SEARCH_DELTA * 1.05;

// Status lines advance on real elapsed time, so what the text claims and what
// is actually happening stay honest whether the search takes 1s or 15s. Each
// line names a step the matching service genuinely performs, in order: create
// the request, find live tokens whose route passes near both ends, then rank
// what's left by time and detour. The last line holds forever — a long wait
// gets an honest acknowledgement, never a fresh promise or an implied
// percentage. Nothing here claims progress the system isn't making.
const SEARCH_STAGES = [
  { after: 0, text: 'Reading your route' },
  { after: 2600, text: 'Finding verified students heading your way' },
  { after: 6200, text: 'Comparing detours and departure times' },
  { after: 11000, text: 'Still looking — this can take a moment' },
] as const;

function regionFor(a: Place, b: Place) {
  return {
    latitude: (a.latitude + b.latitude) / 2,
    longitude: (a.longitude + b.longitude) / 2,
    latitudeDelta: Math.abs(a.latitude - b.latitude) * 1.6 + 0.02,
    longitudeDelta: Math.abs(a.longitude - b.longitude) * 1.6 + 0.02,
  };
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Map-first passenger home: full-screen interactive map is the canvas: a
// floating glass search card (pickup/drop — still opens the existing
// location-picker modal, unchanged nav) sits on top, and a persistent glass
// bottom sheet floats over the bottom.
//
// Tapping "Find rides" opens the fare-confirm drawer; confirming there begins
// the search — and the search happens HERE, in place. The drawer descends, the
// sheet grows into it, the map pulls back around the pickup, the aura starts
// scanning, and when matches land the same sheet keeps growing into the
// results list. Nothing is pushed, nothing is unmounted, so there is never a
// frame where one screen left and another arrived.
function SearchForm() {
  const profile = useSession((s) => s.profile);
  const { origin: pickup, dest: drop, reset } = useRideDraft();
  const setResults = useSearch((s) => s.setResults);
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();

  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const fareSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);
  const whenSheetRef = useRef<ElementRef<typeof BottomSheetModal>>(null);

  const [currentLocation, setCurrentLocation] = useState<Place | null>(null);
  const [route, setRoute] = useState<Route | null>(null);
  const [searchCardHeight, setSearchCardHeight] = useState(0);
  const [now, setNow] = useState(true);
  const [when, setWhen] = useState(() => new Date(Date.now() + 10 * 60_000));
  const [offer, setOffer] = useState(60);
  const [formError, setFormError] = useState<string | null>(null);

  const [phase, setPhase] = useState<Phase>('idle');
  const [stage, setStage] = useState(0);
  // Split from `phase` on purpose: the aura starts decaying BEFORE the sheet
  // climbs into the results, so the two motions overlap instead of queueing.
  // It stays mounted through the decay — the loops are never cut mid-stroke.
  const [auraMounted, setAuraMounted] = useState(false);
  const [auraActive, setAuraActive] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [previewToken, setPreviewToken] = useState<string | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Bumped on every begin/abandon; an in-flight search compares against it
  // after each await so a cancelled search can't resurrect itself as results.
  const searchToken = useRef(0);
  const userPanned = useRef(false);

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

  // Camera + route preview follow whichever of pickup/drop are set — but only
  // while composing. Once a search is underway the choreography owns the
  // camera, and a stray re-frame here would fight it.
  useEffect(() => {
    if (phase !== 'idle') return;
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
  }, [pickup, drop, phase]);

  // The `index` prop alone is enough in principle, but it changes in the same
  // render as `snapPoints` — belt-and-braces so the climb into the results can
  // never be lost to that ordering.
  useEffect(() => {
    if (phase === 'results') sheetRef.current?.snapToIndex(1);
  }, [phase]);

  // Status lines, driven by elapsed time rather than by fake progress.
  useEffect(() => {
    if (phase !== 'searching') return;
    const start = Date.now();
    setStage(0);
    const t = setInterval(() => {
      const ms = Date.now() - start;
      let i = 0;
      while (i + 1 < SEARCH_STAGES.length && ms >= SEARCH_STAGES[i + 1].after) i++;
      setStage(i);
    }, 400);
    return () => clearInterval(t);
  }, [phase]);

  // The slowest beat in the loop: the camera itself breathes, alternating
  // between two near-identical framings. This is deliberately at the edge of
  // perception — you should not catch the map moving, only notice it isn't
  // dead. A long ease (5.2s) into a long hold does that; a shorter, larger
  // move reads as the map sliding around under the pin.
  //
  // Each leg is a slightly different length and settles on a slightly
  // different framing, so the breath is never metronomic. Stops the moment the
  // user takes hold of the map themselves.
  useEffect(() => {
    if (phase !== 'searching' || !pickup) return;
    let cancelled = false;
    let wide = false;
    let timer: ReturnType<typeof setTimeout>;

    const step = () => {
      timer = setTimeout(() => {
        if (cancelled) return;
        if (!userPanned.current) {
          wide = !wide;
          // Never exactly the same framing twice.
          const jitter = (Math.random() - 0.5) * 0.0015;
          const d = (wide ? DRIFT_DELTA : SEARCH_DELTA) + jitter;
          mapRef.current?.animateToRegion(
            { latitude: pickup.latitude, longitude: pickup.longitude, latitudeDelta: d, longitudeDelta: d },
            5200
          );
        }
        step();
      }, 11000 + Math.random() * 4000);
    };
    step();

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase, pickup]);

  function pickWhen() {
    whenSheetRef.current?.present();
  }

  function openFareConfirm() {
    setFormError(null);
    if (!pickup || !drop) return setFormError('Set your pickup and drop.');
    fareSheetRef.current?.present();
  }

  // ── Phase 1: enter the search ──────────────────────────────────────────
  // Every element moves at once and in the same direction: the drawer leaves
  // downward, the sheet grows upward into the space it vacates, the camera
  // eases outward, the aura blooms from the centre the camera is holding.
  async function beginSearch() {
    if (!pickup || !drop || !profile) return;
    const token = ++searchToken.current;
    selectionHaptic();
    fareSheetRef.current?.dismiss();

    // Retrying after a failure must not leave the first attempt's row sitting
    // in 'searching' forever — that row would outlive the screen and drag the
    // user to the waiting screen on their next visit.
    const stale = requestId;
    if (stale) cancelRequest(stale).catch(() => {});
    setRequestId(null);

    userPanned.current = false;
    setSearchError(null);
    setMatches([]);
    setSelected(new Set());
    setPreviewToken(null);
    setPhase('searching');
    setAuraMounted(true);
    setAuraActive(true);
    mapRef.current?.animateToRegion(
      {
        latitude: pickup.latitude,
        longitude: pickup.longitude,
        latitudeDelta: SEARCH_DELTA,
        longitudeDelta: SEARCH_DELTA,
      },
      2200
    );

    // ── Phase 2: the searching loop runs for exactly as long as this takes ──
    try {
      const rid = await createRideRequest({
        passengerId: profile.id,
        pickup,
        drop,
        desiredTime: now ? new Date() : when,
        offeredPrice: offer,
      });
      if (searchToken.current !== token) return;
      setRequestId(rid);
      // Publish early so the tab's active-request gate recognises this request
      // as one we're already showing, instead of redirecting to /ride/waiting.
      setResults({ requestId: rid, pickup, drop, offer, matches: [] });

      const found = await matchRides(rid);
      if (searchToken.current !== token) return;
      setResults({ requestId: rid, pickup, drop, offer, matches: found });
      await settle(found, token);
    } catch (e) {
      if (searchToken.current !== token) return;
      // Stay in the searching state and explain — dropping back to the form
      // would look like the search was never made.
      setSearchError(e instanceof Error ? e.message : 'Something went wrong.');
      setAuraActive(false);
    }
  }

  // ── Phase 3: exit the search into the results ──────────────────────────
  // Nothing is switched off. The aura begins its decay, the camera starts
  // travelling to the route, and only then does the sheet climb — so the
  // results arrive over motion that is already underway.
  async function settle(found: Match[], token: number) {
    arriveHaptic();
    setMatches(found);
    setAuraActive(false);
    if (pickup && drop && !userPanned.current) {
      mapRef.current?.animateToRegion(regionFor(pickup, drop), 900);
    }
    await wait(260);
    if (searchToken.current !== token) return;
    setPhase('results');
    setTimeout(() => setAuraMounted(false), 420);
  }

  // Back out of a search or its results: the request has to die with it,
  // otherwise the row sits in 'searching' forever and the tab's gate drags the
  // user to the waiting screen with no way back.
  function abandonSearch() {
    searchToken.current++;
    const rid = requestId;
    setAuraActive(false);
    setPhase('idle');
    setTimeout(() => setAuraMounted(false), 500);
    setRequestId(null);
    setMatches([]);
    setSelected(new Set());
    setPreviewToken(null);
    setSearchError(null);
    useSearch.getState().reset();
    if (pickup && drop) mapRef.current?.animateToRegion(regionFor(pickup, drop), 700);
    if (rid) cancelRequest(rid).catch(() => {});
  }

  function toggle(tokenId: string) {
    selectionHaptic();
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
    // The map is the preview: tapping a card draws that driver's route on the
    // one map already on screen.
    setPreviewToken((prev) => (prev === tokenId ? null : tokenId));
  }

  // F3 — fan out to every selected driver at once; the first to accept wins and
  // the rest auto-void (accept_ride_request dismisses sibling targets, and F7
  // push cancels the losers' notifications).
  async function requestSelected() {
    if (!requestId || selected.size === 0) return;
    setBusy(true);
    try {
      const n = selected.size;
      const rid = requestId;
      await requestDrivers(rid, [...selected]);
      // Waiting for a driver to accept is a genuinely different state (it can
      // outlive this screen, and arrives by push), so it keeps its own screen.
      // Leave the home in its resting state behind us.
      searchToken.current++;
      setPhase('idle');
      setAuraMounted(false);
      setRequestId(null);
      setMatches([]);
      setSelected(new Set());
      setPreviewToken(null);
      useSearch.getState().reset();
      router.push(`/ride/waiting?rid=${rid}&n=${n}`);
    } catch {
      setSearchError("Couldn't reach those drivers. Try again.");
    } finally {
      setBusy(false);
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

  const resultsHeight = Math.round(height * 0.66);
  const snapPoints = useMemo(() => {
    if (phase === 'searching') return [SEARCHING_HEIGHT];
    if (phase === 'results') return [SEARCHING_HEIGHT, resultsHeight];
    return IDLE_SNAPS;
  }, [phase, resultsHeight]);
  const sheetIndex = phase === 'results' ? 1 : 0;
  const sheetHeight = phase === 'idle' ? IDLE_SNAPS[0] : snapPoints[sheetIndex];

  // Stable identities for the two array/object props react-native-maps takes —
  // recreating either every render (decodeRoute allocates a new array; the
  // padding literal is a new object) makes the native view re-apply them via
  // the bridge on every re-render, a real jank source now that this screen
  // re-renders often (subscriptions, focus effects). Only recompute on actual
  // change.
  const path = useMemo(() => (route ? decodeRoute(route.encoded) : undefined), [route?.encoded]);
  const previewPath = useMemo(() => {
    const m = matches.find((x) => x.token_id === previewToken);
    return m ? decodeRoute(m.route_polyline) : undefined;
  }, [matches, previewToken]);

  const mapTop = topOffset + searchCardHeight + spacing.md;
  const mapPadding = useMemo(
    () => ({
      top: mapTop,
      // Clamped: at the results snap the sheet covers most of the screen, and
      // padding that leaves the map no usable viewport makes the native camera
      // misbehave. Better to let the route sit partly behind the sheet.
      bottom: Math.min(dockFootprint + sheetHeight, Math.max(0, height - mapTop - 200)),
      left: 0,
      right: 0,
    }),
    [mapTop, dockFootprint, sheetHeight, height]
  );

  // The aura is anchored to the optical centre of the map's PADDED viewport —
  // the exact point the camera centres the pickup on. It scans from where the
  // user is, and stays put while everything else moves around it.
  const auraCenterY = mapTop + (height - mapPadding.bottom - mapTop) / 2;
  const { width } = useWindowDimensions();

  const scanning = phase !== 'idle';

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
        secondaryPath={previewPath as LatLng[] | undefined}
        mapPadding={mapPadding}
        recenterBottomOffset={dockFootprint + sheetHeight + spacing.md}
        onUserPan={() => {
          userPanned.current = true;
        }}
      />

      {auraMounted ? (
        <SearchAura active={auraActive} centerX={width / 2} centerY={auraCenterY} />
      ) : null}

      <View
        style={{ position: 'absolute', top: topOffset, left: 0, right: 0 }}
        className="px-6"
        onLayout={(e) => setSearchCardHeight(e.nativeEvent.layout.height)}
      >
        <FloatingSearchCard
          pickupLabel={pickup?.label}
          dropLabel={drop?.label}
          scanning={scanning}
          onPressPickup={() => router.push('/modal/location-picker?field=origin')}
          onPressDrop={() => router.push('/modal/location-picker?field=dest')}
        />
      </View>

      <View pointerEvents="box-none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: dockFootprint }}>
        <BottomSheet
          ref={sheetRef}
          snapPoints={snapPoints}
          index={sheetIndex}
          enableDynamicSizing={false}
          enablePanDownToClose={false}
          backgroundStyle={{
            backgroundColor: colors.surface,
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
          }}
          handleIndicatorStyle={{ backgroundColor: colors.glassBorder }}
        >
          {phase === 'results' ? (
            <ResultsContent
              matches={matches}
              offer={offer}
              selected={selected}
              busy={busy}
              error={searchError}
              onToggle={toggle}
              onRequest={requestSelected}
              onBack={abandonSearch}
            />
          ) : (
            <BottomSheetView className="px-6 pt-2 pb-8 gap-4">
              {phase === 'idle' ? (
                <Animated.View
                  key="compose"
                  entering={FadeIn.duration(260).delay(80)}
                  exiting={FadeOutUp.duration(160)}
                  className="gap-4"
                >
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
                </Animated.View>
              ) : (
                <Animated.View
                  key="searching"
                  entering={FadeInDown.duration(320).delay(90)}
                  exiting={FadeOutUp.duration(180)}
                  className="gap-4"
                >
                  <View className="flex-row items-center gap-3">
                    <PulseDot />
                    <View className="flex-1">
                      <Text className="text-text text-lg font-bold">Finding your ride</Text>
                      {searchError ? (
                        <Text className="text-danger text-sm">{searchError}</Text>
                      ) : (
                        <Animated.Text
                          key={stage}
                          entering={FadeIn.duration(280)}
                          exiting={FadeOut.duration(160)}
                          className="text-muted text-sm"
                        >
                          {SEARCH_STAGES[stage].text}
                        </Animated.Text>
                      )}
                    </View>
                  </View>

                  {/* The pickup/drop you typed, restated as the thing being
                      searched — the inputs didn't disappear, they became the
                      subject. */}
                  <RouteSummary pickup={pickup} drop={drop} offer={offer} />

                  {searchError ? (
                    <View className="flex-row gap-3">
                      <Button label="Try again" onPress={beginSearch} className="flex-1" />
                      <Button label="Cancel" variant="secondary" onPress={abandonSearch} className="flex-1" />
                    </View>
                  ) : (
                    <Button label="Cancel search" variant="ghost" onPress={abandonSearch} />
                  )}
                </Animated.View>
              )}
            </BottomSheetView>
          )}
        </BottomSheet>
      </View>

      <FareConfirmSheet
        ref={fareSheetRef}
        offer={offer}
        onOfferChange={setOffer}
        onConfirm={beginSearch}
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

function RouteSummary({ pickup, drop, offer }: { pickup: Place | null; drop: Place | null; offer: number }) {
  return (
    <View className="bg-surface2 rounded-xl px-4 py-3 gap-2">
      <View className="flex-row items-center gap-3">
        <Circle color={colors.accent} size={12} />
        <Text className="text-text text-sm flex-1" numberOfLines={1}>
          {pickup?.label ?? 'Pickup'}
        </Text>
      </View>
      <View className="flex-row items-center gap-3">
        <MapPin color={colors.success} size={14} />
        <Text className="text-text text-sm flex-1" numberOfLines={1}>
          {drop?.label ?? 'Drop'}
        </Text>
        <Text className="text-muted text-xs tabular-nums">₹{offer}</Text>
      </View>
    </View>
  );
}

// The results are not a new screen — they are the same sheet, taller. The
// header keeps the same left-aligned weight the searching status had, so the
// eye doesn't have to re-find anything when the content changes underneath it.
function ResultsContent({
  matches,
  offer,
  selected,
  busy,
  error,
  onToggle,
  onRequest,
  onBack,
}: {
  matches: Match[];
  offer: number;
  selected: Set<string>;
  busy: boolean;
  error: string | null;
  onToggle: (tokenId: string) => void;
  onRequest: () => void;
  onBack: () => void;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Animated.View entering={FadeIn.duration(260)} className="px-6 pt-1 pb-2 flex-row items-center gap-1">
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back to search"
          className="w-9 h-9 -ml-2 items-center justify-center active:opacity-60"
        >
          <ChevronLeft color={colors.text} size={22} />
        </Pressable>
        <Text className="text-text text-lg font-bold flex-1">
          {matches.length ? `${matches.length} ride${matches.length > 1 ? 's' : ''} your way` : 'No rides your way'}
        </Text>
      </Animated.View>

      {matches.length === 0 ? (
        <Animated.View entering={FadeInDown.duration(320).delay(80)} className="px-6 items-center gap-3 pt-4">
          <View className="bg-surface2 rounded-full p-4">
            <SearchX color={colors.muted} size={26} />
          </View>
          <Text className="text-muted text-sm text-center">
            No live rides match your route and time right now. Try a wider departure time, or check back in a
            few minutes.
          </Text>
          <Button label="Back to search" variant="secondary" onPress={onBack} className="mt-1" />
        </Animated.View>
      ) : (
        <>
          <Text className="text-muted text-xs px-6 pb-1">
            Select one or more drivers — the first to accept gets you.
          </Text>
          {/* Explicit style, not className: NativeWind only maps
              contentContainerClassName for RN's own ScrollView. */}
          <BottomSheetScrollView
            contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32, gap: 16 }}
          >
            {matches.map((m, i) => (
              <MatchCard
                key={m.token_id}
                match={m}
                offer={offer}
                index={i}
                selected={selected.has(m.token_id)}
                onToggle={() => onToggle(m.token_id)}
              />
            ))}
          </BottomSheetScrollView>
          {error ? <Text className="text-danger text-sm px-6 pb-2">{error}</Text> : null}
          {selected.size > 0 ? (
            <Animated.View
              entering={FadeInDown.duration(260)}
              exiting={FadeOut.duration(160)}
              className="px-6 pt-2 pb-3 border-t border-surface2"
            >
              <Button
                label={`Request ${selected.size} driver${selected.size > 1 ? 's' : ''}`}
                loading={busy}
                onPress={onRequest}
              />
            </Animated.View>
          ) : null}
        </>
      )}
    </View>
  );
}
