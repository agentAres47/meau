# 00 — Project Overview

## What Meau is
A college-locked carpool + ride-sharing app for Amity University Mumbai. It replaces the chaotic "Travel Partners" WhatsApp group where students post "anyone to station?" messages. Every user is a verified Amity member (via Amizone login), every driver is licence-checked, and rides are matched intelligently by route, time, and location proximity.

## Core principles
1. **Verified & safe** — only real Amity students/faculty can enter. Drivers are licence-verified before they can offer rides.
2. **Real-time & live** — rides are live "tokens" in the system, not a stale notice board. Matching happens on demand.
3. **Smart matching** — route-aware. A passenger going somewhere *on the way* of a driver's route still matches.
4. **Premium feel** — dark, elegant, animated. This is a portfolio piece + real product. Design quality is non-negotiable.

## The three modes (bottom tab bar)
- **Driver** — post a live ride token (start, end, time, seats, price/seat).
- **Passenger** — enter pickup + drop like Ola, search live tokens, get matched, request.
- **Auto Pool** — auto-rickshaw sharing. Two modes: "Right Now" live matching, and "Scheduled" slot matching. Preset routes (Amity↔Station, Amity↔IB).

## Verification stack
- **Amizone login** → proves Amity student/faculty. Pulls name, enrollment/employee ID, batch/programme, role.
- **Licence upload** → unlocks driver mode. Manual review at MVP (admin approves), DigiLocker later.
- **Verified badge** → shows on profile once approved.

## Key UX flows (summary — details in per-flow files)
- **Driver posts token** → sits silently in backend → surfaces only when a passenger's search matches route+time.
- **Passenger searches** → algorithm filters live tokens by time window, pickup proximity, and drop-near-route (polyline). Shows matches. Passenger can request one driver OR blast all. First driver to accept wins; others' notifications auto-dismiss with "already matched" message.
- **Auto Pool "Right Now"** → tap route → live search → instantly connects with others searching the same route at the same time.
- **Auto Pool "Scheduled"** → pick route + time slot → matched with others; app shows pool size and auto-splits fare.
- **After any match** → in-app chat opens with structured prompts (what time / which gate / fare confirmed).

## Out of scope for MVP (leave TODO(v2) comments)
- In-app payments (cash-only at MVP; convenience fee comes later)
- DigiLocker integration
- Multi-college support (Amity Mumbai only)
- iOS build (Android-first; keep code cross-platform though)
- Ratings/reviews (schema can include the table, UI optional)
