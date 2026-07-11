# 08 — Matching Service (Node.js + Express + TS)

Owns the geo/time matching logic and the atomic accept. Runs with Supabase **service role** key (bypasses RLS safely, server-side only).

## Endpoints

### POST /match
Find live driver tokens matching a passenger request.
```json
// request
{
  "request_id": "uuid",         // an existing ride_requests row (status 'searching')
}
// response
{ "matches": [ { "token_id","driver": {...}, "vehicle": {...},
                 "depart_at","price_per_seat","detour_m","time_delta_min",
                 "route_polyline","origin_label","dest_label" } ] }
```
Algorithm:
1. Load the request (pickup, drop, desired_time, offered_price).
2. Candidate tokens: `status='live'`, `seats_left > 0`, `depart_at` within ±TIME_WINDOW (default 30 min) of desired_time. (Index-assisted.)
3. For each candidate:
   - **Pickup check**: distance(pickup → token route polyline) ≤ PICKUP_RADIUS (default 800 m). (Decode polyline; compute min distance point-to-polyline. Use turf.js: `@turf/point-to-line-distance`.)
   - **Drop check**: distance(drop → route polyline) ≤ DROP_RADIUS (default 800 m). This is the "on the way" rule.
   - Also ensure pickup occurs before drop **along** the route (order check): compare nearest-point indices along the polyline so we don't match reverse-direction. (Use turf nearestPointOnLine → compare `location` measure.)
4. Compute `detour_m` (sum of pickup+drop offsets) and `time_delta_min`.
5. Rank: primary by time_delta_min asc, then detour_m asc, then price fit.
6. Return ranked list with driver+vehicle info (join profiles/vehicles).

Constants (env-tunable): `TIME_WINDOW_MIN=30`, `PICKUP_RADIUS_M=800`, `DROP_RADIUS_M=800`.

### POST /request
Passenger requests one or many tokens (blast).
```json
{ "request_id":"uuid", "token_ids":["uuid", ...] }
```
- Create `request_targets` (pending) for each token_id.
- Send Expo push to each target driver ("New ride request").
- Return ok.

### POST /accept
Driver accepts a request target. **Atomic — this is the race winner logic.**
```json
{ "request_id":"uuid", "token_id":"uuid", "driver_id":"uuid" }
```
Do inside a Postgres transaction / RPC to be race-safe:
1. Lock the request row (`select ... for update`). If `status != 'searching'` → return `already_matched`.
2. Set request `status='matched'`, matched_token_id, matched_driver_id.
3. Set this target `state='accepted'`; set all other targets for this request `state='dismissed'`.
4. Decrement `ride_tokens.seats_left`; if 0 → `status='matched'`.
5. Insert `matches` (kind='ride') + `match_participants` (driver + passenger).
6. Return match_id.
Then (outside txn): push "Matched!" to passenger; push "dismiss" to all other drivers (see 09).

> Implement the transaction as a Supabase RPC (`plpgsql` function) called from the service for atomicity. Provide the SQL for `accept_ride_request(request_id, token_id, driver_id)`.

### POST /autopool/tick  (or internal interval)
Groups waiting `auto_pool_sessions` (see 07). Can be a setInterval loop instead of an endpoint. Idempotent grouping by (route_code, mode, slot bucket / live window). Writes pool_group_id + match rows, pushes to participants.

### Cron / expiry
Every 60s: expire tokens/requests/sessions past their time. Either here or a Supabase scheduled function.

## Libraries
- `@turf/turf` (or granular: `@turf/point-to-line-distance`, `@turf/nearest-point-on-line`, `@turf/helpers`)
- `@mapbox/polyline` to decode Google polylines
- `@supabase/supabase-js` with service role
- `expo-server-sdk` for sending Expo push notifications

## Health
`GET /health` → `{ ok: true }` for Railway/Render.
