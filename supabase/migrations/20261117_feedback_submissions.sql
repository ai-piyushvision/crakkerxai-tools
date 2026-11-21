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
create index if not exists feedback_submissions_ip_created_idx
  on public.feedback_submissions(ip_hash, created_at desc);
create index if not exists feedback_submissions_created_idx
  on public.feedback_submissions(created_at desc);
alter table public.feedback_submissions enable row level security;
revoke all on public.feedback_submissions from public, anon, authenticated;
grant all on public.feedback_submissions to service_role;
