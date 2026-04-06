create table if not exists public.otp_verification_requests (
  id uuid primary key default gen_random_uuid(),
  request_id text not null unique,
  phone_number text not null,
  provider_request_id text,
  expires_at timestamptz,
  verified_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists idx_otp_verification_requests_phone_number
on public.otp_verification_requests (phone_number);

create trigger set_otp_verification_requests_updated_at
before update on public.otp_verification_requests
for each row
execute function public.set_updated_at();

comment on table public.otp_verification_requests is
'Tracks issued OTP verification requests so request IDs can be validated, expired, and marked single-use by edge functions.';

alter table public.otp_verification_requests enable row level security;

drop policy if exists otp_verification_requests_service_role_all on public.otp_verification_requests;
create policy otp_verification_requests_service_role_all
on public.otp_verification_requests
for all
to service_role
using (true)
with check (true);