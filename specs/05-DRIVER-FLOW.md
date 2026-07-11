# 05 — Driver Flow

## Gate
Driver tab is locked until `profiles.is_driver_verified = true`.
- Locked state: nice illustration + "Verify your licence to start offering rides" → CTA to `profile/become-driver`.

## Become a driver (profile/become-driver)
1. Upload driving licence photo (expo-image-picker → Supabase Storage bucket `licences`, private).
2. Add vehicle: type (car/bike), make/model, color, plate number, seats.
3. Submit → creates `driver_verifications` row (status pending) + `vehicles` row.
4. Show "Under review — usually within a few hours" state.
5. (Admin approves manually — see Admin note below. On approval, `is_driver_verified=true`.)

> Admin note: For MVP, approval can be done directly in Supabase dashboard, or build a tiny web admin later. Provide a SQL snippet to approve:
> ```sql
> update driver_verifications set status='approved', reviewed_at=now() where id='...';
> update profiles set is_driver_verified=true where id='...';
> ```

## Posting a ride token (driver.tsx, when verified)
Form (as a clean multi-step or single elegant sheet):
1. **Origin** — map picker (default to current location) → `origin_label`, lat/lng.
2. **Destination** — map picker / Places autocomplete.
3. On both set: call Google Directions API → get `route_polyline` + show route preview on a mini map.
4. **Depart at** — time picker (today/tomorrow + time). Store `depart_at`.
5. **Seats** — stepper (1–6), default from vehicle.
6. **Price per seat** — slider with a smart suggested default (see pricing below), editable.
7. **Go Live** button → inserts `ride_tokens` (status 'live', seats_left = seats_total).

### Suggested price
Compute distance from Directions API. Suggest `round(baseFare + perKm * distanceKm)` split hint. Keep simple: e.g. suggested = clamp(20, 150, round(8 * km)). Editable by driver. This is a hint only.

## Live token management
- After going live, driver sees their active token card with: route preview, depart time, seats left, price, status.
- **Incoming requests**: realtime subscription on `request_targets` where `driver_id = me`. Each incoming request shows a card/sheet:
  - passenger name + photo + verified badge
  - their pickup → drop (mini map with their segment relative to route)
  - offered price
  - **Accept** / **Decline**
- On **Accept**:
  - Transactionally: set this `request_targets.state='accepted'`, set `ride_requests.status='matched'` with matched_token_id/driver, decrement `ride_tokens.seats_left`, create a `matches` row + participants, and set all OTHER `request_targets` for that request to `dismissed`.
  - Fire push to passenger ("Matched!") and to other drivers (dismiss — see 09).
  - If seats_left hits 0 → token status 'matched'.
- Driver can **cancel** a live token (status 'cancelled') → any pending targets dismissed.

## Realtime
Use Supabase Realtime on `request_targets` (driver side) and `ride_requests` (passenger side). See 08/09 for the accept race handling — the matching service owns the atomic accept to avoid double-booking.
