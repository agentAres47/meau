import { forwardRef, useRef, useState } from 'react';
import { StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, type LatLng, type Region } from 'react-native-maps';
import { LocateFixed } from 'lucide-react-native';
import { colors } from '../theme/tokens';
import { DARK_MAP_STYLE } from '../lib/mapStyle';
import { CurrentLocationMarker, PickupMarker, DestinationMarker } from './MapMarkers';
import { DarkGlass } from './DarkGlass';
import { currentCoords } from '../lib/maps';

type Props = {
  initialRegion: Region;
  currentLocation?: LatLng | null;
  pickup?: LatLng | null;
  drop?: LatLng | null;
  path?: LatLng[];
  // Insets the map's "logical" viewport (Google's own camera/label layout
  // respects this) so labels and the default position/zoom controls don't
  // render underneath floating glass UI — the correct native fix for that,
  // rather than a manual overlay-avoidance hack.
  mapPadding?: { top: number; right: number; bottom: number; left: number };
  // How far above the bottom edge the recenter button floats — callers pass
  // their own sheet's collapsed height + a margin so it clears their
  // persistent bottom sheet (screen-specific, so it can't live in this
  // generic component).
  recenterBottomOffset?: number;
  // Fires once the native map finishes initializing. Callers that drive the
  // camera imperatively (animateToRegion) must wait for this — a move issued
  // before the native map exists is silently dropped, leaving the camera at
  // initialRegion (the "driver map is offset from my location" bug).
  onReady?: () => void;
  // The user dragged the map. Callers that animate the camera on a timer (the
  // passenger home's search drift) use this to stop: once someone has taken
  // hold of the map, moving it under them is the app fighting the user.
  onUserPan?: () => void;
  // Extra polylines drawn under the primary route — e.g. the currently
  // selected driver's path in the passenger's results.
  secondaryPath?: LatLng[];
};

// Full-screen interactive map — the canvas the passenger home screen floats
// its glass UI over. Static markers only (no live vehicle tracking, see
// REDESIGN_PLAN §Locked decisions); camera movement is driven imperatively
// by the parent via the forwarded MapView ref (animateToRegion).
export const HomeMap = forwardRef<MapView, Props>(function HomeMap(
  {
    initialRegion,
    currentLocation,
    pickup,
    drop,
    path,
    mapPadding,
    recenterBottomOffset = 24,
    onReady,
    onUserPan,
    secondaryPath,
  },
  forwardedRef
) {
  // react-native-maps (Android) crashes with a NullPointerException if a
  // mapPadding update is applied before the native GoogleMap object exists
  // (react-native-maps#5822 — a confirmed, still-unfixed upstream bug: our
  // padding is recomputed from onLayout state and updates almost immediately
  // after mount, racing the native map's async init). Withholding mapPadding
  // until onMapReady fires sidesteps the race entirely.
  const [mapReady, setMapReady] = useState(false);
  const [recentering, setRecentering] = useState(false);
  // Internal ref so the recenter button works regardless of whether/how the
  // parent also uses its own forwarded ref (both point at the same native view).
  const internalRef = useRef<MapView>(null);

  function setRefs(instance: MapView | null) {
    internalRef.current = instance;
    if (typeof forwardedRef === 'function') forwardedRef(instance);
    else if (forwardedRef) forwardedRef.current = instance;
  }

  async function recenter() {
    setRecentering(true);
    try {
      // Coordinate-only (no reverse geocode) + last-known fix — the camera only
      // needs lat/lng, so this returns near-instantly instead of waiting.
      const c = await currentCoords();
      if (c) {
        internalRef.current?.animateToRegion(
          { latitude: c.latitude, longitude: c.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 },
          500
        );
      }
    } finally {
      setRecentering(false);
    }
  }

  return (
    <>
      <MapView
        ref={setRefs}
        provider={PROVIDER_GOOGLE}
        customMapStyle={DARK_MAP_STYLE}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        mapPadding={mapReady ? mapPadding : undefined}
        onMapReady={() => {
          setMapReady(true);
          onReady?.();
        }}
        onPanDrag={onUserPan}
        showsUserLocation={false}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {secondaryPath && secondaryPath.length > 1 ? (
          <Polyline coordinates={secondaryPath} strokeColor={colors.success} strokeWidth={3} />
        ) : null}
        {path && path.length > 1 ? (
          <Polyline coordinates={path} strokeColor={colors.accent} strokeWidth={4} />
        ) : null}
        {currentLocation ? <CurrentLocationMarker coordinate={currentLocation} /> : null}
        {pickup ? <PickupMarker coordinate={pickup} /> : null}
        {drop ? <DestinationMarker coordinate={drop} /> : null}
      </MapView>

      {/* Recenter — same dark-glass surface as the other floating chrome,
          shared here so Passenger and Driver behave identically ("the map is
          the same for both"). */}
      <Pressable
        onPress={recenter}
        disabled={recentering}
        accessibilityRole="button"
        accessibilityLabel="Recenter on my location"
        className="active:opacity-70"
        style={{ position: 'absolute', right: 20, bottom: recenterBottomOffset }}
      >
        <DarkGlass
          radius={22}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          {recentering ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <LocateFixed color={colors.accent} size={20} />
          )}
        </DarkGlass>
      </Pressable>
    </>
  );
});
