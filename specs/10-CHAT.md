# 10 — In-App Chat

Opens after any match (ride or auto pool). Match participants only.

## Screen (match/[matchId].tsx)
- Header: other participant(s) name + photo + verified badge; for auto pool, show route + split fare chip.
- Message list (Realtime on `messages` by match_id, ordered).
- Composer: text input + send.
- On mount, if empty, insert a **system message** summarizing the match:
  - ride: "You matched for <origin> → <dest> at <time>. Fare ₹<price>/seat."
  - autopool: "Pooling <route> at <time>. Split ₹<x> each."

## Structured quick prompts
Above the composer, show tappable chips that insert structured messages (kind='structured'):
- "What time exactly?"
- "Which gate / pickup point?"
- "Confirm fare ₹___"
- "On my way"
- "Reached"
Tapping sends that as a message (can be plain text for MVP).

## Data
- Insert into `messages` (match_id, sender_id, body, kind).
- RLS: only participants of match_id can select/insert.
- Realtime subscription updates the list live.

## Nice-to-have (TODO(v2))
- Read receipts, typing indicator, share live location. Keep MVP to text + structured chips.

## Safety
- Show a small "Keep it respectful — you're both verified Amity members" note on first open.
- Report/block button (TODO(v2): store reports).
