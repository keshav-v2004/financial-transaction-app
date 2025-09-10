-- Safety: run inside Supabase Postgres
-- Idempotency: use IF NOT EXISTS where possible

-- 1) Types
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'member_role') THEN
    CREATE TYPE member_role AS ENUM ('owner','admin','member');
  END IF;
END $$;

-- 2) Helper: ensure extension for gen_random_uuid (on Supabase this is usually available)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 3) Profiles (one row per auth user)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY DEFAULT auth.uid(),
  email text,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.handle_profile_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE PROCEDURE public.handle_profile_updated_at();

-- 4) Accounts and membership
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text, -- e.g., "checking", "savings", "credit", "cash"
  currency char(3) NOT NULL DEFAULT 'USD',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_accounts_updated_at ON public.accounts;
CREATE TRIGGER trg_accounts_updated_at
BEFORE UPDATE ON public.accounts
FOR EACH ROW
EXECUTE PROCEDURE public.handle_profile_updated_at();

CREATE TABLE IF NOT EXISTS public.account_members (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role member_role NOT NULL DEFAULT 'member',
  added_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (account_id, user_id)
);

-- 5) Categories (scoped per account for shared semantics)
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'expense', -- 'expense' | 'income' | 'transfer'
  color text, -- optional UI color tag
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, name)
);

-- 6) Transactions
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL, -- positive for income, negative for expense
  occurred_at timestamptz NOT NULL,
  description text,
  notes text,
  status text NOT NULL DEFAULT 'posted', -- 'pending' | 'posted' | 'void'
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS trg_transactions_updated_at ON public.transactions;
CREATE TRIGGER trg_transactions_updated_at
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE PROCEDURE public.handle_profile_updated_at();

-- 7) Budgets (per account and optional per-category)
CREATE TABLE IF NOT EXISTS public.budgets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL,
  period_year int NOT NULL,
  period_month int NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, category_id, period_year, period_month)
);

-- 8) Recurring rules
CREATE TABLE IF NOT EXISTS public.recurring_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  amount numeric(14,2) NOT NULL,
  cadence text NOT NULL, -- 'monthly' | 'weekly' | 'biweekly' | 'custom'
  day_of_month int, -- for monthly
  weekday int, -- 0-6 for weekly cadence (0=Sunday)
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  next_run_date date,
  active boolean NOT NULL DEFAULT true,
  description text,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 9) Invitations for account sharing
CREATE TABLE IF NOT EXISTS public.account_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  email text NOT NULL,
  role member_role NOT NULL DEFAULT 'member',
  token text NOT NULL, -- secure random token
  expires_at timestamptz NOT NULL,
  created_by uuid NOT NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (token)
);

-- 10) Helper function: check membership (owner or in account_members)
CREATE OR REPLACE FUNCTION public.is_account_member(p_account_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = p_account_id
      AND a.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1
    FROM public.account_members m
    WHERE m.account_id = p_account_id
      AND m.user_id = auth.uid()
  );
$$;

-- 11) Indexes
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account_created_at ON public.transactions(account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_categories_account_id ON public.categories(account_id);
CREATE INDEX IF NOT EXISTS idx_budgets_account_period ON public.budgets(account_id, period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_account ON public.recurring_rules(account_id);

-- 12) Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recurring_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invites ENABLE ROW LEVEL SECURITY;

-- 13) RLS policies

-- profiles: user can see and manage only their own profile
DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles
FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
FOR INSERT WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- accounts
DROP POLICY IF EXISTS "accounts_select_member" ON public.accounts;
CREATE POLICY "accounts_select_member" ON public.accounts
FOR SELECT USING (public.is_account_member(id));

DROP POLICY IF EXISTS "accounts_insert_owner" ON public.accounts;
CREATE POLICY "accounts_insert_owner" ON public.accounts
FOR INSERT WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "accounts_update_owner" ON public.accounts;
CREATE POLICY "accounts_update_owner" ON public.accounts
FOR UPDATE USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());

DROP POLICY IF EXISTS "accounts_delete_owner" ON public.accounts;
CREATE POLICY "accounts_delete_owner" ON public.accounts
FOR DELETE USING (owner_id = auth.uid());

-- account_members
-- Only members can see who else is a member
DROP POLICY IF EXISTS "account_members_select_member" ON public.account_members;
CREATE POLICY "account_members_select_member" ON public.account_members
FOR SELECT USING (public.is_account_member(account_id));

-- Only owners (or admins) can add members
DROP POLICY IF EXISTS "account_members_insert_owner_admin" ON public.account_members;
CREATE POLICY "account_members_insert_owner_admin" ON public.account_members
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id AND a.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.account_members m
    WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  )
);

-- Owners/admins can update roles; users can remove themselves
DROP POLICY IF EXISTS "account_members_update_owner_admin_or_self" ON public.account_members;
CREATE POLICY "account_members_update_owner_admin_or_self" ON public.account_members
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id AND a.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.account_members m
    WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  )
  OR user_id = auth.uid()
) WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts a
    WHERE a.id = account_id AND a.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.account_members m
    WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin')
  )
  OR user_id = auth.uid()
);

-- categories: members can read; owners/admins manage
DROP POLICY IF EXISTS "categories_select_member" ON public.categories;
CREATE POLICY "categories_select_member" ON public.categories
FOR SELECT USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS "categories_write_owner_admin" ON public.categories;
CREATE POLICY "categories_write_owner_admin" ON public.categories
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
);

-- transactions: members can read; members can insert; updaters either creator or admin/owner
DROP POLICY IF EXISTS "transactions_select_member" ON public.transactions;
CREATE POLICY "transactions_select_member" ON public.transactions
FOR SELECT USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS "transactions_insert_member" ON public.transactions;
CREATE POLICY "transactions_insert_member" ON public.transactions
FOR INSERT WITH CHECK (public.is_account_member(account_id) AND created_by = auth.uid());

DROP POLICY IF EXISTS "transactions_update_creator_or_admin" ON public.transactions;
CREATE POLICY "transactions_update_creator_or_admin" ON public.transactions
FOR UPDATE USING (
  public.is_account_member(account_id)
  AND (
    created_by = auth.uid()
    OR EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
  )
) WITH CHECK (
  public.is_account_member(account_id)
);

DROP POLICY IF EXISTS "transactions_delete_admin_or_owner" ON public.transactions;
CREATE POLICY "transactions_delete_admin_or_owner" ON public.transactions
FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
);

-- budgets: members read; owner/admin write
DROP POLICY IF EXISTS "budgets_select_member" ON public.budgets;
CREATE POLICY "budgets_select_member" ON public.budgets
FOR SELECT USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS "budgets_write_owner_admin" ON public.budgets;
CREATE POLICY "budgets_write_owner_admin" ON public.budgets
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
);

-- recurring_rules: members read; owner/admin write
DROP POLICY IF EXISTS "recurring_rules_select_member" ON public.recurring_rules;
CREATE POLICY "recurring_rules_select_member" ON public.recurring_rules
FOR SELECT USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS "recurring_rules_write_owner_admin" ON public.recurring_rules;
CREATE POLICY "recurring_rules_write_owner_admin" ON public.recurring_rules
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
);

-- account_invites: only owners/admins of that account can view/manage
DROP POLICY IF EXISTS "account_invites_owner_admin" ON public.account_invites;
CREATE POLICY "account_invites_owner_admin" ON public.account_invites
FOR ALL USING (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.accounts a WHERE a.id = account_id AND a.owner_id = auth.uid())
  OR EXISTS (SELECT 1 FROM public.account_members m WHERE m.account_id = account_id AND m.user_id = auth.uid() AND m.role IN ('owner','admin'))
);
