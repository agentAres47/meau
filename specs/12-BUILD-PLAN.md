# 12 — Build Plan (2-Day Sprint)

Build in this exact order. After each phase, output a **device test checklist** and commit. Don't jump ahead — later phases depend on earlier scaffolding.

## Phase 0 — Foundations (do first)
- Create repo structure (app / services / supabase / specs).
- Init Expo app (TS, expo-router, NativeWind, Reanimated, React Query, Zustand, supabase-js).
- Set up theme tokens (11) + base components: Button, Card, Sheet, Input, Avatar, Badge, PriceSlider, Stepper, MapPreview, EmptyState, Skeleton.
- Supabase project: run schema (02), enable postgis, add RLS policies + `current_profile_id()` helper + `accept_ride_request` RPC.
- `.env.example` with all vars. Supabase client singleton.
- **Test**: app boots to a themed welcome screen; components render in a scratch screen.

## Phase 1 — Auth & onboarding
- amizone-auth microservice with `/verify` (go-amizone). Deploy to Railway/Render (or run locally + expose).
- Onboarding screens: welcome → amizone-login → complete-profile.
- Create/link `profiles` row; persist Supabase session; session gate in root layout.
- **Test**: real Amizone login creates a profile, lands on Passenger tab; relaunch skips onboarding; wrong creds show error; password never stored (verify).

## Phase 2 — Tabs shell + Profile + Become-driver
- Custom animated bottom tab bar (Driver / Passenger / Auto Pool).
- Profile screen (shows verified badge, role). Become-driver: licence upload (Storage) + vehicle form → driver_verifications + vehicles (pending).
- Driver tab gated state when not verified.
- Provide SQL snippet to approve a driver manually.
- **Test**: upload licence → pending state; after manual approve, Driver tab unlocks.

## Phase 3 — Driver: post & manage tokens
- Post-ride sheet: origin/dest map pickers (Places), Directions API → polyline + route preview, time picker, seats stepper, price slider (suggested).
- Insert ride_tokens (live). Active token card. Cancel token.
- **Test**: create a token; see it live; polyline preview correct; cancel works; token expires after depart time (cron).

## Phase 4 — Matching service + Passenger search
- Matching service: `/match`, `/request`, `/accept` (RPC), `/health`. turf + polyline decode. Deploy.
- Passenger search screen (pickup/drop/time/offer) → creates request → calls /match → results list with route-attach preview + ranking.
- **Test** (needs a driver token live from another account/device): passenger search returns the matching token; a token going Amity→Thane matches a drop at Mulund (on route); non-matching time/route excluded.

## Phase 5 — Request → accept race + realtime
- Passenger: request one or blast all (/request) → waiting screen (Realtime on ride_requests).
- Driver: incoming request cards (Realtime on request_targets) → Accept/Decline (/accept).
- First-accept-wins: others dismissed; losing drivers see "already matched"; seats decrement.
- Expo push wired for new_request / matched_passenger / request_dismissed (data-only for dismiss).
- **Test** (2 devices, 1 passenger + 2 drivers): blast to both; first accept wins; second sees "already matched"; passenger flips to Matched.

## Phase 6 — Chat
- match/[matchId] chat: system summary message, message list (Realtime), composer, structured chips.
- **Test**: after a match, both participants land in chat; messages sync live; structured chips work.

## Phase 7 — Auto Pool
- Preset routes config. Right-Now mode (live grouping) + Scheduled mode (slot grouping) in matching service loop.
- Pool UI: route buttons, searching/pulse, matched state with live split fare; opens chat.
- **Test**: two accounts tap same route "now" → matched + split shown; scheduled same slot → matched.

## Phase 8 — Polish pass (spend real time here)
- Match moment animation + haptic (signature). Skeletons, empty/error states with real copy. Dark map style. Tab bar animation. Press states. Reduced-motion. Icon consistency.
- App icon + splash (use "Meau" wordmark for now).
- **Test**: full happy path on device feels smooth and premium; no dead-end screens.

## Phase 9 — Ship prep (if time)
- EAS build (Android APK/AAB). Env for prod. Basic error boundary + Sentry (optional).
- README with run instructions for both services + app.
- **Deliverable**: installable Android build + running services.

## Definition of done (MVP)
A verified Amity user can: log in via Amizone → (optionally verify as driver) → post a token OR search & match a real ride with route-aware matching → race-to-accept works across devices → chat opens → auto pool works for both modes → the whole thing looks and feels premium.

## Notes for Claude Code
- Prefer simple, working implementations; mark deferrals `// TODO(v2):`.
- Keep secrets in env; service-role key only server-side.
- Output test checklists after each phase and commit with clear messages.
- If go-amizone is down/changed, implement the interface against a documented mock (`MOCK_AMIZONE=true`) so the app is still buildable, and flag it clearly — but the target is the real integration.
