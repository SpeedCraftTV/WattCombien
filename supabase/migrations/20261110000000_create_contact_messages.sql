create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  reason text not null check (reason in ('question', 'calculation_error', 'privacy_request', 'other')),
  email text null check (email is null or char_length(email) <= 254),
  message text not null check (char_length(btrim(message)) between 10 and 5000),
  received_at timestamptz not null default now(),
  status text not null default 'new' check (status in ('new', 'in_progress', 'closed'))
);

alter table public.contact_messages enable row level security;

revoke all on table public.contact_messages from public, anon, authenticated, service_role;
grant usage on schema public to service_role;
grant insert on table public.contact_messages to service_role;

comment on table public.contact_messages is
  'Private contact requests. Public API roles have no table privileges; inserts are performed by the server-side Cloudflare Worker.';
