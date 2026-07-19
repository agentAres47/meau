-- Phase 1 (F7) — push notifications, part 1: the outbox.
--
-- Transition points (accept RPC, message insert, request-target insert) enqueue
-- a row here instead of calling Expo directly. The matching service drains it
-- every few seconds, resolves each profile's push_tokens, and sends via the Expo
-- Push API. Decoupling the DB from the HTTP send makes enqueue transactional and
-- lets sends retry without holding a DB transaction open. See PHASE0-style split.
--
-- Delivery is best-effort: Supabase Realtime remains the reliable in-app path
-- (MVP_FEATURE_SPEC F7). Push is the "phone buzzes when you're not looking" layer.

create table notifications_outbox (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid not null references profiles(id) on delete cascade,
  title text not null,
  body text not null,
  data jsonb not null default '{}'::jsonb,   -- deep-link payload: { type, matchId | request_id }
  sent_at timestamptz,                        -- null = not yet drained
  created_at timestamptz default now()
);

-- The drainer only ever scans unsent rows oldest-first; a partial index keeps
-- that scan tiny even as sent history accumulates.
create index notifications_outbox_unsent_idx on notifications_outbox (created_at) where sent_at is null;

-- No client access at all. Only the matching service (service role) reads/drains
-- it, and only security-definer triggers / the accept RPC write it. Same locked-
-- down pattern as `admins`: RLS on, zero policies.
alter table notifications_outbox enable row level security;
