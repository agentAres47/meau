import { lineString, point } from '@turf/helpers';
import nearestPointOnLine from '@turf/nearest-point-on-line';
import polyline from '@mapbox/polyline';

const PICKUP_RADIUS_M = Number(process.env.PICKUP_RADIUS_M ?? 800);
const DROP_RADIUS_M = Number(process.env.DROP_RADIUS_M ?? 800);

export type RequestGeo = {
  pickup_lng: number;
  pickup_lat: number;
  drop_lng: number;
  drop_lat: number;
  desired_time: string;
  offered_price: number;
};

export type Candidate = {
  token_id: string;
  driver_id: string;
  vehicle_id: string | null;
  origin_label: string;
  dest_label: string;
  route_polyline: string;
  depart_at: string;
  seats_left: number;
  price_per_seat: number;
  driver_name: string;
  driver_photo: string | null;
  driver_verified: boolean;
  vehicle_make_model: string | null;
  vehicle_color: string | null;
  vehicle_type: string | null;
};

export type Match = {
  token_id: string;
  driver_id: string;
  driver: { name: string; photo: string | null; verified: boolean };
  vehicle: { make_model: string | null; color: string | null; type: string | null };
  origin_label: string;
  dest_label: string;
  route_polyline: string;
  depart_at: string;
  seats_left: number;
  price_per_seat: number;
  detour_m: number;
  time_delta_min: number;
};

// Keep tokens whose route passes near BOTH the passenger's pickup and drop, with
// pickup before drop along the route ("on the way"). Rank by time closeness, then
// least detour, then price fit. Pure — unit tested in match.test.ts.
export function rankMatches(req: RequestGeo, candidates: Candidate[]): Match[] {
  const out: Match[] = [];
  const desiredMs = new Date(req.desired_time).getTime();

  for (const c of candidates) {
    const pts = polyline.decode(c.route_polyline); // [[lat,lng], ...]
    if (pts.length < 2) continue;
    const line = lineString(pts.map(([lat, lng]) => [lng, lat])); // turf wants [lng,lat]

    const pickup = nearestPointOnLine(line, point([req.pickup_lng, req.pickup_lat]), { units: 'meters' });
    const drop = nearestPointOnLine(line, point([req.drop_lng, req.drop_lat]), { units: 'meters' });
    const pickupDist = pickup.properties.dist ?? Infinity;
    const dropDist = drop.properties.dist ?? Infinity;

    if (pickupDist > PICKUP_RADIUS_M || dropDist > DROP_RADIUS_M) continue;
    // Direction check: pickup must come before drop along the route.
    if ((pickup.properties.location ?? 0) > (drop.properties.location ?? 0)) continue;

    out.push({
      token_id: c.token_id,
      driver_id: c.driver_id,
      driver: { name: c.driver_name, photo: c.driver_photo, verified: c.driver_verified },
      vehicle: { make_model: c.vehicle_make_model, color: c.vehicle_color, type: c.vehicle_type },
      origin_label: c.origin_label,
      dest_label: c.dest_label,
      route_polyline: c.route_polyline,
      depart_at: c.depart_at,
      seats_left: c.seats_left,
      price_per_seat: c.price_per_seat,
      detour_m: Math.round(pickupDist + dropDist),
      time_delta_min: Math.round(Math.abs(new Date(c.depart_at).getTime() - desiredMs) / 60000),
    });
  }

  out.sort(
    (a, b) =>
      a.time_delta_min - b.time_delta_min ||
      a.detour_m - b.detour_m ||
      Math.abs(a.price_per_seat - req.offered_price) - Math.abs(b.price_per_seat - req.offered_price)
  );
  return out;
}
