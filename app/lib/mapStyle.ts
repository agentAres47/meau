// Dark Google Maps style for every map surface.
//
// These are deliberately NOT the theme tokens. The first version reused them
// (land=surface #121012, roads=surface2 #1A1517, water=bg #0D0D0D) and the map
// came out flat and unreadable: roads sat ~8/255 above the land they were drawn
// on, and water was the exact same colour as the background, so it vanished.
// UI surface colours are tuned to sit quietly behind content; a map needs the
// opposite — legible separation between layers. So map colours live here, still
// black-first and on-brand, but with real contrast steps between them.
//
// Two rules this style follows:
//   1. Road brightness encodes hierarchy (highway > arterial > local), which is
//      what lets you read the shape of an area at a glance.
//   2. Nothing competes with the pink route line or the pickup/drop markers —
//      the map is context, the route is the content.

// STRICTLY NEUTRAL greys (R=G=B). An earlier pass derived these from the app's
// warm palette and the whole map picked up a mauve cast — #4A4147 is red-high
// with blue above green, which reads as pink across large road areas and was
// genuinely uncomfortable to look at. The pink in this product belongs to the
// route line and the CTAs, not to the terrain behind them. Water is the one
// exception: it stays blue because that is what makes it read as water.
const MAP = {
  land: '#0D0D0D',
  landscape: '#111111',
  water: '#0B1926',
  poi: '#141414',
  park: '#101410', // barely-there green so parks are distinguishable, not decorative

  highwayFill: '#4A4A4A',
  highwayStroke: '#5A5A5A',
  arterialFill: '#333333',
  arterialStroke: '#3D3D3D',
  localFill: '#262626',

  labelHalo: '#070707', // dark halo keeps text legible over any layer

  // Labels are colour-coded by KIND, not decoration: colour tells you what a
  // name refers to before you finish reading it. Three tiers only — more than
  // that and the coding stops being readable at a glance.
  roadText: '#D9B45C', // roads: amber, the one warm accent (matches map convention)
  localityText: '#EDEDED', // towns/areas: brightest, the primary orientation anchor
  placeText: '#8E8E8E', // complexes/neighbourhoods: grey, secondary detail
  waterText: '#5A7186',
} as const;

// Full-screen map (HomeMap). Road + locality labels ON: without them you can't
// tell one road from another, which was the single biggest legibility gap
// against other ride apps.
export const DARK_MAP_STYLE = [
  { elementType: 'geometry', stylers: [{ color: MAP.land }] },
  { elementType: 'labels.text.fill', stylers: [{ color: MAP.placeText }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: MAP.labelHalo }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },

  { featureType: 'landscape', elementType: 'geometry', stylers: [{ color: MAP.landscape }] },

  // Road hierarchy — the core of the fix.
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: MAP.localFill }] },
  { featureType: 'road.arterial', elementType: 'geometry.fill', stylers: [{ color: MAP.arterialFill }] },
  { featureType: 'road.arterial', elementType: 'geometry.stroke', stylers: [{ color: MAP.arterialStroke }] },
  { featureType: 'road.highway', elementType: 'geometry.fill', stylers: [{ color: MAP.highwayFill }] },
  { featureType: 'road.highway', elementType: 'geometry.stroke', stylers: [{ color: MAP.highwayStroke }] },

  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: MAP.roadText }] },
  { featureType: 'road', elementType: 'labels.text.stroke', stylers: [{ color: MAP.labelHalo }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },

  { featureType: 'water', elementType: 'geometry', stylers: [{ color: MAP.water }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: MAP.waterText }] },

  // POI geometry stays; POI labels/icons stay off — they're the clutter the
  // map-first redesign was reacting to, and none of them help you catch a ride.
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: MAP.poi }] },
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: MAP.park }] },

  { featureType: 'transit', stylers: [{ visibility: 'off' }] },

  { featureType: 'administrative', elementType: 'geometry', stylers: [{ visibility: 'off' }] },
  {
    featureType: 'administrative.locality',
    elementType: 'labels.text.fill',
    stylers: [{ color: MAP.localityText }],
  },
  // Neighbourhoods and apartment complexes (e.g. MARATHON NEXZONE) come through
  // this layer — grey keeps them readable as supporting detail without pulling
  // attention off the town names above them.
  {
    featureType: 'administrative.neighborhood',
    elementType: 'labels.text.fill',
    stylers: [{ color: MAP.placeText }],
  },
];

// Small preview cards (MapPreview, ~160px). Same palette so previews and the
// full map read as one product, but all text suppressed: at that size labels
// are unreadable noise competing with the route, which is the only thing a
// preview needs to show.
export const DARK_MAP_STYLE_PREVIEW = [
  ...DARK_MAP_STYLE,
  { elementType: 'labels', stylers: [{ visibility: 'off' }] },
];
