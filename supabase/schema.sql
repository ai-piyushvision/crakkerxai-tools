-- Run in Supabase SQL Editor ONCE. These tables must remain private.
create table if not exists public.payment_orders (
  id bigint generated always as identity primary key,
  razorpay_order_id text unique not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  plan text not null check (plan in ('normal','plus','pro','ultra')),
  amount_paise integer not null check (amount_paise>0),
  state text not null default 'created' check (state in ('created','paid','refunded')),
  payment_id text unique,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists idx_payment_orders_user on public.payment_orders(user_id,created_at desc);
create table if not exists public.memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('normal','plus','pro','ultra')),
  expires_at timestamptz not null,
  last_order_id text,
  updated_at timestamptz not null default now()
);
grant all on public.memberships,public.payment_orders to service_role;
alter table public.memberships enable row level security;
alter table public.payment_orders enable row level security;
revoke all on public.payment_orders from anon, authenticated;
revoke all on public.memberships from anon, authenticated;
-- SECURITY DEFINER function is callable only with the server-side service-role key.
create or replace function public.activate_paid_order(p_order_id text,p_payment_id text)
returns table(plan text, expires_at timestamptz)
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_order public.payment_orders%rowtype;
  v_current public.memberships%rowtype;
  v_expiration timestamptz;
begin
  select * into v_order from public.payment_orders where razorpay_order_id=p_order_id for update;
  if not found or v_order.state='refunded' then raise exception 'Unknown or ineligible order'; end if;
  if v_order.state='paid' then
    if v_order.payment_id is distinct from p_payment_id then raise exception 'Order already paid with a different payment'; end if;
    return query select m.plan,m.expires_at from public.memberships m where m.user_id=v_order.user_id;
    return;
  end if;
  -- Serialize concurrent captured orders from the same user.
  perform pg_advisory_xact_lock(hashtext(v_order.user_id::text));
  select * into v_current from public.memberships m where m.user_id=v_order.user_id for update;
  if found and v_current.plan=v_order.plan and v_current.expires_at>now() then
    v_expiration:=v_current.expires_at+interval '30 days';
  else
    v_expiration:=now()+interval '30 days';
  end if;
  update public.payment_orders set state='paid',payment_id=p_payment_id,paid_at=now() where id=v_order.id;
  insert into public.memberships(user_id,plan,expires_at,last_order_id,updated_at)
  values(v_order.user_id,v_order.plan,v_expiration,v_order.razorpay_order_id,now())
  on conflict(user_id) do update set plan=excluded.plan,expires_at=excluded.expires_at,last_order_id=excluded.last_order_id,updated_at=now();
  return query select m.plan,m.expires_at from public.memberships m where m.user_id=v_order.user_id;
end $$;
revoke all on function public.activate_paid_order(text,text) from public,anon,authenticated;
grant execute on function public.activate_paid_order(text,text) to service_role;

-- Remove access on a fully refunded order if it is the latest paid entitlement.
create or replace function public.revoke_refunded_order(p_order_id text,p_payment_id text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare v_order public.payment_orders%rowtype;
begin
 select * into v_order from public.payment_orders where razorpay_order_id=p_order_id for update;
 if not found or (v_order.payment_id is not null and v_order.payment_id is distinct from p_payment_id) then return; end if;
 if v_order.state='refunded' then return; end if;
 update public.payment_orders set state='refunded',payment_id=coalesce(payment_id,p_payment_id) where id=v_order.id;
 update public.memberships set expires_at=now(),updated_at=now()
 where user_id=v_order.user_id and last_order_id=v_order.razorpay_order_id;
end $$;
revoke all on function public.revoke_refunded_order(text,text) from public,anon,authenticated;
grant execute on function public.revoke_refunded_order(text,text) to service_role;
-- Daily conversion accounting (UTC). Only Worker service-role calls the function.
create table if not exists public.conversion_usage (
  user_id uuid not null references auth.users(id) on delete cascade,
  day date not null default (now() at time zone 'utc')::date,
  used integer not null default 0 check (used>=0),
  primary key (user_id,day)
);
grant all on public.conversion_usage to service_role;
alter table public.conversion_usage enable row level security;
revoke all on public.conversion_usage from anon,authenticated;
create or replace function public.try_consume_usage(p_user_id uuid,p_daily_limit integer)
returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare v_used integer;v_day date:=(now() at time zone 'utc')::date;
begin
 if p_daily_limit<1 or p_daily_limit>10000 then raise exception 'Invalid daily limit'; end if;
 insert into public.conversion_usage(user_id,day,used) values(p_user_id,v_day,0)
 on conflict(user_id,day) do nothing;
 select used into v_used from public.conversion_usage where user_id=p_user_id and day=v_day for update;
 if v_used>=p_daily_limit then return false; end if;
 update public.conversion_usage set used=used+1 where user_id=p_user_id and day=v_day;
 return true;
end $$;
revoke all on function public.try_consume_usage(uuid,integer) from public,anon,authenticated;
grant execute on function public.try_consume_usage(uuid,integer) to service_role;

-- Feedback, support requests, feature suggestions and bug reports.
create table if not exists public.feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 100),
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) <= 24),
  whatsapp text check (whatsapp is null or char_length(whatsapp) <= 24),
  category text not null check (category in ('feedback','bug','feature','support','business')),
  subject text not null check (char_length(subject) between 1 and 140),
  message text not null check (char_length(message) between 10 and 5000),
  page_url text,
  ip_hash text not null,
  created_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new','in_progress','resolved','closed'))
);
create index if not exists feedback_submissions_ip_created_idx on public.feedback_submissions(ip_hash, created_at desc);
create index if not exists feedback_submissions_created_idx on public.feedback_submissions(created_at desc);
alter table public.feedback_submissions enable row level security;
revoke all on public.feedback_submissions from public, anon, authenticated;
grant all on public.feedback_submissions to service_role;

-- Password security policy (also available as supabase/migrations/20261120_account_password_policy.sql)
-- Enforce first password setup and a 60-day password-age policy.
-- Existing accounts are marked for one-time password setup because historical
-- password-change timestamps were not previously stored by this application.
BEGIN;

CREATE TABLE IF NOT EXISTS public.account_password_security (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  password_changed_at timestamptz,
  password_setup_required boolean NOT NULL DEFAULT true,
  password_setup_reason text NOT NULL DEFAULT 'initial_setup',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Keep this migration safe to re-run if an earlier draft created the table.
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS password_changed_at timestamptz;
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS password_setup_required boolean NOT NULL DEFAULT true;
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS password_setup_reason text NOT NULL DEFAULT 'initial_setup';
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.account_password_security
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  ALTER TABLE public.account_password_security
    ADD CONSTRAINT account_password_security_reason_check
    CHECK (password_setup_reason IN ('initial_setup','legacy_rollout','completed'));
EXCEPTION WHEN duplicate_object THEN
  NULL;
END;
$$;

ALTER TABLE public.account_password_security ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.account_password_security FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.account_password_security TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_password_security TO service_role;

-- Authenticated users may read their own password-policy row only. Writes remain
-- service-role/trigger-only, so clients cannot change their password age/status.
DROP POLICY IF EXISTS account_password_security_select_own ON public.account_password_security;
CREATE POLICY account_password_security_select_own
  ON public.account_password_security
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Exact historical password age is unavailable for accounts created before
-- this policy existed. Require one password refresh once to establish a baseline.
INSERT INTO public.account_password_security(user_id, password_changed_at, password_setup_required, password_setup_reason)
SELECT
  id,
  NULL,
  TRUE,
  CASE
    WHEN COALESCE(encrypted_password, '') = '' THEN 'initial_setup'
    ELSE 'legacy_rollout'
  END
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Correct rows created by an earlier draft of this migration. Existing accounts
-- without an encrypted password are first-time setup, not an old-password change.
UPDATE public.account_password_security AS security
SET password_setup_reason = CASE
      WHEN COALESCE(auth_user.encrypted_password, '') = '' THEN 'initial_setup'
      ELSE 'legacy_rollout'
    END,
    password_setup_required = TRUE,
    updated_at = now()
FROM auth.users AS auth_user
WHERE security.user_id = auth_user.id
  AND security.password_changed_at IS NULL
  AND security.password_setup_required = TRUE
  AND security.password_setup_reason IN ('initial_setup', 'legacy_rollout');

CREATE OR REPLACE FUNCTION public.capture_auth_password_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  has_password boolean;
BEGIN
  has_password := COALESCE(NEW.encrypted_password, '') <> '';

  IF TG_OP = 'INSERT' THEN
    -- Accounts created without a password (including OTP and social signups)
    -- must set one and then sign in with that password. A direct password signup
    -- already has a password, so its change date is recorded immediately.
    INSERT INTO public.account_password_security(user_id, password_changed_at, password_setup_required, password_setup_reason, updated_at)
    VALUES (
      NEW.id,
      CASE WHEN has_password THEN now() ELSE NULL END,
      NOT has_password,
      CASE WHEN has_password THEN 'completed' ELSE 'initial_setup' END,
      now()
    )
    ON CONFLICT (user_id) DO NOTHING;
    RETURN NEW;
  END IF;

  IF NEW.encrypted_password IS DISTINCT FROM OLD.encrypted_password THEN
    INSERT INTO public.account_password_security(user_id, password_changed_at, password_setup_required, password_setup_reason, updated_at)
    VALUES (
      NEW.id,
      CASE WHEN has_password THEN now() ELSE NULL END,
      NOT has_password,
      CASE WHEN has_password THEN 'completed' ELSE 'initial_setup' END,
      now()
    )
    ON CONFLICT (user_id) DO UPDATE
      SET password_changed_at = EXCLUDED.password_changed_at,
          password_setup_required = EXCLUDED.password_setup_required,
          password_setup_reason = EXCLUDED.password_setup_reason,
          updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS auth_user_password_security_insert ON auth.users;
CREATE TRIGGER auth_user_password_security_insert
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.capture_auth_password_change();

DROP TRIGGER IF EXISTS auth_user_password_security_update ON auth.users;
CREATE TRIGGER auth_user_password_security_update
AFTER UPDATE OF encrypted_password ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.capture_auth_password_change();

COMMIT;
