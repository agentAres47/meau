import { forwardRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, type LatLng, type Region } from 'react-native-maps';
import { colors } from '../theme/tokens';
import { DARK_MAP_STYLE } from '../lib/mapStyle';
import { CurrentLocationMarker, PickupMarker, DestinationMarker } from './MapMarkers';

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
};

// Full-screen interactive map — the canvas the passenger home screen floats
// its glass UI over. Static markers only (no live vehicle tracking, see
// REDESIGN_PLAN §Locked decisions); camera movement is driven imperatively
// by the parent via the forwarded MapView ref (animateToRegion).
export const HomeMap = forwardRef<MapView, Props>(function HomeMap(
  { initialRegion, currentLocation, pickup, drop, path, mapPadding },
  ref
) {
  // react-native-maps (Android) crashes with a NullPointerException if a
  // mapPadding update is applied before the native GoogleMap object exists
  // (react-native-maps#5822 — a confirmed, still-unfixed upstream bug: our
  // padding is recomputed from onLayout state and updates almost immediately
  // after mount, racing the native map's async init). Withholding mapPadding
  // until onMapReady fires sidesteps the race entirely.
  const [mapReady, setMapReady] = useState(false);

  return (
    <MapView
      ref={ref}
      provider={PROVIDER_GOOGLE}
      customMapStyle={DARK_MAP_STYLE}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
      mapPadding={mapReady ? mapPadding : undefined}
      onMapReady={() => setMapReady(true)}
      showsUserLocation={false}
      showsMyLocationButton={false}
      showsCompass={false}
      toolbarEnabled={false}
    >
      {path && path.length > 1 ? (
        <Polyline coordinates={path} strokeColor={colors.accent} strokeWidth={4} />
      ) : null}
      {currentLocation ? <CurrentLocationMarker coordinate={currentLocation} /> : null}
      {pickup ? <PickupMarker coordinate={pickup} /> : null}
      {drop ? <DestinationMarker coordinate={drop} /> : null}
    </MapView>
  );
});
