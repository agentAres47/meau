# 01 — Tech Stack & Setup

## Stack
| Layer | Choice |
|---|---|
| Mobile app | React Native + Expo (SDK latest stable), TypeScript |
| Navigation | expo-router (file-based) OR React Navigation — prefer expo-router |
| Styling | NativeWind (Tailwind for RN) |
| Animations | react-native-reanimated + Lottie (lottie-react-native) |
| State | Zustand (lightweight) + React Query (server state) |
| Backend/DB/Realtime/Storage | Supabase (Postgres + Realtime + Storage + Edge Functions) |
| Auth (college) | Custom via go-amizone microservice (see 03) |
| Session auth | Supabase Auth (anonymous → link to verified profile) |
| Maps | react-native-maps (Google provider) + Google Directions/Routes API |
| Push | Expo Notifications (wraps FCM) — simpler than raw FCM for Expo |
| Matching service | Node.js + Express + TypeScript (separate service) |
| Hosting (services) | Railway or Render (free tier) |

> Note: For Expo, prefer **Expo Notifications** over raw FCM — it's far less setup and works with the managed workflow. `09-NOTIFICATIONS.md` assumes Expo Notifications.

## Repos / folder layout (monorepo-lite)
```
meau/
  app/                 # Expo React Native app
  services/
    amizone-auth/      # go-amizone wrapper (or self-hosted go-amizone)
    matching/          # Node.js matching service
  supabase/            # migrations, edge functions
  specs/               # these md files
```

## App setup commands
```bash
# from meau/
npx create-expo-app@latest app --template
cd app
npx expo install expo-router react-native-safe-area-context react-native-screens expo-linking expo-constants expo-status-bar
npm install nativewind tailwindcss
npm install react-native-reanimated lottie-react-native
npm install zustand @tanstack/react-query
npm install @supabase/supabase-js react-native-url-polyfill
npx expo install react-native-maps expo-location
npx expo install expo-notifications expo-device
npx expo install expo-image-picker   # licence upload
```

## Matching service setup
```bash
# from meau/services/matching
npm init -y
npm install express cors dotenv @supabase/supabase-js
npm install -D typescript @types/express @types/node @types/cors tsx
npx tsc --init
```

## Environment variables (.env.example — document all)
App:
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY`
- `EXPO_PUBLIC_MATCHING_SERVICE_URL`
- `EXPO_PUBLIC_AMIZONE_AUTH_URL`

Matching service:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `GOOGLE_MAPS_API_KEY`
- `PORT`

Amizone auth service:
- `PORT`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`

## Google Maps API — enable these APIs in Google Cloud Console
- Maps SDK for Android
- Maps SDK for iOS
- Directions API (route polylines)
- Places API (location autocomplete for pickup/drop)
- Distance Matrix API (optional, for ETA)

Restrict the key by app package name + API set. Keep it in env, never hardcode.
