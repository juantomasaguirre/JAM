-- ============================================================
-- Phase 2: debts, installment_plans, investments
-- RLS enabled on all tables from creation.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. debts — third-party debts, private to owner
-- ----------------------------------------------------------------
create table debts (
  id              uuid           primary key default gen_random_uuid(),
  household_id    uuid           not null references households(id),
  owner_id        uuid           not null references profiles(id),
  direction       text           not null check (direction in ('i_owe', 'they_owe')),
  counterpart     text           not null,
  description     text           not null,
  original_amount numeric(14,2)  not null check (original_amount > 0),
  pending_amount  numeric(14,2)  not null check (pending_amount >= 0),
  currency        text           not null check (currency in ('ARS', 'USD')),
  occurred_on     date           not null,
  created_at      timestamptz    not null default now(),
  updated_at      timestamptz    not null default now()
);

alter table debts enable row level security;

create trigger debts_updated_at
  before update on debts
  for each row execute function set_updated_at();

create policy "debts: select"
  on debts for select
  using (owner_id = auth.uid());

create policy "debts: insert"
  on debts for insert
  with check (owner_id = auth.uid() and household_id = current_household_id());

create policy "debts: update"
  on debts for update
  using (owner_id = auth.uid());

create policy "debts: delete"
  on debts for delete
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------
-- 2. installment_plans — cuota purchases, individual or shared
-- ----------------------------------------------------------------
create table installment_plans (
  id                  uuid           primary key default gen_random_uuid(),
  household_id        uuid           not null references households(id),
  owner_id            uuid           not null references profiles(id),
  scope               text           not null check (scope in ('individual', 'shared')),
  paid_by             uuid           references profiles(id),
  description         text           not null,
  total_amount        numeric(14,2)  not null check (total_amount > 0),
  currency            text           not null check (currency in ('ARS', 'USD')),
  installment_count   int            not null check (installment_count > 0),
  installment_amount  numeric(14,2)  not null check (installment_amount > 0),
  first_due_date      date           not null,
  installments_paid   int            not null default 0,
  created_at          timestamptz    not null default now(),
  updated_at          timestamptz    not null default now(),

  constraint installments_paid_valid
    check (installments_paid >= 0 and installments_paid <= installment_count),
  -- shared requires paid_by; individual must not have paid_by
  constraint scope_rules check (
    (scope = 'individual' and paid_by is null)
    or
    (scope = 'shared' and paid_by is not null)
  )
);

alter table installment_plans enable row level security;

create trigger installment_plans_updated_at
  before update on installment_plans
  for each row execute function set_updated_at();

-- individual: only owner; shared: any household member
create policy "installment_plans: select"
  on installment_plans for select
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or
    (scope = 'shared' and household_id = current_household_id())
  );

create policy "installment_plans: insert"
  on installment_plans for insert
  with check (
    owner_id = auth.uid()
    and household_id = current_household_id()
  );

-- any household member can update shared plans (e.g. mark an installment paid)
create policy "installment_plans: update"
  on installment_plans for update
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or
    (scope = 'shared' and household_id = current_household_id())
  );

create policy "installment_plans: delete"
  on installment_plans for delete
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or
    (scope = 'shared' and household_id = current_household_id())
  );

-- ----------------------------------------------------------------
-- 3. investments — always individual, private to owner
-- ----------------------------------------------------------------
create table investments (
  id               uuid           primary key default gen_random_uuid(),
  household_id     uuid           not null references households(id),
  owner_id         uuid           not null references profiles(id),
  investment_type  text           not null check (investment_type in (
                     'fx_savings', 'fci', 'etf', 'asset_manager', 'plazo_fijo'
                   )),
  name             text           not null,
  invested_amount  numeric(14,2)  not null check (invested_amount > 0),
  current_value    numeric(14,2)  not null check (current_value >= 0),
  currency         text           not null check (currency in ('ARS', 'USD')),
  started_on       date           not null,
  expires_on       date,
  notes            text,
  is_active        boolean        not null default true,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now()
);

alter table investments enable row level security;

create trigger investments_updated_at
  before update on investments
  for each row execute function set_updated_at();

create policy "investments: select"
  on investments for select
  using (owner_id = auth.uid());

create policy "investments: insert"
  on investments for insert
  with check (owner_id = auth.uid() and household_id = current_household_id());

create policy "investments: update"
  on investments for update
  using (owner_id = auth.uid());

create policy "investments: delete"
  on investments for delete
  using (owner_id = auth.uid());
