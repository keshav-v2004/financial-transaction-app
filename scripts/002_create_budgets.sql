-- Schema assumptions: accounts(id, owner_id), categories(id, account_id, name), auth.users(id)
-- Create budgets table
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  monthly_limit_cents integer not null check (monthly_limit_cents >= 0),
  created_by uuid not null references auth.users(id),
  created_at timestamp with time zone not null default now(),
  updated_at timestamp with time zone not null default now()
);

create index if not exists budgets_account_id_idx on budgets(account_id);
create index if not exists budgets_category_id_idx on budgets(category_id);

-- Enable RLS
alter table budgets enable row level security;

-- Policies: members of the account can read; creators and account owners can write; owners can delete
-- Assumes there is an account membership check via a view or function; fallback to owner_id match for simplicity
-- Replace with your membership policy if you have account_members table.
create policy if not exists "Budgets are viewable by account owner"
on budgets for select
using (exists (
  select 1 from accounts a where a.id = budgets.account_id and a.owner_id = auth.uid()
));

create policy if not exists "Budgets are insertable by account owner"
on budgets for insert
with check (exists (
  select 1 from accounts a where a.id = budgets.account_id and a.owner_id = auth.uid()
));

create policy if not exists "Budgets are updatable by account owner"
on budgets for update
using (exists (
  select 1 from accounts a where a.id = budgets.account_id and a.owner_id = auth.uid()
))
with check (exists (
  select 1 from accounts a where a.id = budgets.account_id and a.owner_id = auth.uid()
));

create policy if not exists "Budgets are deletable by account owner"
on budgets for delete
using (exists (
  select 1 from accounts a where a.id = budgets.account_id and a.owner_id = auth.uid()
));
