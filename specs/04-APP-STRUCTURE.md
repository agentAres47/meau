# 04 — App Structure & Navigation

## Navigation (expo-router)
```
app/
  _layout.tsx                 # root: providers (QueryClient, Supabase, theme), session gate
  index.tsx                   # splash / session check → redirect
  (onboarding)/
    welcome.tsx
    amizone-login.tsx
    complete-profile.tsx
  (tabs)/
    _layout.tsx               # bottom tab bar: Driver | Passenger | Auto Pool
    driver.tsx
    passenger.tsx
    autopool.tsx
  ride/
    search-results.tsx        # passenger match results
    token-detail.tsx          # driver's token detail / incoming requests
  match/
    [matchId].tsx             # chat screen for a match
  profile/
    index.tsx                 # profile, verified badge, become-a-driver
    become-driver.tsx         # licence + vehicle upload
  modal/
    location-picker.tsx       # map-based pickup/drop picker
```

## Session gate logic (root _layout)
- On mount: check Supabase session.
- No session → `(onboarding)/welcome`.
- Session but incomplete profile (no phone/role confirmed) → `(onboarding)/complete-profile`.
- Else → `(tabs)/passenger`.

## Bottom tab bar
Three tabs, custom-styled (not default). Icons: steering wheel (Driver), person-pin/search (Passenger), auto-rickshaw (Auto Pool). Center emphasis optional. Dark, minimal, with a smooth active indicator (Reanimated).

- **Driver tab**: if user is NOT `is_driver_verified`, show a gated state with a CTA "Become a driver" → `profile/become-driver`. Do not show posting UI until verified.

## Folder conventions
```
app/
  components/     # reusable UI (Button, Card, Sheet, Avatar, PriceSlider, MapPreview...)
  lib/            # supabase client, api clients, query hooks, geo utils, formatters
  store/          # zustand stores (session, activeRide)
  theme/          # colors, spacing, typography tokens
  hooks/          # useSession, useProfile, useLiveMatches...
  assets/lottie/  # animation json files
```

## Global providers (root)
- `QueryClientProvider` (React Query)
- Supabase client (singleton in `lib/supabase.ts` with AsyncStorage adapter + `react-native-url-polyfill/auto`)
- Theme provider (dark tokens)
- Notifications registration on login

## Empty/loading/error rule
Every data screen must implement three states with proper visuals (skeletons for loading, illustrated empty states, friendly error with retry). No spinners-only, no dead ends.
