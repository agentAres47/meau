# Amizone + Cloudflare — the real situation & your options

## What the screenshot tells us
Amizone's login now sits behind a **Cloudflare bot-protection check** ("Verifying…"). This is designed to block automated/scripted logins — which is exactly what a verification service does. This likely broke go-amizone and makes real Amizone verification HARDER than originally assumed. Be realistic about this before spending hours on it.

## What will and won't work
- ❌ Simple server-side form POST (go-amizone's original approach): probably blocked by Cloudflare now.
- ⚠️ Headless real browser (Playwright/Puppeteer): the only viable automation path. MIGHT pass the Cloudflare check because it's a real browser. But Cloudflare can escalate to a full CAPTCHA, which must NOT be auto-solved (against rules, and unreliable). Success is not guaranteed — it must be tested.
- ✅ Official partnership with Amity IT: the "correct" way, but unrealistic at student-project stage.

## Decision: test cheaply before committing
Spend at most ~2 focused hours on this test, not the whole project:
1. Build a tiny Playwright script: open s.amizone.net, fill YOUR credentials, submit, see if it reaches the dashboard past Cloudflare.
2. If it passes reliably → great, wrap it as the verifier, self-host, done. The wow factor is real.
3. If Cloudflare throws a CAPTCHA or blocks it → STOP. Do not fight Cloudflare. Move to the fallback below. This is not failure — it's the correct engineering call.

## Fallback that KEEPS a wow factor without fighting Cloudflare
If live Amizone automation won't work, you can still be "Amity-locked" and impressive:

**Option A — College email OTP (recommended fallback)**
- Verify the user owns an Amity email (e.g. @s.amity.edu / official domain).
- Send OTP, confirm. Clean, reliable, instant, free, unbreakable.
- Still "only real Amity people get in." Slightly less magical than Amizone but 100% dependable.

**Option B — Amizone screenshot + manual/OCR check (MVP-scale)**
- User uploads a screenshot of their logged-in Amizone dashboard showing name + enrollment.
- You verify manually at first (small scale), OCR later.
- Feels Amity-specific, no Cloudflare fight. Good enough to launch and prove demand.

**Option C — One-time Amizone check at a moment you control**
- Ask the user to paste a value only visible inside their Amizone account.
- Weak-ish, but combined with email OTP it's decent.

## Recommendation
1. Keep building the whole app on MOCK now — don't block product progress on this.
2. Do the 2-hour Playwright test as a SEPARATE session when the app is otherwise done.
3. If it works: ship the dream version. If it doesn't: ship with email-OTP verification (Option A) — still college-locked, still impressive, and reliable. Either way you have a working, verified, launchable app.

## What NOT to do
- Don't auto-solve CAPTCHAs (rule-breaking + fragile).
- Don't let this one feature stall the entire build for days.
- Don't promise "Amizone login" publicly until the Playwright test actually passes.
