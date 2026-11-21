-- One-time, IP-bound human-check challenges for password login.
-- Browser roles cannot read or write these records; the Cloudflare Worker uses service_role.
create table if not exists public.auth_human_challenges (
  challenge_id uuid primary key,
  ip_hash text not null,
  challenge_type text not null check (challenge_type = 'pool_hold_confirm'),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  constraint auth_human_challenges_expiry_after_creation check (expires_at > created_at)
);

create index if not exists auth_human_challenges_ip_created_idx
  on public.auth_human_challenges (ip_hash, created_at desc);
create index if not exists auth_human_challenges_expiry_idx
  on public.auth_human_challenges (expires_at);

alter table public.auth_human_challenges enable row level security;
revoke all on table public.auth_human_challenges from anon, authenticated;
grant select, insert, update, delete on table public.auth_human_challenges to service_role;
