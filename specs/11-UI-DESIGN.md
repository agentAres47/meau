# 11 — UI Design System (the differentiator)

Design quality is the #1 thing that separates this from the WhatsApp group. This is a portfolio piece. Aim for a considered, distinctive identity — NOT a templated dark app. Below is a starting direction; refine with taste. Take one justified aesthetic risk in the "signature" element.

## Direction (pin the vibe)
Meau is about *shared movement between people who already belong to the same place*. Feel: calm, trustworthy, a little playful, premium. Not corporate ride-hailing, not childish. Think "quiet confidence + a warm human spark."

Avoid the AI-default looks: (a) cream + serif + terracotta, (b) pure black + single acid accent, (c) newspaper hairline broadsheet. Make deliberate choices instead.

## Color tokens (dark base — refine, don't just accept)
Propose and lock a palette of 5–6 named hex values. Starting proposal (tune it):
- `--bg`         #0E1116  (near-black, slightly blue-cool, not pure #000)
- `--surface`    #161B22  (cards)
- `--surface-2`  #1F2630  (raised / inputs)
- `--text`       #EDF1F5
- `--muted`      #8A94A3
- `--accent`     pick ONE signature accent that isn't acid-green or terracotta — e.g. a warm amber/gold `#F5A623` OR a soft electric indigo `#6C7BFF`. Choose one and commit; use it sparingly for primary actions, match moments, live states.
- `--accent-soft` a translucent tint of accent for glows/highlights
- `--success`    #3DDC84  (match confirmed)
- `--danger`     #FF5C5C

> Decide accent by taste and justify it in one line in the code comments. Use accent with restraint — most of the UI is neutral; accent marks *aliveness* (live token pulse, match success, primary CTA).

## Typography
Pick a deliberate pairing (not system default everywhere):
- Display/headings: a characterful but legible geometric or humanist sans (e.g. Sora, Clash Display, Satoshi, or General Sans) — used with restraint for screen titles and big moments.
- Body/UI: a clean neutral sans (Inter, or Geist) for everything functional.
- Numerics (fares, times, seats): consider a tabular/mono-ish face or tabular figures so numbers align and feel "product-grade."
Set a clear type scale (e.g. 12/14/16/20/28/34) with intentional weights.

## Layout & components
- Generous spacing, 12–16px radius on cards, soft shadows via subtle borders + low-opacity glows (avoid heavy drop shadows on dark).
- Bottom sheets for all "post ride" / "search" flows (feels native + premium). Use a real gesture-driven sheet.
- Cards: driver card, token card, request card, pool card — consistent system.
- Custom bottom tab bar with an animated active indicator (Reanimated), not the default.
- Map previews use a **dark map style** (provide a Google Maps dark JSON style) so maps match the theme.

## Motion (deliberate, not scattered)
- Page/tab transitions: smooth, quick (200–300ms), eased.
- **Signature moment**: the match. Passenger waiting = a calm radar/pulse Lottie in accent; on match = a satisfying success animation + haptic (expo-haptics) + card slide-up. Make THIS the memorable beat.
- Live token = a gentle breathing pulse on the "LIVE" dot.
- Micro-interactions: button press scale (0.97), slider thumb, stepper taps. Respect reduced-motion.
- Keep it tasteful — over-animating reads as AI-generated. Spend boldness on the match moment; keep the rest quiet.

## Empty / loading / error (write real copy)
- Loading: skeletons matching card shapes (not spinners).
- Empty (no matches): "No rides your way right now." + one clear action ("Try Auto Pool" / "Widen time to ±45 min").
- Error: name what happened + retry. Interface voice, no apologies-as-mood.

## Copy voice
Plain, warm, active. Buttons say what happens ("Go live", "Find rides", "Request all", "Accept"). Consistent verbs across the flow. Sentence case. No filler.

## Signature element (pick one and make it the thing people remember)
Options to consider — choose ONE:
- The **match moment** (radar → success burst + haptic) as the emotional peak.
- A distinctive **live token card** with a breathing accent edge that feels "alive."
- A **route ribbon** visual that elegantly shows how a passenger's trip attaches to a driver's route ("on the way").
Commit to one as the hero; keep everything else disciplined around it.

## Quality floor (non-negotiable)
Responsive to small screens, safe-area aware, keyboard-avoiding on inputs, visible focus/press states, reduced-motion respected, dark map styling, consistent iconography (use a single icon set — lucide-react-native or phosphor).
