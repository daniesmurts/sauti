create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.matrix_registrations (
  id uuid primary key default gen_random_uuid(),
  phone_number text not null unique,
  matrix_user_id text not null unique,
  display_name text,
  last_device_id text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_matrix_registrations_updated_at
before update on public.matrix_registrations
for each row
execute function public.set_updated_at();

create table if not exists public.user_subscriptions (
  id uuid primary key default gen_random_uuid(),
  matrix_user_id text not null unique,
  phone_number text,
  plan text not null default 'free' check (plan in ('free', 'family')),
  status text not null default 'active' check (status in ('active', 'expired', 'cancelled')),
  provider_name text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create trigger set_user_subscriptions_updated_at
before update on public.user_subscriptions
for each row
execute function public.set_updated_at();

create table if not exists public.subscription_provider_events (
  id uuid primary key default gen_random_uuid(),
  provider_name text not null,
  provider_event_id text not null,
  provider_customer_id text,
  provider_subscription_id text,
  matrix_user_id text,
  payload jsonb not null,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  unique (provider_name, provider_event_id)
);

comment on table public.subscription_provider_events is
'Provider webhook landing table. Payment provider webhooks insert the raw payload here first, then a service-role worker normalizes state into public.user_subscriptions.';

alter table public.matrix_registrations enable row level security;
alter table public.user_subscriptions enable row level security;
alter table public.subscription_provider_events enable row level security;

drop policy if exists matrix_registrations_service_role_all on public.matrix_registrations;
create policy matrix_registrations_service_role_all
on public.matrix_registrations
for all
to service_role
using (true)
with check (true);

drop policy if exists user_subscriptions_service_role_all on public.user_subscriptions;
create policy user_subscriptions_service_role_all
on public.user_subscriptions
for all
to service_role
using (true)
with check (true);

drop policy if exists subscription_provider_events_service_role_all on public.subscription_provider_events;
create policy subscription_provider_events_service_role_all
on public.subscription_provider_events
for all
to service_role
using (true)
with check (true);
