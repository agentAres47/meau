import assert from 'node:assert';
import polyline from '@mapbox/polyline';
import { rankMatches, type Candidate, type RequestGeo } from './match.js';

// Straight west->east route along lat 19.10, from lng 72.90 to 73.00.
const route = polyline.encode([
  [19.1, 72.9],
  [19.1, 73.0],
]);

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    token_id: 't1',
    driver_id: 'd1',
    vehicle_id: 'v1',
    origin_label: 'A',
    dest_label: 'B',
    route_polyline: route,
    depart_at: '2026-07-13T10:00:00Z',
    seats_left: 3,
    price_per_seat: 60,
    driver_name: 'Test',
    driver_photo: null,
    driver_verified: true,
    vehicle_make_model: 'Swift',
    vehicle_color: 'White',
    vehicle_type: 'car',
    ...over,
  };
}

const base: RequestGeo = {
  pickup_lng: 72.92,
  pickup_lat: 19.101, // ~111m off the line
  drop_lng: 72.98,
  drop_lat: 19.101,
  desired_time: '2026-07-13T10:05:00Z',
  offered_price: 60,
};

// On the way, correct order -> match.
assert.strictEqual(rankMatches(base, [candidate()]).length, 1, 'pickup+drop near route in order should match');

// Reversed (drop before pickup along route) -> rejected.
const reversed: RequestGeo = { ...base, pickup_lng: 72.98, drop_lng: 72.92 };
assert.strictEqual(rankMatches(reversed, [candidate()]).length, 0, 'wrong direction should be rejected');

// Pickup far from route (~11km north) -> rejected.
const farPickup: RequestGeo = { ...base, pickup_lat: 19.2 };
assert.strictEqual(rankMatches(farPickup, [candidate()]).length, 0, 'far pickup should be rejected');

// Ranking: closer depart time first.
const near = candidate({ token_id: 'near', depart_at: '2026-07-13T10:05:00Z' });
const far = candidate({ token_id: 'far', depart_at: '2026-07-13T10:25:00Z' });
const ranked = rankMatches(base, [far, near]);
assert.strictEqual(ranked[0].token_id, 'near', 'closest depart time ranks first');

// detour is reported in meters and positive.
const m = rankMatches(base, [candidate()])[0];
assert.ok(m.detour_m > 0 && m.detour_m < 800, `detour ${m.detour_m} should be small+positive`);

console.log('match logic checks passed');
