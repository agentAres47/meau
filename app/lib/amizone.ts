import { supabase } from './supabase';

const BASE = process.env.EXPO_PUBLIC_AMIZONE_AUTH_URL;

// fetch with a hard timeout so a bad network path fails fast instead of hanging.
async function fetchWithTimeout(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export type WebviewProfile = {
  amizone_id: string;
  full_name?: string;
  batch?: string | null;
  department?: string | null;
};

// Confirms a real in-WebView Amizone login to the server, which creates/links
// the verified row keyed by the Amizone login id. Client-attested (see
// /verify-webview on the server). Throws a user-facing message on failure.
export async function verifyWebview(params: {
  token: string;
  profile: WebviewProfile;
}): Promise<void> {
  if (!BASE) throw new Error('Verification service is not configured.');

  let res: Response;
  try {
    res = await fetchWithTimeout(`${BASE}/verify-webview`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify(params.profile),
    });
  } catch {
    throw new Error("Couldn't reach the verification service. Check your connection.");
  }

  if (res.ok) return;

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 400 && body.error === 'invalid_amizone_id') {
    throw new Error("Couldn't read your Amizone ID. Try logging in again.");
  }
  if (res.status === 401) {
    // The server rejected our Supabase token outright (its auth.users row is
    // gone — e.g. the account was deleted or the DB was wiped since this
    // device last signed in). ensureSession() would otherwise keep handing
    // back this same dead cached session forever, so "Try again" could never
    // actually work. Clear it now so the next ensureSession() mints a fresh
    // anonymous session instead of looping on this one.
    await supabase.auth.signOut();
    throw new Error('Your session expired. Please try again.');
  }
  throw new Error('Verification is unavailable right now. Try again in a moment.');
}
