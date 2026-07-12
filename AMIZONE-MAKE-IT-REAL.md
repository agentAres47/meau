# Making Amizone Login REAL — task for Claude Code

The mock is only a placeholder. The real Amizone login is the product's core "wow" and must work. This file is the plan to make it real. Do these in order and report back after each step — don't silently fall back to mock.

## Background (how this works)
Amizone verification = server-side "login as the user, read their profile, discard the password." A service submits the student's credentials to Amizone the same way a browser does, confirms login succeeded, scrapes the profile (name, enrollment no., programme/batch), returns only that. This is exactly what go-amizone did. go-amizone is archived (Nov 2024) but the CODE may still work because Amizone's portal likely hasn't changed.

## Step 1 — Test if go-amizone still works today
- Clone the archived repo (github.com/ditsuke/go-amizone) source.
- Run it locally (it's Go; install Go if needed).
- Attempt a real login with ONE set of real credentials the human will provide (their own, never anyone else's).
- Report: does login succeed? Does it return correct name/enrollment/programme?
- If YES → go-amizone still works. Skip to Step 3 (self-host it).
- If NO → note the exact failure (auth changed? page structure changed? server unreachable?) → go to Step 2.

## Step 2 — If go-amizone is broken, build a minimal own verifier
Write a small service (Node + a headless approach) that:
- POSTs credentials to Amizone's actual login form endpoint (inspect s.amizone.net login network calls to get the exact endpoint, form fields, and any CSRF/anti-forgery token flow).
- Detects success vs failure (redirect to dashboard vs error message).
- On success, fetches the profile page and extracts: full name, enrollment/employee id, programme/batch, and (if available) whether student vs faculty.
- Returns sanitized profile JSON. NEVER logs or stores the password.
- Handle the anti-forgery token: Amizone (ASP.NET) login pages usually include a `__RequestVerificationToken` hidden field + cookie that must be fetched first (GET the login page) then submitted with the POST. Implement that two-step.
- If the login is heavily JS-protected, use a headless browser (Playwright) to drive the real login, then read the profile DOM.

## Step 3 — Self-host the working verifier
- Wrap whichever works (go-amizone or the custom verifier) behind the existing `amizone-auth` service `/verify` endpoint contract (see specs/03-AUTH-AMIZONE.md) so the app doesn't change.
- Deploy to Railway/Render. Set MOCK_AMIZONE=false in that environment.
- Keep MOCK_AMIZONE=true only for local UI development.

## Step 4 — Harden
- Rate-limit /verify (already spec'd).
- HTTPS only. No password in logs (grep to confirm).
- Add a clear error state in the app for "Amizone is unreachable right now, try again."
- Add a note in README: if Amity changes their portal, this is the file to update.

## Reporting
After Step 1, tell the human plainly: "go-amizone still works" or "it's broken, here's why, moving to custom verifier." Do not default to mock as the final answer — mock is dev-only.
