# Amizone Real Login — focused build session

Goal: replace the mock with REAL Amizone verification if technically possible. This is an experiment with an uncertain outcome (Amizone sits behind Cloudflare bot-protection). Timebox it. Do the steps in order and STOP at the first one that gives a working result or hits the hard wall.

## Ground rules
- Test ONLY with the human's own Amizone credentials. Never anyone else's.
- Never log, store, or persist the password. In-memory only, discard after use.
- Do NOT attempt to auto-solve CAPTCHAs. If Cloudflare escalates to a visible CAPTCHA challenge, STOP and report — that's the hard wall.
- Keep the existing /verify contract identical so the app doesn't change: swapping mock→real must need zero app edits.
- Keep MOCK_AMIZONE=true as the default; only the deployed/real service flips it off. Don't break the working mock.

## Step 1 — Does go-amizone still work today? (fastest path, ~20 min)
- Clone github.com/ditsuke/go-amizone (archived but code intact).
- Install Go if needed. Build/run its API server locally.
- Attempt a real login with the human's credentials.
- REPORT clearly: does it (a) log in and return correct name/enrollment/programme, (b) fail at login, or (c) get blocked by Cloudflare?
- If (a): wrap it behind /verify, done. Skip to "Wire-up".
- If (b)/(c): go to Step 2.

## Step 2 — Headless real browser via Playwright (~1–2 hr, uncertain)
- Add a Node script using Playwright (real Chromium, headful first for debugging, then headless).
- Flow: open s.amizone.net → wait for Cloudflare "Verifying…" to resolve → fill username+password → submit → detect success (dashboard) vs failure (error) → scrape profile (name, enrollment/employee id, programme/batch, student vs faculty if derivable).
- Handle the ASP.NET anti-forgery token if a direct approach is used (GET login page for __RequestVerificationToken + cookie, submit with POST) — but prefer letting the real browser handle it natively.
- REPORT: does Cloudflare let the automated browser through, or does it throw a CAPTCHA / block?
  - Passes through reliably → wrap behind /verify, done.
  - Throws a CAPTCHA → STOP. Report it. Do not try to defeat it.

## Step 3 — If blocked, summarize options (don't build yet)
State plainly that live Amizone automation is blocked by Cloudflare, and lay out the fallbacks for the human to choose:
- Email-domain OTP verification (reliable, recommended)
- Amizone dashboard screenshot upload + manual/OCR check (keeps Amity-specific feel)
Let the human decide before building a fallback.

## Wire-up (only if Step 1 or 2 works)
- Put the working verifier behind the amizone-auth /verify endpoint, same request/response shape as the mock.
- Run it as its own service (it may need a browser runtime for Playwright — note deployment implications: Railway/Render with a Playwright buildpack, or a container).
- Test end-to-end from the app on device: real login → real profile created.
- Keep secrets in env. Confirm password is never logged (grep).
- Commit.

## Report format after each step
"Step N result: WORKS / FAILS (reason) / BLOCKED (Cloudflare CAPTCHA)." Then recommend continue or fall back. Do not silently default to mock as the final answer — but do keep mock working as the dev default.
