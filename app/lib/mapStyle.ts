import { colors } from '../theme/tokens';

// Dark Google Maps style tuned to the app palette — shared by every map
// surface (small previews and the full-screen home map) so they read as one
// consistent product. Reduced labels/POI clutter per the map-first redesign.
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: colors.surface }] },
  { elementType: 'labels.text.fill', stylers: [{ color: colors.muted }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: colors.bg }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: colors.surface2 }] },
  { featureType: 'road', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: colors.bg }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: colors.surface }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: colors.surface2 }] },
];
