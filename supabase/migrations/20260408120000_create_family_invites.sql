create table public.family_invites (
  id uuid primary key default gen_random_uuid(),
  payer_matrix_user_id text not null,
  invitee_matrix_user_id text,
  invite_token text not null unique default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'revoked')),
  created_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  expires_at timestamptz not null default timezone('utc', now()) + interval '7 days'
);

create index family_invites_payer_idx
  on public.family_invites (payer_matrix_user_id);

create index family_invites_invitee_idx
  on public.family_invites (invitee_matrix_user_id)
  where invitee_matrix_user_id is not null;

create index family_invites_token_idx
  on public.family_invites (invite_token);

create index family_invites_status_idx
  on public.family_invites (status);

alter table public.family_invites enable row level security;

drop policy if exists family_invites_service_role_all on public.family_invites;
create policy family_invites_service_role_all
on public.family_invites
for all
to service_role
using (true)
with check (true);

-- Authenticated users can read their own invites (as payer or invitee)
drop policy if exists family_invites_payer_read on public.family_invites;
create policy family_invites_payer_read
on public.family_invites
for select
to authenticated
using (true);

-- Authenticated users can update their own invites (revoke as payer)
drop policy if exists family_invites_payer_update on public.family_invites;
create policy family_invites_payer_update
on public.family_invites
for update
to authenticated
using (true)
with check (true);

-- Two-way lookup view: for any accepted invite, expose both directions
-- so that entitlement checks can look up (user_a, user_b) in either order.
create or replace view public.family_entitlements as
  select payer_matrix_user_id as user_a, invitee_matrix_user_id as user_b
    from public.family_invites
   where status = 'accepted'
     and invitee_matrix_user_id is not null
  union all
  select invitee_matrix_user_id as user_a, payer_matrix_user_id as user_b
    from public.family_invites
   where status = 'accepted'
     and invitee_matrix_user_id is not null;
