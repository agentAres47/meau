import 'dotenv/config';
import express, { type NextFunction, type Request, type RequestHandler, type Response } from 'express';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';
import { rankMatches, type Candidate, type RequestGeo } from './match.js';
import { startNotificationDrainer } from './notify.js';
import { errDetail, loggingFetch } from './errors.js';
import { bearerToken, isUuid, ownsRequest } from './security.js';

const PORT = Number(process.env.PORT ?? 8081);
const TIME_WINDOW_MIN = Number(process.env.TIME_WINDOW_MIN ?? 30);
const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
}

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
  global: { fetch: loggingFetch('supabase') },
});

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => res.json({ ok: true }));

type Caller = { profileId: string; isDriverVerified: boolean };

const requireCaller: RequestHandler = async (req, res, next) => {
  try {
    const token = bearerToken(req.header('authorization'));
    if (!token) return void res.status(401).json({ error: 'missing_session' });

    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) return void res.status(401).json({ error: 'invalid_session' });

    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .select('id, verified_amity, is_driver_verified')
      .eq('auth_user_id', authData.user.id)
      .maybeSingle();
    if (profileError) {
      console.error('caller profile lookup failed:', errDetail(profileError));
      return void res.status(500).json({ error: 'profile_lookup_failed' });
    }
    if (!profile?.verified_amity) return void res.status(403).json({ error: 'verified_profile_required' });

    res.locals.caller = {
      profileId: profile.id,
      isDriverVerified: profile.is_driver_verified,
    } satisfies Caller;
    next();
  } catch (error) {
    next(error);
  }
};

// Express 4 does not forward rejected async handlers to error middleware.
const asyncRoute = (handler: (req: Request, res: Response) => Promise<unknown>): RequestHandler =>
  (req, res, next) => void handler(req, res).catch(next);

// Find live tokens matching an existing ride_requests row (route-aware).
app.post('/match', requireCaller, asyncRoute(async (req, res) => {
  const caller = res.locals.caller as Caller;
  const { request_id } = (req.body ?? {}) as { request_id?: string };
  if (!isUuid(request_id)) return res.status(400).json({ error: 'invalid_request_id' });

  const { data: geoRows, error: geoError } = await admin.rpc('request_geo', { p_request_id: request_id });
  if (geoError) {
    console.error('/match request_geo failed:', errDetail(geoError));
    return res.status(500).json({ error: 'request_lookup_failed' });
  }
  const requestGeo = (geoRows as (RequestGeo & { passenger_id: string; status: string })[] | null)?.[0];
  if (!requestGeo) return res.status(404).json({ error: 'request_not_found' });
  if (!ownsRequest(caller.profileId, requestGeo.passenger_id)) {
    return res.status(403).json({ error: 'request_not_owned' });
  }
  if (requestGeo.status !== 'searching') return res.status(409).json({ error: 'request_not_searching' });

  const { data: candidates, error: candidateError } = await admin.rpc('live_token_candidates', {
    p_desired: requestGeo.desired_time,
    p_window_min: TIME_WINDOW_MIN,
  });
  if (candidateError) {
    console.error('/match candidate lookup failed:', errDetail(candidateError));
    return res.status(500).json({ error: 'candidate_lookup_failed' });
  }

  const eligible = ((candidates as Candidate[] | null) ?? []).filter(
    (candidate) => candidate.driver_id !== caller.profileId && candidate.driver_verified
  );
  return res.json({ matches: rankMatches(requestGeo, eligible) });
}));

// Passenger requests one or more tokens (fan-out).
app.post('/request', requireCaller, asyncRoute(async (req, res) => {
  const caller = res.locals.caller as Caller;
  const { request_id, token_ids } = (req.body ?? {}) as { request_id?: string; token_ids?: string[] };
  if (!isUuid(request_id) || !Array.isArray(token_ids) || token_ids.length === 0) {
    return res.status(400).json({ error: 'missing_request_or_tokens' });
  }
  const uniqueTokenIds = [...new Set(token_ids)];
  if (uniqueTokenIds.length > 20 || uniqueTokenIds.some((id) => !isUuid(id))) {
    return res.status(400).json({ error: 'invalid_token_ids' });
  }

  const { data: requestRow, error: requestError } = await admin
    .from('ride_requests')
    .select('passenger_id, status')
    .eq('id', request_id)
    .maybeSingle();
  if (requestError) return res.status(500).json({ error: 'request_lookup_failed' });
  if (!requestRow) return res.status(404).json({ error: 'request_not_found' });
  if (!ownsRequest(caller.profileId, requestRow.passenger_id)) {
    return res.status(403).json({ error: 'request_not_owned' });
  }
  if (requestRow.status !== 'searching') return res.status(409).json({ error: 'request_not_searching' });

  const { data: tokens, error: tokenError } = await admin
    .from('ride_tokens')
    .select('id, driver_id, status, seats_left')
    .in('id', uniqueTokenIds);
  if (tokenError) return res.status(500).json({ error: 'token_lookup_failed' });

  const rows = (tokens ?? [])
    .filter((token) => token.status === 'live' && token.seats_left > 0 && token.driver_id !== caller.profileId)
    .map((token) => ({ request_id, token_id: token.id, driver_id: token.driver_id, state: 'pending' }));
  if (rows.length === 0) return res.status(409).json({ error: 'no_live_tokens' });

  const { error: insertError } = await admin
    .from('request_targets')
    .upsert(rows, { onConflict: 'request_id,token_id', ignoreDuplicates: true });
  if (insertError) return res.status(500).json({ error: 'request_failed' });

  return res.json({ ok: true, targeted: rows.length });
}));

// Driver identity comes from the bearer session, never caller-controlled JSON.
app.post('/accept', requireCaller, asyncRoute(async (req, res) => {
  const caller = res.locals.caller as Caller;
  const { request_id, token_id } = (req.body ?? {}) as { request_id?: string; token_id?: string };
  if (!isUuid(request_id) || !isUuid(token_id)) return res.status(400).json({ error: 'missing_fields' });
  if (!caller.isDriverVerified) return res.status(403).json({ error: 'verified_driver_required' });

  const { data, error } = await admin.rpc('accept_ride_request', {
    p_request_id: request_id,
    p_token_id: token_id,
    p_driver_id: caller.profileId,
  });
  if (error) {
    if (error.message.includes('already_matched')) return res.status(409).json({ error: 'already_matched' });
    if (error.message.includes('token_unavailable')) return res.status(409).json({ error: 'token_unavailable' });
    if (error.message.includes('request_not_found')) return res.status(404).json({ error: 'request_not_found' });
    if (
      error.message.includes('driver_token_mismatch') ||
      error.message.includes('target_not_pending') ||
      error.message.includes('self_match') ||
      error.message.includes('driver_not_verified')
    ) {
      return res.status(403).json({ error: 'accept_not_authorized' });
    }
    console.error('/accept RPC failed:', errDetail(error));
    return res.status(500).json({ error: 'accept_failed' });
  }
  return res.json({ match_id: data });
}));

// Scheduling -- see PHASE0_DESIGN.md.
// expire_stale_rows() lives in pg_cron. Auto Pool keeps this primary 5-second
// path plus pg_cron's idempotent 60-second safety net.
setInterval(() => {
  admin.rpc('run_autopool_matching').then(
    ({ error }) => {
      if (error) console.error('run_autopool_matching failed:', errDetail(error));
    },
    (error) => console.error('run_autopool_matching failed:', errDetail(error))
  );
}, 5_000);

startNotificationDrainer(admin, 3_000);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error('unhandled request error:', errDetail(error));
  if (!res.headersSent) res.status(500).json({ error: 'internal_error' });
});

app.listen(PORT, () => console.log(`matching listening on :${PORT}`));
