import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, Marker, type LatLng } from 'react-native-maps';
import { colors } from '../theme/tokens';
import { DARK_MAP_STYLE } from '../lib/mapStyle';

type Props = {
  region: { latitude: number; longitude: number; latitudeDelta?: number; longitudeDelta?: number };
  path?: LatLng[];
  markers?: LatLng[];
  height?: number;
};

export function MapPreview({ region, path, markers, height = 160 }: Props) {
  return (
    <MapView
      provider={PROVIDER_GOOGLE}
      customMapStyle={DARK_MAP_STYLE}
      style={[styles.map, { height }]}
      initialRegion={{
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
        ...region,
      }}
      pointerEvents="none"
    >
      {path ? <Polyline coordinates={path} strokeColor={colors.accent} strokeWidth={3} /> : null}
      {markers?.map((m, i) => <Marker key={i} coordinate={m} />)}
    </MapView>
  );
}

const styles = StyleSheet.create({
  map: {
    width: '100%',
    borderRadius: 16,
  },
});
