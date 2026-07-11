# 03 — Auth via Amizone (go-amizone)

## Goal
Verify a user is a genuine Amity Mumbai student/faculty by checking their Amizone credentials **once**, extracting their profile, then discarding the password. Never store Amizone passwords.

## Component: amizone-auth microservice
A small Node/Express (or Go) service that wraps **go-amizone** (open-source reverse-engineered Amizone API: https://github.com/ditsuke/go-amizone — verify current URL/status). It exposes ONE endpoint used only during onboarding.

> IMPORTANT LEGAL/SECURITY NOTES (surface these to the developer, do not bypass):
> - This uses an unofficial API. It may break if Amizone changes. Acceptable for MVP scale.
> - Credentials pass through this service in memory only. Use HTTPS. Never log the password. Never persist it. Discard immediately after fetching profile.
> - Add rate limiting to prevent abuse.

### Endpoint
`POST /verify`
```json
// request
{ "amizone_id": "...", "password": "..." }

// success response (200)
{
  "verified": true,
  "profile": {
    "amizone_id": "...",
    "full_name": "...",
    "role": "student",         // or faculty/staff if derivable; default 'student'
    "batch": "...",
    "department": "..."
  }
}

// failure (401)
{ "verified": false, "error": "invalid_credentials" }
```

### Behaviour
1. Receive credentials.
2. Call go-amizone to attempt login + fetch profile (name, enrollment, programme/semester).
3. On success: return sanitized profile. **Do not** return or store the password anywhere.
4. On failure: return 401.
5. Never write credentials to logs, DB, or disk.

## App-side onboarding flow
1. **Welcome screen** → "Login with Amizone".
2. **Amizone credentials screen** → user enters ID + password. Copy states clear: "We verify you once with Amizone and never store your password."
3. App calls `EXPO_PUBLIC_AMIZONE_AUTH_URL/verify`.
4. On `verified:true`:
   - Create a Supabase Auth session for the app (anonymous sign-in, or email-less custom). Simplest: `supabase.auth.signInAnonymously()` then create/link a `profiles` row with `verified_amity=true` and the returned profile data, keyed by `amizone_id` (unique).
   - If a profile with this `amizone_id` already exists, link the anonymous auth user to it (return user / re-auth path) — handle "already registered" by signing them back into the existing profile. (For MVP, simplest: store amizone_id and on next login match it.)
5. **Profile completion screen** → confirm role (student/faculty/staff), add phone, gender, photo (optional). Prefill name/batch/department from Amizone.
6. Land on the main app (Passenger tab by default).

## Re-login / persistence
- Persist the Supabase session (AsyncStorage via supabase-js storage adapter).
- On app open with a valid session → skip onboarding.
- If session lost → user re-verifies with Amizone (cheap, one call).

## Security checklist for developer
- [ ] amizone-auth served over HTTPS only
- [ ] No password logging anywhere (grep the code)
- [ ] Rate limit /verify (e.g. 5/min/IP)
- [ ] Profile row uses service role on server, not client
- [ ] `.env` holds service role key on server only, never in app bundle
