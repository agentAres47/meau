import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { rankMatches, type Candidate, type RequestGeo } from './match.js';

const PORT = Number(process.env.PORT ?? 8081);
const TIME_WINDOW_MIN = Number(process.env.TIME_WINDOW_MIN ?? 30);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

// Find live tokens matching an existing ride_requests row (route-aware).
app.post('/match', async (req, res) => {
  const { request_id } = (req.body ?? {}) as { request_id?: string };
  if (!request_id) return res.status(400).json({ error: 'missing_request_id' });

  const { data: geoRows, error: geoErr } = await admin.rpc('request_geo', { p_request_id: request_id });
  if (geoErr) return res.status(500).json({ error: 'request_lookup_failed' });
  const reqGeo = (geoRows as RequestGeo[] | null)?.[0];
  if (!reqGeo) return res.status(404).json({ error: 'request_not_found' });

  const { data: candidates, error: candErr } = await admin.rpc('live_token_candidates', {
    p_desired: reqGeo.desired_time,
    p_window_min: TIME_WINDOW_MIN,
  });
  if (candErr) return res.status(500).json({ error: 'candidate_lookup_failed' });

  const matches = rankMatches(reqGeo, (candidates as Candidate[] | null) ?? []);
  return res.json({ matches });
});

// Passenger requests one or more tokens (fan-out). Push wiring is Phase 5.
app.post('/request', async (req, res) => {
  const { request_id, token_ids } = (req.body ?? {}) as { request_id?: string; token_ids?: string[] };
  if (!request_id || !Array.isArray(token_ids) || token_ids.length === 0) {
    return res.status(400).json({ error: 'missing_request_or_tokens' });
  }

  // Resolve each token's driver so targets carry driver_id.
  const { data: tokens, error: tErr } = await admin
    .from('ride_tokens')
    .select('id, driver_id, status, seats_left')
    .in('id', token_ids);
  if (tErr) return res.status(500).json({ error: 'token_lookup_failed' });

  const rows = (tokens ?? [])
    .filter((t) => t.status === 'live' && t.seats_left > 0)
    .map((t) => ({ request_id, token_id: t.id, driver_id: t.driver_id, state: 'pending' }));
  if (rows.length === 0) return res.status(409).json({ error: 'no_live_tokens' });

  const { error: insErr } = await admin
    .from('request_targets')
    .upsert(rows, { onConflict: 'request_id,token_id', ignoreDuplicates: true });
  if (insErr) return res.status(500).json({ error: 'request_failed' });

  return res.json({ ok: true, targeted: rows.length });
});

// Driver accepts — atomic race winner via the accept_ride_request RPC.
app.post('/accept', async (req, res) => {
  const { request_id, token_id, driver_id } = (req.body ?? {}) as {
    request_id?: string;
    token_id?: string;
    driver_id?: string;
  };
  if (!request_id || !token_id || !driver_id) {
    return res.status(400).json({ error: 'missing_fields' });
  }

  const { data, error } = await admin.rpc('accept_ride_request', {
    p_request_id: request_id,
    p_token_id: token_id,
    p_driver_id: driver_id,
  });
  if (error) {
    if (error.message.includes('already_matched')) return res.status(409).json({ error: 'already_matched' });
    return res.status(500).json({ error: 'accept_failed' });
  }
  return res.json({ match_id: data });
});

// Expire past-departure tokens / stale requests + pool sessions every 60s.
setInterval(() => {
  admin.rpc('expire_stale_rows').then(({ error }) => {
    if (error) console.error('expire_stale_rows failed:', error.message);
  });
}, 60_000);

// Group waiting auto-pool sessions into pools (specs/07-AUTO-POOL.md).
setInterval(() => {
  admin.rpc('run_autopool_matching').then(({ error }) => {
    if (error) console.error('run_autopool_matching failed:', error.message);
  });
}, 5_000);

app.listen(PORT, () => console.log(`matching listening on :${PORT}`));
