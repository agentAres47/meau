# MeAau — Full QA Checklist (A–Z)

*Written for hands-on device testing with **two paired Android phones** driven over ADB + Metro hot-reload. Every item is a thing to actually **do on a device**, not a code review item.*

**Legend**
- ⬜ untested
- 🔁 **regression** — this exact thing broke before and was fixed; prove it stays fixed
- 👥 **two-device** — needs both phones, one as driver, one as passenger
- 🐛 **known broken / known gap** — expected to fail, don't be surprised

---

## A. Account & Onboarding
- ⬜ Fresh install → Welcome screen renders (logo, tagline, "Login with Amizone", admin gear top-left)
- ⬜ Tap "Login with Amizone" → WebView loads real Amizone, banner reads "Log in and tick Verify you are human"
- ⬜ Complete a real Amizone login → lands on complete-profile, NOT stuck on WebView
- ⬜ Wrong Amizone password → Amizone's own error shows, our loader drops, can retry in-page
- ⬜ Kill app mid-WebView → relaunch goes back to Welcome (not a broken half-state)
- ⬜ complete-profile: name prefilled from Amizone, "Verified as <amizone_id>" line correct
- ⬜ Phone validation: `123` rejected, `9876543210` accepted
- ⬜ Role chips (Student/Faculty/Staff) — selection visually obvious
- ⬜ Department + Gender optional — can skip both
- ⬜ Add photo → picker opens, photo appears in Avatar, uploads without error
- 🔁 ⬜ **Keyboard on complete-profile** — typing name/phone: keyboard sits BELOW the input, doesn't cover it
- ⬜ "Not you? Sign out" → returns to Welcome, session cleared
- ⬜ Step 2 (driver application) → "Skip for now" works, lands in tabs
- ⬜ Step 2 → actually submit licence + vehicle → lands in tabs, profile shows "under review"

## B. Backgrounding & App Lifecycle
- 🔁 ⬜ Background app 10s → reopen → returns to the SAME screen, no crash, no bounce to home
- 🔁 ⬜ Background app 5 min → reopen → same
- 🔁 ⬜ Force-stop → relaunch → lands correctly (tabs if onboarded)
- 🔁 ⬜ Force-stop **while in an active pool** → relaunch → restores INTO the pool, not home
- 🔁 ⬜ Force-stop **while on a matched ride** → relaunch → restores into the matched ride
- 🔁 ⬜ Force-stop after a ride COMPLETED → relaunch → lands on normal tab, **does not** re-enter the finished ride *(this was the infinite-loop bug)*
- ⬜ Rotate device / fold-unfold (if applicable) → no layout break
- ⬜ Phone lock → unlock → app still responsive, map still alive

## C. Chat / Messaging
- 👥 ⬜ Open chat from a match → header shows other person's name + verified tick (directed ride)
- 👥 ⬜ Autopool chat → header shows route label + "N pooling" + "End ride"
- ⬜ Safety banner ("Keep it respectful…") renders once at top
- ⬜ System summary message renders (route/time), only once — not duplicated on re-open
- 👥 ⬜ Send message from phone A → appears on phone B **within ~1–2s** (realtime)
- 👥 ⬜ Send from B → appears on A
- ⬜ Own messages right-aligned pink, theirs left-aligned grey
- ⬜ Quick-reply chips ("What time exactly?", "Which gate / pickup point?", "On my way", "Reached") send correctly
- 🔁 ⬜ **Keyboard**: tap composer → input + send button rise above keyboard, fully visible
- 🔁 ⬜ Keyboard: type a long multi-line message → composer grows, still visible
- ⬜ Send empty/whitespace message → blocked (send button disabled)
- ⬜ Scroll up through history → scroll position sane, auto-scrolls to bottom on new message
- 👥 ⬜ Autopool: tap back → "Leave this pool?" alert → Leave → other phone gets kicked back to Auto Pool tab

## D. Driver Tab
- ⬜ Non-verified driver → sees "Verify your licence to offer rides" empty state
- ⬜ Pending driver → sees "Licence under review"
- ⬜ Verified driver, no live ride → map + "Post a ride" card + When row + "Start ride"
- 🔁 ⬜ **Map centres on your actual location** on first open of Driver tab (not stuck on default Mumbai region)
- 🔁 ⬜ Driver tab map behaves identically to Passenger tab map (same markers, same recenter)
- ⬜ Set pickup via location picker → label fills, marker drops, camera moves
- ⬜ Set drop → route polyline draws between the two
- 🔁 ⬜ **"Now" + Start ride → works** (does NOT say "Pick a departure time in the future")
- ⬜ "Pick a time" → TimePickerSheet opens (dark sheet, Today/Tomorrow chips, 15-min slots)
- ⬜ Pick a future slot → chip shows that time → Start ride works
- ⬜ Seats confirm sheet: stepper min/max respects vehicle seats (bike = 1)
- 🔁 ⬜ Seats sheet shows **no** "Suggested price" row *(price estimates are intentionally hidden)*
- ⬜ Confirm → live token card appears: LIVE badge, route, departs, seats left
- 🔁 ⬜ **"Cancel ride" button is visible without scrolling/dragging** the sheet
- ⬜ Cancel ride → token goes away, back to post-a-ride state
- 🔁 ⬜ While live as driver → **Passenger + Auto Pool tabs are dimmed and unresponsive** (self-match lock), soft buzz on tap
- ⬜ Cancel the live ride → tabs unlock immediately

## E. Errors & Empty States
- ⬜ Turn off WiFi + data → search for rides → friendly error, not a crash or infinite spinner
- ⬜ Airplane mode → open each tab → each shows a sane state
- ⬜ Passenger search with no live drivers → "No rides your way right now" empty state + "Back to search"
- ⬜ Driver with no incoming requests → no empty list junk, just the live card
- ⬜ Ride history with nothing → "No rides yet" empty state
- ⬜ Deliberately break a match (cancel from DB) → screen recovers, doesn't hang
- ⬜ Every loading state shows a spinner, never a blank white/black void > 3s

## F. Fares & Pricing
- ⬜ Passenger picks offer via slider (₹20–₹300, step 5) → number updates live
- 👥 ⬜ **Passenger's chosen price is what the driver sees** on the incoming request card
- 👥 🔁 ⬜ **Matched screen shows the passenger's offered price**, not the driver's token price *(migration 0022)*
- 🔁 ⬜ Autopool route cards show **no** "~₹230 full auto" estimate
- 🔁 ⬜ Autopool chat summary has **no** "Split ₹X each" line
- ⬜ History rows show the fare that was actually agreed

## G. GPS & Location
- ⬜ First launch → location permission prompt appears at a sensible moment
- ⬜ Deny location → app still usable (search manually), no crash
- ⬜ Grant location → pickup auto-fills with current location
- 🔁 ⬜ **Recenter button is fast** (<1s, not a multi-second stall)
- ⬜ Recenter while map is panned far away → snaps back to you
- ⬜ Current-location marker (pulsing pink dot) appears at the right coordinates
- ⬜ Move physically / mock location → recenter reflects the new position

## H. History
- ⬜ Profile → "Ride history" opens
- ⬜ Completed ride appears in list after ending one
- ⬜ Cancelled ride appears with red ✕ "Cancelled"
- 🔁 ⬜ **No "Rated / Not rated" star column** *(ratings were removed)*
- ⬜ Autopool ride shows route label (e.g. "IB → Amity"), not blank
- ⬜ Directed ride shows "origin → destination"
- ⬜ Newest first
- ⬜ Fare shown per row where known

## I. Incoming Requests (driver side)
- 👥 ⬜ Passenger requests → **driver's phone shows the request card within seconds** (realtime)
- 👥 ⬜ Card shows passenger name, photo, pickup→drop, offered price
- 👥 ⬜ Tap "Accept" → both phones land on the matched screen
- 👥 ⬜ Tap "Decline" → card disappears on driver; passenger gets "No driver available" if no others pending
- 👥 ⬜ Push notification arrives on driver's phone when a request comes in **while app is backgrounded**
- 👥 🔁 ⬜ **Tapping that notification opens the request screen — no crash, no bounce to home**
- 👥 ⬜ Dedicated request screen shows ETA line ("Pickup in ~N min · X km")
- 👥 ⬜ Two passengers request the same driver → both cards appear
- 👥 ⬜ Accept one → seats decrement correctly

## J. Journey Completion (End ride)
- 👥 ⬜ "End ride" on matched screen → both phones leave to their tab
- 🔁 ⬜ **No rating/feedback screen appears** *(feature removed)*
- 🔁 ⬜ **App does not get stuck** after ending — lands on Driver/Passenger tab and stays there
- 🔁 ⬜ Relaunch after ending → normal tab, NOT back into the finished ride
- 👥 ⬜ Autopool "End ride" from chat header → both poolers leave to Auto Pool tab
- ⬜ Ended ride appears in History as completed

## K. Keyboard *(all 🔁 — this was broken app-wide)*
- 🔁 ⬜ Chat composer — input above keyboard
- 🔁 ⬜ complete-profile (name, phone) — inputs above keyboard
- 🔁 ⬜ become-driver (make/model, colour, plate) — inputs above keyboard
- 🔁 ⬜ Admin login (ID, password) — inputs above keyboard
- 🔁 ⬜ Location picker search field — list still usable with keyboard up
- ⬜ Dismiss keyboard (back / tap away) → layout returns cleanly, no leftover gap
- ⬜ Switch between two inputs → no jump/flicker

## L. Location Picker
- ⬜ Opens as a modal from pickup/drop rows (both Driver and Passenger)
- ⬜ Autofocus on search field
- ⬜ Type 3+ chars → Google suggestions appear (~300ms debounce)
- ⬜ Type <3 chars → recents show instead
- ⬜ Tap a suggestion → returns, fills the correct field (pickup vs drop)
- ⬜ "Use current location" → fills with your address
- ⬜ Recents persist across app restarts, capped at 6, no duplicates
- ⬜ Close (✕) without picking → returns, previous value unchanged
- ⬜ Driver picker and Passenger picker don't overwrite each other's draft

## M. Maps & Markers
- ⬜ Dark map style everywhere (no bright default Google map anywhere)
- ⬜ Pickup marker = pink ring, Destination = green pin, Current location = pulsing dot
- 🔁 ⬜ **No default red Google teardrop markers anywhere** — including the small preview maps on request/matched/search-result cards
- ⬜ Route polyline draws in accent pink
- ⬜ Map preview on matched screen shows the real route
- ⬜ Map doesn't freeze/jank when switching tabs repeatedly
- ⬜ Pinch/pan/zoom smooth on both phones

## N. Notifications
- 🔁 ⬜ **Permission prompt appears right after first login** (not only much later)
- ⬜ Deny permission → app fully usable, in-app realtime still works
- 👥 ⬜ Chat message while app backgrounded → push arrives
- 👥 🔁 ⬜ **While ON the chat screen for that match → NO push** (suppressed correctly)
- 👥 🔁 ⬜ While on the *ride/matched* screen → push **does** arrive (only chat suppresses)
- 🔁 ⬜ Opening a chat **clears** that match's notifications from the tray
- 👥 ⬜ Match accepted → passenger gets a push
- 👥 ⬜ Ride cancelled by other party → push arrives
- 👥 ⬜ Autopool formed → both get a push
- 🔁 ⬜ Tapping any push → correct screen, **no crash, no bounce to launcher**
- 🔁 ⬜ Tap a push, then later cold-start the app normally → does **not** replay that old notification *(sticky-response bug)*

## O. Offline / Network
- ⬜ Kill WiFi mid-search → error message, retry works after reconnect
- ⬜ Kill WiFi mid-chat → messages queue or fail visibly, no crash
- ⬜ Reconnect → realtime resubscribes, new messages flow again
- ⬜ Slow network (throttle) → loading states hold, no duplicate submissions
- ⬜ Double-tap "Find rides" / "Start ride" fast → only ONE request/token created

## P. Passenger Tab
- ⬜ Map + "Find a ride" card + When row + "Find rides" CTA
- ⬜ Pickup auto-fills with current location on open
- ⬜ Set drop → route draws, camera fits both points
- ⬜ "Find rides" with no drop set → sensible error, doesn't crash
- ⬜ Fare sheet opens → slider works → "Find rides" confirms
- ⬜ Results list renders driver cards (name, verified tick, vehicle, detour, seats, departs)
- 🔁 ⬜ **Multi-select**: tap 2–3 driver cards → each shows "Selected" state
- 🔁 ⬜ Bottom CTA reads "Request N drivers" and fires all at once
- ⬜ Waiting screen reads "Asked N drivers…" for N>1
- ⬜ Waiting screen: sleeping cat + rotating status lines
- ⬜ Cancel from waiting → back to search, request cancelled server-side
- 🔁 ⬜ Passenger tab does **not** bounce/loop when there's no active ride

## Q. Queue / Auto Pool
- ⬜ Tab shows mode chips (Right now / Scheduled) + 4 route cards
- ⬜ Pick route → card border highlights
- ⬜ "Find a pool now" → waiting state (sleeping cat, "Searching now…")
- 🔁 ⬜ **Scheduled mode**: pick a slot → "Join this slot" → waiting state says "Queued for <time>"
- 🔁 ⬜ **A scheduled session survives longer than 5 minutes** *(was silently expiring — migration 0023)*
- 👥 ⬜ Both phones pick "now" + same route → **pooled within ~5s**, both land in chat
- 👥 ⬜ Both pick the same scheduled slot + route → pooled
- ⬜ Cancel while waiting → returns to picker
- ⬜ No pool found in 5 min ("now" mode) → "No one right now — try scheduled or retry."
- 👥 ⬜ One leaves the pool → other returns to Auto Pool tab and can search again

## R. Realtime Sync (two-device) 👥
- 👥 ⬜ Driver posts ride → passenger's search finds it without app restart
- 👥 ⬜ Passenger requests → driver sees card without restart
- 👥 ⬜ Driver accepts → passenger's waiting screen auto-advances to matched
- 👥 ⬜ Either cancels → other side is told and leaves
- 👥 ⬜ Either ends ride → other side leaves
- 👥 ⬜ Chat messages both directions
- 🔁 ⬜ **Leave both phones open on the same match for 2+ min → neither crashes** *(realtime channel-collision crash)*
- 🔁 ⬜ Rapidly switch tabs on both phones repeatedly → no crash *(same channel bug)*

## S. Session & Auth
- ⬜ Sign out from Profile → returns to Welcome
- ⬜ After sign-out, relaunch → Welcome, not tabs
- ⬜ Sign back in on the same phone → same profile, history intact
- ⬜ Two different accounts on two phones stay independent (no data bleed)
- ⬜ Admin gear → admin login → wrong password rejected
- ⬜ Admin login correct → dashboard loads
- ⬜ Admin logout → back to Welcome, student session unaffected

## T. Two-device Race Conditions 👥
- 👥 ⬜ Both phones request the SAME driver simultaneously → exactly one wins, loser sees "already taken"
- 👥 ⬜ Driver accepts at the same moment passenger cancels → no corrupt state, both end up somewhere sane
- 👥 ⬜ Both tap "End ride" at the same time → no double-complete error
- 👥 ⬜ Driver cancels token while passenger is mid-request → passenger told cleanly
- 👥 ⬜ Two passengers, one 2-seat driver → both can match; 3rd is refused (seats respected)
- 👥 ⬜ Passenger requests, driver's app is backgrounded → push + card still correct on reopen

## U. UI Polish & Placement
- ⬜ Tab dock: glass look, correct active colour, labels legible
- ⬜ Nothing hidden behind the dock on any screen (scroll to the bottom of every list)
- ⬜ Nothing hidden behind the status bar / notch at the top
- ⬜ Profile avatar visible in the top-right of Driver + Passenger (has a hairline border)
- ⬜ Glass panels: translucent with a subtle sheen, not flat opaque grey
- ⬜ Bottom sheets drag smoothly, snap points sensible
- ⬜ Buttons show pressed state; disabled buttons look disabled
- ⬜ Text: no clipped labels, no overflow, no `undefined`/`null` anywhere on screen
- ⬜ Long place names truncate with "…" rather than breaking layout
- ⬜ Dark theme consistent — no white flashes on navigation
- ⬜ Splash screen shows the **new** MeAau logo, not the old placeholder
- ⬜ Launcher icon is the new logo *(needs full uninstall+reinstall to refresh Android's cache)*

## V. Vehicle & Driver Verification
- ⬜ Become a driver → licence upload (picker opens, image previews)
- ⬜ Vehicle type Car/Bike → seats stepper adjusts (bike locks to 1)
- ⬜ Plate validation: `MH01AB1234` ok, `22BH1234A` ok, `hello` rejected
- ⬜ Submit → profile shows "Licence under review"
- ⬜ Admin dashboard → application appears in the queue with licence photo visible
- ⬜ Admin approves → driver's Driver tab unlocks (may need refocus)
- ⬜ Admin rejects with reason → driver sees the rejection + "Re-submit"
- ⬜ Re-submit after rejection works

## W. Waiting States
- ⬜ Passenger waiting screen: cat + rotating lines, cancel works
- ⬜ Auto Pool waiting: cat + route line, cancel works
- ⬜ Neither waiting screen spins forever with no exit
- ⬜ Match found while waiting → auto-advances (no manual refresh needed)
- ⬜ Haptic fires at the match moment

## X. eXpiry & Timeouts
- ⬜ Live ride token past its departure time → expires (stops appearing in searches)
- ⬜ Passenger request older than 30 min while still searching → expires with a clear message
- ⬜ "Now" autopool session unmatched after 5 min → expires with the "no one right now" notice
- 🔁 ⬜ **Scheduled autopool session does NOT expire early** — survives until its slot time
- ⬜ Expired states never leave a screen stuck

## Y. Yield / Cancellation flows
- ⬜ Driver cancels live token (no matches yet) → clean
- 👥 ⬜ Driver cancels AFTER a match → passenger gets "Ride cancelled" alert, leaves cleanly
- 👥 ⬜ Passenger cancels a matched ride → driver's matched list updates, seat returns
- 🔁 👥 ⬜ **Cancel on one phone does NOT crash the other phone** *(this crashed before)*
- ⬜ Passenger cancels while searching → request cleared, can search again
- ⬜ Cancel from the waiting screen → no orphaned "searching" request left behind
- ⬜ After any cancellation, both users can immediately start something new

## Z. Zero-state / Fresh Install
- ⬜ Brand new account, empty DB → every tab renders a sensible empty state
- ⬜ No leftover data from a previous account after sign-out + new sign-in
- ⬜ First-ever ride flows end-to-end without any pre-existing data
- ⬜ Profile with no photo → initials avatar (visible, bordered)
- ⬜ Profile with no phone/batch/department → no blank rows or "null"

---

## 🐛 Known gaps — expected to fail, already understood

| Item | Status |
|---|---|
| **Account deletion** (5 missing `on delete cascade` FKs) | Deleting a user with ride history throws a FK error. Real bug — `delete-account.html` promises this works. **Migration not yet written.** |
| **F2 true-detour matching** | Deliberately parked (costly Directions calls). Matching uses the cheap corridor filter; price estimates hidden because of it. |
| **F6 state machine / F5 QR start / F4 daily commute** | Never built. |
| **EAS cloud builds** | Free-tier quota exhausted until **1 Aug 2026**. Use the local dev client — JS/TS changes need no build at all. |
| **`expo run:android` on Windows** | Works. `eas build --local` does **not** (macOS/Linux only). |
| **`adb shell pm clear`** | Blocked on the OnePlus by OEM policy; works on the Samsung. Clear storage manually via Settings on the OnePlus. |

---

## Suggested testing order

1. **Z → A → S** (fresh install, onboarding, auth) — get both phones into a known-good signed-in state
2. **D → P → Q** (each tab solo on one phone)
3. **I → R → T** (👥 the real value: two-device matching, realtime, races)
4. **C → N** (👥 chat + notifications together)
5. **J → Y** (👥 completion and cancellation — the flows that broke most often)
6. **K → U → M** (polish sweep, fast)
7. **E → O → X** (failure modes, last — they leave messy state behind)
