# Meau 🚗

A college-locked carpool + ride-sharing app for **Amity University Mumbai**. It
replaces the chaotic "Travel Partners" WhatsApp group — every user is a verified
Amity member (via Amizone login), and rides are matched by route, time, and
location proximity.

> **Status: v1.0** — Foundations + real Amizone-gated onboarding are complete and
> working on-device. Ride matching, chat, and auto-pool are on the roadmap below.

---

## ✨ What works in v1.0

- **Real Amizone verification.** Only genuine Amity members can get in — proven by
  a real login to the official Amizone portal, inside the app.
- **Onboarding flow** — welcome → Amizone login → complete your profile → into the app.
- **Session that sticks.** Log in once; you stay signed in. Lose the session
  (reinstall / new phone) and you just re-verify with Amizone.
- **Dark, themed UI** with a reusable component system (buttons, inputs, cards,
  sheets, sliders, steppers, skeletons, empty states) and a custom design token set.
- **Secure by construction** — profiles can only be created server-side after a
  real verification (Row-Level Security blocks client forgery). Amizone passwords
  are **never** stored, logged, or sent to our servers.
- **Full Supabase schema** (Postgres + PostGIS) for profiles, vehicles, ride
  tokens/requests, matches, chat, auto-pool and push tokens — with RLS policies and
  the atomic race-to-accept RPC ready for later phases.

## 🧗 The hard problem: verifying without storing passwords

The whole app hinges on proving someone is a real Amity student. Amizone has no
public API, so this took a few rounds:

| Attempt | Result |
|---|---|
| `go-amizone` (reverse-engineered API, server-side form POST) | ❌ Blocked — Amizone now sits behind **Cloudflare Turnstile** on login |
| Headless browser (Playwright) to pass Turnstile automatically | ❌ Blocked — Turnstile escalates to an interactive "Verify you are human" checkbox; automation can't pass it (and we won't auto-solve CAPTCHAs) |
| **In-app WebView — the human solves Turnstile** | ✅ **Works.** The user logs into the real Amizone page themselves; the app captures their Amizone ID and treats a successful login as proof of membership |

Design decisions that fell out of it:
- **No profile scraping.** Amizone's ID-card page is empty for some students and the
  dashboard is buried under notification pop-ups, so login *itself* is the gate — no
  fragile scraping. The user's name/details are collected in-app.
- **Incognito WebView** so every login is fresh and the password is always really
  checked (no stale session silently "passing").
- **No stored password.** Session persistence handles returning users; there's no
  Meau password to remember and nothing sensitive in the database.

## 🛠 Tech stack

- **App:** React Native + Expo (SDK 54) + TypeScript, expo-router, NativeWind,
  Reanimated, Zustand, React Query
- **Backend:** Supabase (Postgres + PostGIS, Auth, Storage, Realtime, RLS)
- **Services (Node + TS):** `amizone-auth` (verification + profile creation),
  `matching` (route-aware matching — upcoming)
- **Verification:** in-app WebView against the real Amizone portal

## 📁 Structure

```
app/                    # Expo React Native app
services/
  amizone-auth/         # /verify + /verify-webview — creates verified profiles (service role)
  amizone-real-test/    # throwaway Playwright probe (evidence Turnstile blocks automation)
supabase/migrations/    # schema + RLS + accept_ride_request RPC
specs/                  # full product/build spec
```

## 🚀 Run it

```bash
# 1. Supabase: run supabase/migrations/0001_init.sql, enable Anonymous auth
# 2. Auth service
cd services/amizone-auth && npm install && cp .env.example .env   # fill Supabase keys
npm run dev
# 3. App
cd app && npm install && cp .env.example .env   # fill Supabase + service URL (LAN IP)
npx expo start
```
Open in Expo Go (Android). Secrets live in gitignored `.env` files — never commit them.

## 🗺 Roadmap

- **Phase 2** — custom animated tab bar, Profile screen, become-a-driver (licence + vehicle)
- **Phase 3** — driver posts live ride tokens (maps, route polyline, price)
- **Phase 4** — matching service + passenger search (route-aware "on the way" matching)
- **Phase 5** — request → race-to-accept + realtime + push notifications
- **Phase 6** — in-app chat after a match
- **Phase 7** — Auto Pool (shared autos, live + scheduled)
- **Phase 8** — polish (the signature match moment, animations, dark maps)
- **Phase 9** — ship (EAS Android build)

---

*Uses an unofficial integration with the Amizone student portal for one-time
membership verification only. Not affiliated with Amity University.*
