# MEAU — Claude Code Instructions

Meau is a college-locked carpool/ride-sharing app for Amity University Mumbai. Only verified Amity students/faculty can use it (verified via Amizone login). This file is your entry point — read all spec files in order before writing any code.

## Spec files (read in this order)
1. `00-PROJECT-OVERVIEW.md` — what the app is, core principles
2. `01-TECH-STACK.md` — exact stack, project setup commands
3. `02-DATABASE-SCHEMA.md` — full Supabase schema with RLS
4. `03-AUTH-AMIZONE.md` — Amizone verification flow (go-amizone microservice)
5. `04-APP-STRUCTURE.md` — navigation, screens, folder structure
6. `05-DRIVER-FLOW.md` — driver tab full spec
7. `06-PASSENGER-FLOW.md` — passenger tab + matching UX
8. `07-AUTO-POOL.md` — auto pool tab (two modes)
9. `08-MATCHING-SERVER.md` — Node.js matching algorithm service
10. `09-NOTIFICATIONS.md` — FCM + race-to-accept logic
11. `10-CHAT.md` — in-app chat after match
12. `11-UI-DESIGN.md` — design system, dark theme, animations (NON-NEGOTIABLE quality bar)
13. `12-BUILD-PLAN.md` — exact build order for the 2-day sprint

## Hard rules
- **Never store Amizone passwords.** Verify once against go-amizone, extract profile, discard credentials. Only a `verified_amity` flag + profile data persists.
- **Dark theme only** for MVP. Design quality is the #1 differentiator — see `11-UI-DESIGN.md`.
- **TypeScript everywhere** (app + server).
- **Every screen must handle**: loading, empty, error states. No dead-end screens.
- Driver features are **locked** until licence upload is approved.
- Ride tokens are **not a public feed** — they only surface via match queries.
- All money amounts in INR, integers (no paise decimals needed).
- Use environment variables for all keys. Create `.env.example` with every var documented.

## Working style
- Build in the exact order of `12-BUILD-PLAN.md`. Do not skip ahead.
- After each phase, output a manual test checklist for the developer to verify on device (Expo Go).
- When something is ambiguous, choose the simpler implementation and leave a `// TODO(v2):` comment.
- Commit after each working phase with a descriptive message.
