# 09 — Notifications (Expo Push / FCM)

Use **Expo Notifications** (wraps FCM on Android). Simpler than raw FCM in managed Expo.

## Registration
- On login/app open (after profile exists): request permission, get `ExpoPushToken` (needs a projectId / EAS).
- Upsert into `push_tokens` (profile_id + token).
- Handle token refresh.

## Server sending (matching service)
Use `expo-server-sdk`. Send to a profile by looking up their push_tokens.

## Notification types
| Type | Trigger | Payload data | Effect in app |
|---|---|---|---|
| `new_request` | passenger requests driver's token | request_id, token_id, passenger summary | driver sees incoming request card; deep-link to token-detail |
| `matched_passenger` | a driver accepted | match_id, driver summary | passenger waiting screen → Matched!; open chat |
| `request_dismissed` | another driver won the race | request_id, token_id | remove/mark that incoming request card as "already matched"; if it was shown as a notification, dismiss it |
| `autopool_matched` | pool grouped | match_id, pool info | open pool matched state / chat |
| `new_message` | chat message | match_id | in-chat / badge |

## Race-to-accept auto-dismiss
When `/accept` wins:
- Passenger: `matched_passenger` push + realtime update.
- Losing drivers: `request_dismissed` push. The app, on receiving it (foreground) OR via Realtime subscription on `request_targets`, updates the incoming-request UI to a disabled "This passenger has already been matched" state and auto-removes it after a moment.
- Also dismiss the delivered OS notification if present: `Notifications.dismissNotificationAsync(identifier)` — track identifiers by request_id+token_id in a local map, or use `dismissAllNotificationsAsync` sparingly.

## Foreground vs background
- Configure a notification handler so foreground notifications still surface (or are handled silently for dismiss events).
- For `request_dismissed`, prefer a **data-only** message so it doesn't show a banner — it just updates UI. (Expo: send with no title/body, only `data`.)

## Realtime as source of truth
Push is best-effort. The **authoritative** updates come from Supabase Realtime subscriptions:
- driver: subscribe `request_targets` where driver_id=me
- passenger: subscribe own `ride_requests` row
- pool: subscribe `auto_pool_sessions` by pool_group_id
- chat: subscribe `messages` by match_id
Push notifications wake/alert; Realtime drives the actual UI state. Build both.
