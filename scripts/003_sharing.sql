-- Add shared accounts: account_members and account_invites with RLS
-- Prereqs: accounts(id, owner_id) exists
-- Avoid duplicate creation if already present

-- Members table
create table if not exists account_members (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'admin', 'member')),
  created_at timestamptz not null default now(),
  unique (account_id, user_id)
);

create index if not exists account_members_account_idx on account_members(account_id);
create index if not exists account_members_user_idx on account_members(user_id);

alter table account_members enable row level security;

-- Policy helper: allow any member of the account to see members
create policy if not exists "Members can view members of same account"
on account_members for select
using (
  exists (
    select 1 from account_members m2
    where m2.account_id = account_members.account_id
      and m2.user_id = auth.uid()
  )
  or exists (
    select 1 from accounts a
    where a.id = account_members.account_id and a.owner_id = auth.uid()
  )
);

-- Only owners/admins of account can insert/update/delete members
create policy if not exists "Owners/admins can add members"
on account_members for insert
with check (
  exists (
    select 1 from account_members me
    where me.account_id = account_members.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_members.account_id and a.owner_id = auth.uid()
  )
);

create policy if not exists "Owners/admins can update members"
on account_members for update
using (
  exists (
    select 1 from account_members me
    where me.account_id = account_members.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_members.account_id and a.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from account_members me
    where me.account_id = account_members.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_members.account_id and a.owner_id = auth.uid()
  )
);

create policy if not exists "Owners/admins can remove members"
on account_members for delete
using (
  exists (
    select 1 from account_members me
    where me.account_id = account_members.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_members.account_id and a.owner_id = auth.uid()
  )
);

-- Invites table
create table if not exists account_invites (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  email text not null,
  role text not null check (role in ('admin','member')),
  token text not null unique,
  expires_at timestamptz not null,
  accepted_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists account_invites_account_idx on account_invites(account_id);
create index if not exists account_invites_token_idx on account_invites(token);

alter table account_invites enable row level security;

-- Only owners/admins can manage invites; no public select by default (accept uses service role)
create policy if not exists "Owners/admins can view invites"
on account_invites for select
using (
  exists (
    select 1 from account_members me
    where me.account_id = account_invites.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_invites.account_id and a.owner_id = auth.uid()
  )
);

create policy if not exists "Owners/admins can create invites"
on account_invites for insert
with check (
  exists (
    select 1 from account_members me
    where me.account_id = account_invites.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_invites.account_id and a.owner_id = auth.uid()
  )
);

create policy if not exists "Owners/admins can update invites"
on account_invites for update
using (
  exists (
    select 1 from account_members me
    where me.account_id = account_invites.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_invites.account_id and a.owner_id = auth.uid()
  )
)
with check (
  exists (
    select 1 from account_members me
    where me.account_id = account_invites.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_invites.account_id and a.owner_id = auth.uid()
  )
);

create policy if not exists "Owners/admins can delete invites"
on account_invites for delete
using (
  exists (
    select 1 from account_members me
    where me.account_id = account_invites.account_id
      and me.user_id = auth.uid()
      and me.role in ('owner','admin')
  )
  or exists (
    select 1 from accounts a
    where a.id = account_invites.account_id and a.owner_id = auth.uid()
  )
);
