import { forwardRef } from 'react';
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
};

// Full-screen interactive map — the canvas the passenger home screen floats
// its glass UI over. Static markers only (no live vehicle tracking, see
// REDESIGN_PLAN §Locked decisions); camera movement is driven imperatively
// by the parent via the forwarded MapView ref (animateToRegion).
export const HomeMap = forwardRef<MapView, Props>(function HomeMap(
  { initialRegion, currentLocation, pickup, drop, path },
  ref
) {
  return (
    <MapView
      ref={ref}
      provider={PROVIDER_GOOGLE}
      customMapStyle={DARK_MAP_STYLE}
      style={StyleSheet.absoluteFill}
      initialRegion={initialRegion}
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
