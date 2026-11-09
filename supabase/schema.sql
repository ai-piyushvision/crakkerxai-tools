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
