# 06 — Passenger Flow

## Search (passenger.tsx)
Ola-style entry:
1. **Pickup** — defaults to current location; editable via map picker / Places autocomplete → label + lat/lng.
2. **Drop** — map picker / Places autocomplete → label + lat/lng.
3. **Time** — "Now" chip or specific time picker → `desired_time`.
4. **Your offer** — price slider. Default = suggested fare (distance-based, same formula family as driver). Passenger can nudge ± a range (e.g. ±30%).
5. **Find Rides** → creates a `ride_requests` row (status 'searching') and calls the matching service `POST /match` (see 08). 

## Results (ride/search-results.tsx)
The matching service returns ranked matching tokens. Show list of driver cards:
- driver name, photo, verified badge, rating (if any)
- vehicle (make/model, color, plate partially masked until matched)
- route preview: mini map showing driver route + where passenger's pickup/drop attach ("on the way" highlight)
- depart time + how close to desired_time
- price per seat
- select checkbox (for multi-select blast)

Actions:
- **Request this driver** (single), or
- **Select multiple → Request all** — sends to all selected. Backend creates `request_targets` for each and pushes to those drivers simultaneously.

Empty state: "No rides match right now" + options: widen time window, get notified when a match appears (TODO(v2) push-on-new-token), or try Auto Pool.

## Waiting for accept
- After requesting, show a live "waiting" screen with subtle animation (Lottie radar/pulse).
- Realtime subscription on the passenger's `ride_requests` row.
- **First driver to accept wins**: `ride_requests.status` flips to 'matched' with matched_driver/token. UI transitions to a celebratory "Matched!" state → opens chat.
- Other targets auto-dismissed server-side. If passenger cancels while waiting → set request 'cancelled', dismiss all targets.

## Matching feel (important for the "wow")
- The waiting → matched transition should feel great: pulse animation, then a satisfying success Lottie + haptic (expo-haptics) on match.
- Show the matched driver card sliding up into a "Your ride" state with a "Message" button → chat.

## Ranking (what "best match" means)
Ranking handled by matching service (08). Roughly: closest time first, then least detour (drop distance to route), then price fit. Display in that order.
