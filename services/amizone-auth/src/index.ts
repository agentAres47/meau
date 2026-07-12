import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { createClient } from '@supabase/supabase-js';
import { verifyAmizone } from './amizone.js';

const PORT = Number(process.env.PORT ?? 8080);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

// Service-role client — bypasses RLS. Used only server-side to create/link the
// verified profile row. The key must never ship in the app bundle.
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type ProfileFields = {
  amizone_id: string;
  full_name: string;
  role: 'student' | 'faculty' | 'staff';
  batch: string | null;
  department: string | null;
};

// Create or re-link a verified profile row (service role). Shared by both verify
// paths. Releases this session from any other identity first (auth_user_id is
// unique), then updates the existing row for this amizone_id or inserts a new
// one — preserving user-completed fields (role, phone, gender) on re-login.
// Returns null on success or a short error code.
async function linkProfile(authUserId: string, p: ProfileFields): Promise<string | null> {
  const { error: relErr } = await admin
    .from('profiles')
    .update({ auth_user_id: null })
    .eq('auth_user_id', authUserId)
    .neq('amizone_id', p.amizone_id);
  if (relErr) return 'profile_unbind_failed';

  const { data: existing, error: selErr } = await admin
    .from('profiles')
    .select('id')
    .eq('amizone_id', p.amizone_id)
    .maybeSingle();
  if (selErr) return 'profile_lookup_failed';

  if (existing) {
    const { error } = await admin
      .from('profiles')
      .update({
        auth_user_id: authUserId,
        full_name: p.full_name,
        batch: p.batch,
        department: p.department,
      })
      .eq('amizone_id', p.amizone_id);
    return error ? 'profile_link_failed' : null;
  }

  const { error } = await admin.from('profiles').insert({
    auth_user_id: authUserId,
    amizone_id: p.amizone_id,
    full_name: p.full_name,
    role: p.role,
    batch: p.batch,
    department: p.department,
    verified_amity: true,
  });
  return error ? 'profile_create_failed' : null;
}

// Resolve the app's anonymous Supabase session -> auth user id, or null if bad.
async function resolveAuthUser(token: string): Promise<string | null> {
  const { data, error } = await admin.auth.getUser(token);
  return error || !data.user ? null : data.user.id;
}

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// Rate limit: 5 verify attempts per minute per IP (03-AUTH-AMIZONE.md checklist).
const verifyLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
});

app.post('/verify', verifyLimiter, async (req, res) => {
  const { amizone_id, password } = (req.body ?? {}) as { amizone_id?: string; password?: string };
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

  if (!amizone_id || !password) {
    return res.status(400).json({ error: 'missing_credentials' });
  }
  if (!token) {
    return res.status(401).json({ error: 'missing_session' });
  }

  // Validate the app's anonymous Supabase session so verified_amity can't be
  // forged by a client writing its own row (client insert is disabled by RLS).
  const authUserId = await resolveAuthUser(token);
  if (!authUserId) {
    return res.status(401).json({ error: 'invalid_session' });
  }

  let profile;
  try {
    profile = await verifyAmizone(amizone_id, password);
  } catch {
    // Upstream go-amizone/Amizone failure — distinct from a credential rejection.
    return res.status(502).json({ error: 'amizone_unavailable' });
  }
  // `password` is now out of scope. It is never logged, returned, or persisted.

  if (!profile) {
    return res.status(401).json({ verified: false, error: 'invalid_credentials' });
  }

  const linkErr = await linkProfile(authUserId, profile);
  if (linkErr) return res.status(500).json({ error: linkErr });

  return res.json({ verified: true, profile });
});

// Client-attested verification: the app drove a real Amizone login inside a
// WebView (human solved Cloudflare Turnstile — automation is blocked, see
// AMIZONE-CLOUDFLARE-REALITY.md) and scraped the /IDCard profile. We trust that
// scrape here — the server can't independently re-verify because the Amizone
// session cookie is HttpOnly (server-side re-verification needs a dev build with
// native cookie access; documented as v2 hardening). Row creation still happens
// server-side so RLS/ownership stay consistent.
app.post('/verify-webview', verifyLimiter, async (req, res) => {
  const body = (req.body ?? {}) as {
    amizone_id?: string;
    full_name?: string;
    batch?: string | null;
    department?: string | null;
  };
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');

  const amizoneId = (body.amizone_id ?? '').trim();
  const fullName = (body.full_name ?? '').trim();
  // Validate at this trust boundary: enrollment ids are alphanumeric; name non-empty.
  if (!/^[A-Za-z0-9]{4,20}$/.test(amizoneId) || fullName.length < 2 || fullName.length > 100) {
    return res.status(400).json({ error: 'invalid_profile' });
  }
  if (!token) {
    return res.status(401).json({ error: 'missing_session' });
  }

  const authUserId = await resolveAuthUser(token);
  if (!authUserId) {
    return res.status(401).json({ error: 'invalid_session' });
  }

  const linkErr = await linkProfile(authUserId, {
    amizone_id: amizoneId,
    full_name: fullName,
    role: 'student', // IDCard doesn't expose role; user confirms in complete-profile
    batch: (body.batch ?? null)?.toString().slice(0, 100) || null,
    department: (body.department ?? null)?.toString().slice(0, 100) || null,
  });
  if (linkErr) return res.status(500).json({ error: linkErr });

  return res.json({ verified: true });
});

app.listen(PORT, () => {
  // Never log request bodies or credentials.
  console.log(`amizone-auth listening on :${PORT} (mock=${process.env.MOCK_AMIZONE === 'true'})`);
});
