const BASE = process.env.EXPO_PUBLIC_AMIZONE_AUTH_URL;

// Calls the amizone-auth service to verify credentials and create/link the
// profile row server-side. The password leaves the device only to this call and
// is never stored anywhere. Throws a user-facing message on failure.
export async function verifyAmizone(params: {
  amizoneId: string;
  password: string;
  token: string;
}): Promise<void> {
  if (!BASE) throw new Error('Verification service is not configured.');

  let res: Response;
  try {
    res = await fetch(`${BASE}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${params.token}`,
      },
      body: JSON.stringify({ amizone_id: params.amizoneId, password: params.password }),
    });
  } catch {
    throw new Error("Couldn't reach the verification service. Check your connection.");
  }

  if (res.ok) return;

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (res.status === 401 && body.error === 'invalid_credentials') {
    throw new Error('Incorrect Amizone ID or password.');
  }
  if (res.status === 401) {
    throw new Error('Your session expired. Please try again.');
  }
  if (res.status === 429) {
    throw new Error('Too many attempts. Wait a minute and try again.');
  }
  throw new Error('Verification is unavailable right now. Try again in a moment.');
}

export type ScrapedProfile = {
  amizone_id: string;
  full_name: string;
  batch: string | null;
  department: string | null;
};

// Sends the profile the app scraped from a real in-WebView Amizone login to the
// server to create/link the verified row. Client-attested (see /verify-webview
// on the server). Throws a user-facing message on failure.
export async function verifyWebview(params: {
  token: string;
  profile: ScrapedProfile;
}): Promise<void> {
  if (!BASE) throw new Error('Verification service is not configured.');

  let res: Response;
  try {
    res = await fetch(`${BASE}/verify-webview`, {
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
  if (res.status === 400 && body.error === 'invalid_profile') {
    throw new Error("Couldn't read your Amizone profile. Try logging in again.");
  }
  if (res.status === 401) {
    throw new Error('Your session expired. Please try again.');
  }
  throw new Error('Verification is unavailable right now. Try again in a moment.');
}
