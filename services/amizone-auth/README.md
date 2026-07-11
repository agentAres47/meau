# amizone-auth

One-endpoint microservice that verifies a user is a genuine Amity member via
their Amizone credentials, then creates/links their Supabase `profiles` row.
Used only during onboarding.

## Security (non-negotiable — see specs/03-AUTH-AMIZONE.md)
- **Never stores the Amizone password.** It passes through memory for a single
  verification call and is then out of scope. It is never logged, returned, or
  persisted.
- Serve over **HTTPS only** in production.
- `/verify` is **rate limited** to 5 requests/min/IP.
- The **service role key** lives only here (server-side). It must never ship in
  the app bundle. Client profile inserts are blocked by RLS, so `verified_amity`
  can only be set by this service after a real verification.

## Endpoint
`POST /verify`
- Header: `Authorization: Bearer <supabase anon session access_token>`
- Body: `{ "amizone_id": "...", "password": "..." }`
- 200: `{ "verified": true, "profile": { amizone_id, full_name, role, batch, department } }`
- 401: `{ "verified": false, "error": "invalid_credentials" }` (bad Amizone creds)
       or `{ "error": "invalid_session" }` (bad/missing Supabase token)
- 502: `{ "error": "amizone_unavailable" }` (upstream go-amizone down)

`GET /health` → `{ "ok": true }`

## Run locally
```bash
cd services/amizone-auth
npm install
cp .env.example .env   # fill SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; keep MOCK_AMIZONE=true
npm test               # verifies the mock credential gate
npm run dev            # starts on :8080 with watch
```
Point the app's `EXPO_PUBLIC_AMIZONE_AUTH_URL` at this server. On a physical
device use your machine's LAN IP (e.g. `http://192.168.x.x:8080`), not localhost.

## Amizone integration status
`MOCK_AMIZONE=true` is the supported path today. Real Amizone verification is
deliberately deferred and `realVerify()` throws until it's built:

- `go-amizone` (ditsuke/go-amizone) is **archived (Nov 2024)**, and Amizone's
  login now sits behind **Cloudflare bot-protection**, which breaks its
  server-side form-POST approach.
- The only viable automation path is a **headless real browser (Playwright)**,
  which must be tested against live Cloudflare before it's trusted. If Cloudflare
  escalates to a CAPTCHA, the fallback is **college email-OTP** verification
  (still Amity-locked, 100% reliable).
- This is a separate, timeboxed task — do it when the app is otherwise done, not
  inline. Full plan: repo-root `AMIZONE-CLOUDFLARE-REALITY.md` and
  `AMIZONE-MAKE-IT-REAL.md`. If Amity changes their portal, that's where to look.
