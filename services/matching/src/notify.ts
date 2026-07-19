import type { SupabaseClient } from '@supabase/supabase-js';

// Phase 1 (F7) — drains notifications_outbox and delivers via the Expo Push API.
// Runs in the matching service (already has the service-role client + is always
// up alongside the API). Best-effort: Realtime is the reliable in-app path, so a
// dropped push is a degraded-but-acceptable outcome, never a correctness issue.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const EXPO_CHUNK = 100; // Expo accepts up to 100 messages per request

type OutboxRow = {
  id: string;
  profile_id: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
};

type ExpoTicket = { status: 'ok' | 'error'; details?: { error?: string } };

// Start the periodic drainer. `draining` guards against overlap WITHIN this
// single process (Railway runs one instance). Marks rows sent only after a
// non-throwing send cycle so a transient Expo/network outage retries next tick
// rather than silently dropping pushes.
// ponytail: single-instance assumption. If the matching service is ever scaled
// horizontally, replace the boolean guard + select-then-mark with an RPC that
// claims rows via SELECT ... FOR UPDATE SKIP LOCKED.
export function startNotificationDrainer(admin: SupabaseClient, intervalMs = 3000): void {
  let draining = false;
  setInterval(async () => {
    if (draining) return;
    draining = true;
    try {
      await drainOnce(admin);
    } catch (e) {
      console.error('notification drain failed:', (e as Error).message);
    } finally {
      draining = false;
    }
  }, intervalMs);
}

async function drainOnce(admin: SupabaseClient): Promise<void> {
  const { data: rows, error } = await admin
    .from('notifications_outbox')
    .select('id, profile_id, title, body, data')
    .is('sent_at', null)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw new Error(error.message);
  if (!rows || rows.length === 0) return;

  const outbox = rows as OutboxRow[];
  const profileIds = [...new Set(outbox.map((r) => r.profile_id))];

  // Resolve every recipient's device tokens in one query. A profile can have 0
  // (never registered / permission denied) or several (multiple devices).
  const { data: tokenRows } = await admin
    .from('push_tokens')
    .select('profile_id, expo_push_token')
    .in('profile_id', profileIds);

  const tokensByProfile = new Map<string, string[]>();
  for (const t of (tokenRows ?? []) as { profile_id: string; expo_push_token: string }[]) {
    const arr = tokensByProfile.get(t.profile_id) ?? [];
    arr.push(t.expo_push_token);
    tokensByProfile.set(t.profile_id, arr);
  }

  // Fan out one Expo message per (row × recipient token). channelId matches the
  // Android channel the client creates (lib/notifications.ts ANDROID_CHANNEL) so
  // delivery uses the intended HIGH importance instead of a fallback channel.
  const messages = outbox.flatMap((r) =>
    (tokensByProfile.get(r.profile_id) ?? []).map((to) => ({
      to,
      title: r.title,
      body: r.body,
      data: r.data,
      channelId: 'default',
    }))
  );

  let hardFailure = false;
  const invalidTokens: string[] = [];

  for (let i = 0; i < messages.length; i += EXPO_CHUNK) {
    const chunk = messages.slice(i, i + EXPO_CHUNK);
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(chunk),
      });
      // Non-2xx (e.g. 429 rate limit, 5xx) means Expo did NOT accept these —
      // treat as a hard failure so the batch is retried next tick rather than
      // being marked sent and silently dropped.
      if (!res.ok) {
        hardFailure = true;
        console.error('expo push HTTP error:', res.status);
        continue;
      }
      const json = (await res.json()) as { data?: ExpoTicket[] };
      (json.data ?? []).forEach((ticket, idx) => {
        // A token that Expo reports as unregistered is dead — prune it so we
        // stop paying to send to it (F7 edge case).
        if (ticket.status === 'error' && ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(chunk[idx].to);
        }
      });
    } catch (e) {
      hardFailure = true;
      console.error('expo push send failed:', (e as Error).message);
    }
  }

  if (invalidTokens.length > 0) {
    await admin.from('push_tokens').delete().in('expo_push_token', invalidTokens);
  }

  // Mark the batch drained unless the send hard-failed (network/Expo down) — in
  // which case leave them unsent to retry next tick. Rows for tokenless profiles
  // are cleared here too, so they don't accumulate. Realtime already delivered
  // the in-app update regardless.
  if (!hardFailure) {
    const ids = outbox.map((r) => r.id);
    await admin.from('notifications_outbox').update({ sent_at: new Date().toISOString() }).in('id', ids);
  }
}
