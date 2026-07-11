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

  // Validate the app's anonymous Supabase session and resolve its auth user id.
  // This ties the verified profile to a real session so verified_amity can't be
  // forged by a client writing its own profile row (client insert is disabled by RLS).
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData.user) {
    return res.status(401).json({ error: 'invalid_session' });
  }
  const authUserId = userData.user.id;

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

  // Create or re-link the profile using the service role. On re-login (same
  // amizone_id, fresh anonymous user) we re-link auth_user_id and refresh the
  // Amizone-sourced fields, but preserve user-completed fields (role, phone,
  // gender) so onboarding isn't undone.
  const { data: existing, error: selErr } = await admin
    .from('profiles')
    .select('id')
    .eq('amizone_id', profile.amizone_id)
    .maybeSingle();

  if (selErr) {
    return res.status(500).json({ error: 'profile_lookup_failed' });
  }

  if (existing) {
    const { error } = await admin
      .from('profiles')
      .update({
        auth_user_id: authUserId,
        full_name: profile.full_name,
        batch: profile.batch,
        department: profile.department,
      })
      .eq('amizone_id', profile.amizone_id);
    if (error) return res.status(500).json({ error: 'profile_link_failed' });
  } else {
    const { error } = await admin.from('profiles').insert({
      auth_user_id: authUserId,
      amizone_id: profile.amizone_id,
      full_name: profile.full_name,
      role: profile.role,
      batch: profile.batch,
      department: profile.department,
      verified_amity: true,
    });
    if (error) return res.status(500).json({ error: 'profile_create_failed' });
  }

  return res.json({ verified: true, profile });
});

app.listen(PORT, () => {
  // Never log request bodies or credentials.
  console.log(`amizone-auth listening on :${PORT} (mock=${process.env.MOCK_AMIZONE === 'true'})`);
});
