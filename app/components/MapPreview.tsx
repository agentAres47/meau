import { StyleSheet } from 'react-native';
import MapView, { PROVIDER_GOOGLE, Polyline, Marker, type LatLng } from 'react-native-maps';

// Standard dark Google Maps style (compact variant). Revisit in the Phase 8
// polish pass if the product needs a bespoke palette match.
const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: '#161B22' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8A94A3' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#0E1116' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1F2630' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0E1116' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#161B22' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#1F2630' }] },
];

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
      {path ? <Polyline coordinates={path} strokeColor="#6C7BFF" strokeWidth={3} /> : null}
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
