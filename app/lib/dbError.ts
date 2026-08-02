import type { PostgrestError } from '@supabase/supabase-js';

// Supabase calls across this app deliberately degrade to null/[] rather than
// throwing, so one flaky query never blows up a screen. That resilience is
// worth keeping — but combined with silence it hid a real bug for weeks:
// my_ride_history() threw 42702 on EVERY call for EVERY user, getRideHistory
// turned it into `[]`, and the UI rendered a confident "No rides yet". A broken
// query and a genuinely empty list were indistinguishable, on-device and in the
// logs.
//
// So: keep the graceful fallback, never let the failure be silent. Callers stay
// exactly as forgiving as before; the difference is that a failure now says so.
export function logDbError(context: string, error: PostgrestError | null): void {
  if (!error) return;
  const detail = [error.message, error.code && `code=${error.code}`, error.details, error.hint]
    .filter(Boolean)
    .join(' | ');
  console.error(`[db] ${context} failed: ${detail}`);
}
