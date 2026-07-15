# Meau — Redesign & Feature Plan (v2)

Consolidates `UI_REDESIGN_PROMPT.md` + `HOME_SCREEN_REDESIGN_PROMPT.md` + `SIGNUP_LOGIN_ADMIN_PROMPT.md` into one buildable plan, with the decisions made in planning locked in. Build order is dependency-correct; cheap wins interleave where safe.

---

## Locked decisions

- **Dark mode only** (no light mode this pass). Build tokens so light *could* be added later, but don't build a theme switcher now.
- **New palette** (dark): bg `#0D0D0D` with a subtle gradient `#0D0D0D → #151218 → #23171E`; **accent `#F7A6C1`** (pink); **primary CTA `#E87BA5`** (deeper pink); glass tint `rgba(247,166,193,0.10)`, glass border `rgba(247,166,193,0.15)`; text `#EDEDED` / muted `~#9A9298`. Accent occupies ~5–10% of screen — mostly neutral UI.
- **Adaptive glassmorphism.** The `Glass` component branches by platform: **iOS → real `expo-blur` BlurView**; **Android → translucent fill + soft border + soft shadow (no blur)**. Overriding hard constraint on both: **never sacrifice scroll or map FPS for blur** — glass layered over the live map stays faux even on iOS. (App is Android-first; the iOS BlurView path won't be verified on-device until there's iOS testing — build it, don't block on it.)
- **Microinteractions throughout — subtle, professional, 150–300ms, never flashy.** Bottom sheet springs; buttons scale on press; cards gently lift on touch; search bar expands smoothly; map camera *animates* (never jumps); custom markers animate on appearance/selection; driver cards fade+slide in; screen transitions use soft fade+slide. All respect reduced-motion (`useReducedMotion` hook already exists). "Alive but professional."
- **Map-first passenger home — full redesign.** Full-screen interactive map as the canvas, floating glass search + avatar, `@gorhom/bottom-sheet` expandable sheet. BUT: improve incrementally, **do NOT rewrite the whole navigation architecture** just to preserve map continuity across every step. Keep the map visible where practical; prioritize UX over a rewrite.
- **No live driver tracking / no vehicles moving on roads** (future backend feature). Markers are static; we animate marker *appearance*, *selection*, and *camera transitions* only.
- **Custom branded markers:** pickup, destination, and a premium driver-marker icon where applicable.
- **Fare slider moves** off the home screen into a drawer that appears after the user taps **Find Rides**, right before ride options.
- **Admin = in-app**, entered via a barely-visible gear top-left on the **welcome/landing screen** (before Amizone auth — admin is not an Amity student). Gear → id/pwd screen → admin dashboard. **All admin functionality is protected server-side** (see security model below) — the password is never in the app bundle.
- **Tagline → "Find your Humsafar."**
- **Accent change is intentional** — regenerate icon/splash to the pink accent.

---

## New dependencies (all standard, justified)

- `@gorhom/bottom-sheet` — the gesture-driven sheet the map-first home needs (replaces our plain-Modal `Sheet`; `react-native-gesture-handler` + `reanimated` peers already installed).
- `expo-blur` — real glass where cheap (not over the map).
- `expo-linear-gradient` — the subtle gradient background.

Already present: gesture-handler, reanimated, expo-image-picker, async-storage.

---

## Phase A — Design system foundation (do first; everything depends on it)

- Rewrite `theme/tokens.ts` to the new dark palette + glass tokens + type scale + radii (glass corners 20–28px) + soft-shadow tokens + **motion tokens** (durations 150–300ms, standard spring configs, standard ease).
- New primitives in `components/`: `Glass`/`GlassCard` — **platform-adaptive** (iOS `BlurView` / Android translucent, via `Platform.select`), with an `overMap` variant that forces faux on both; a gradient `Screen` background wrapper; updated `Button` (pill primary, glass secondary, circular glass icon buttons) with the standard press-scale; `Card` → glass with lift-on-touch. A reusable `Pressable`-wrapper for press-scale/lift so the microinteraction is one import, not re-hand-rolled per screen. Reskin the shared components so **every screen lifts automatically** (they're already centralized — big free win).
- Wire **soft fade+slide screen transitions** globally via expo-router `screenOptions` (150–300ms).
- Reskin the **welcome screen** here too (small, high-visibility): new tagline "Find your Humsafar", glass CTA, and the hidden admin gear (top-left) wired to a placeholder route.
- Regenerate icon/splash + adaptive-icon to the pink accent (throwaway sharp script, same as before).
- Install the 3 new deps; wire `GestureHandlerRootView` + `BottomSheetModalProvider` at the root layout.
- **Verify:** `tsc` + `expo export`; reskinned welcome + a couple of existing screens look cohesive on device (screenshot).

## Phase B — Map-first passenger home (flagship)

- Full-screen interactive `MapView` as the passenger home background; center on current location on open (permission handling; graceful fallback if denied).
- Floating glass search card (current location + "Where would you like to go?"), profile avatar top-right.
- `@gorhom/bottom-sheet`: collapsed (recent/saved/quick actions) → expanded (destination → ride options). Sheet resizes in place where practical.
- Custom branded markers (pickup / destination / driver icon), animated appearance + camera-fit animation when a destination is chosen.
- **Fare slider → drawer:** removed from the home form; appears as a confirm-price drawer after **Find Rides**, before results.
- Reuse all existing matching/results/request logic — this is re-presentation, not new backend.
- **Verify:** full passenger search→match flow still works end-to-end against Railway; screenshots.

## Phase C — Signup profile enrichment (small; slot in after A)

- **Department dropdown** (schema `department` already exists, unused — needs an Amity-Mumbai department list; source TBD, see open items).
- **Profile photo** upload (reuse the licence storage pattern; `photo_url` already exists — needs an avatars bucket + policy).
- **DL upload offered as a skippable optional step** at signup (currently it's the separate become-a-driver flow). Name/phone/sex/role already collected — just add the three above.
- **Verify:** new profile fields persist; skipping DL still lands in tabs.

## Phase D — Admin (in-app, secured)

- **Migration:** `is_admin` (flag on `profiles` or a small `admins` table keyed by auth uid) + `is_admin()` helper; re-grant `approve_driver`/`reject_driver` to `authenticated` but guard them with an `is_admin()` check inside (raise otherwise); RLS policies so an admin can read all profiles + the DL queue; a storage policy so an admin can view licence photos (currently owner-only).
- **Admin account:** one real Supabase Auth email+password user (you create it in the dashboard), marked admin. Password lives hashed in Supabase Auth — never in the app.
- **Screens:** gear (welcome) → admin login (`supabase.auth.signInWithPassword`) → dashboard: **DL approval queue** (approve/decline, reuses the RPCs), **user profiles list**, **simple usage counts** (total users, pending DLs, active tokens, rides today, active users) with room to extend.
- Handle the second-auth-mode cleanly (admin session is a real account, separate branch from the anonymous student sessions; logout returns to welcome).
- **Verify:** non-admin can't call the RPCs or read the admin data (RLS/guard test); admin login → approve a pending DL → that driver unlocks.

## Phase E — Consistency + polish pass

- Dark map style refinement (elegant, reduced road labels, minimal POIs).
- Sweep any screens not yet fully glassed; motion consistency (fade/scale/slide, respect reduced-motion); final spacing/hierarchy pass.
- **Verify:** full happy path on device feels cohesive; no legacy-styled screen left.

---

## Admin security model (non-negotiable)

The id/pwd screen is the UX; the *check* is server-side. One Supabase Auth admin account (hashed password, server-side) + an `is_admin` flag. Admin RPCs are guarded by `is_admin()` inside the function (not just client-gated), and admin-only data is protected by RLS `using (is_admin())`. This matters because the admin can approve licences and read everyone's PII + licence photos — a bundled/client-checked password would be trivially forgeable by decompiling the APK.

---

## Open micro-decisions (not blockers; decide when we reach them)

- **Department list** — where from? A hardcoded list of Amity Mumbai departments (simplest), or scraped/edited later. Need the actual list.
- **Admin "id"** — Supabase Auth uses email; the login field can be labeled "Admin ID" but maps to an email under the hood. Fine unless you want a true username.
- **Avatars bucket** — public-read (simpler, avatars aren't sensitive) vs signed URLs. Leaning public-read.
- **Usage monitoring depth** — starting with simple live counts; heavier analytics (charts over time, per-route volume) is a later extension.

## Explicitly OUT of scope this pass

Light mode · live driver GPS tracking / moving vehicles · full navigation-architecture rewrite for perfect map continuity · deep along-polyline segment pricing · push notifications · ride-completion lifecycle/ratings. (All tracked in HANDOFF.md §6.)

---

## Suggested build order

**A → B → C → D → E.** A is the dependency for everything. B is the flagship (highest visual payoff, what you most want to see). C is small and rides A's momentum. D is the backend-heavy one. E ties it together. C and D can swap if admin feels more urgent than profile fields.
