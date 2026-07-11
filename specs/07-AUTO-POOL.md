# 07 — Auto Pool

Auto-rickshaw sharing for common campus routes. Two modes on one tab.

## Preset routes (config, easy to extend)
```
AMITY_STATION   "Amity → Station"
STATION_AMITY   "Station → Amity"
AMITY_IB        "Amity → IB"
IB_AMITY        "IB → Amity"
```
Store as a config array with { code, label, typical_fare } so more can be added. typical_fare e.g. ₹230 for the full auto → used for split display.

## Mode 1 — Right Now (live)
UX:
- Big route buttons. Tap one (e.g. "Amity → Station") → "Searching now…" state with live pulse.
- Creates `auto_pool_sessions` (mode='now', status='waiting', slot_time=null).
- Matching: any other sessions on the SAME route_code with mode='now', status='waiting', created within a short live window (e.g. last 3–5 min) → group them.
- When 2+ (configurable target, e.g. 2 or 3) are waiting → assign a shared `pool_group_id`, set status='matched', create a `matches` row (kind='autopool') + participants, open chat.
- Show "Matched with N others!" + split fare = typical_fare / N (live updates as people join up to auto capacity, cap at 3).
- If no match within a timeout (e.g. 5 min) → gentle "No one right now — try scheduled or retry" (status='expired').

## Mode 2 — Scheduled
UX:
- Pick route + time slot (e.g. next 30-min slots).
- Creates `auto_pool_sessions` (mode='scheduled', slot_time set, status='waiting').
- Matching groups sessions with same route_code + same slot (bucket by slot_time) → shared pool_group_id when target count reached (or at slot time, match whoever's there, min 2).
- Show pool size + live split fare.

## Split fare display
- `split = round(typical_fare / poolSize)`; poolSize capped at 3 (typical auto). Show clearly: "₹230 ÷ 3 = ₹77 each".
- Recompute and update UI as pool grows (Realtime on auto_pool_sessions by pool_group_id).

## Matching ownership
Auto pool matching can run in the matching service on a short interval (every ~10–15s) OR via Supabase Realtime + an edge function. Simplest for 2-day build: a lightweight loop in the matching service that groups waiting sessions and writes pool_group_id + match rows. Keep it idempotent.

## After match
- Chat opens (kind='autopool' match). Structured system message: "You're pooling <route> at <time>. Split ₹<x> each. Coordinate pickup point below."
