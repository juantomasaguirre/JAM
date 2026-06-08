-- ============================================================
-- Initial schema: households, profiles, categories, movements, fx_rates
-- RLS enabled on all tables from the start.
-- ============================================================

-- ----------------------------------------------------------------
-- 1. households
-- ----------------------------------------------------------------
create table households (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  created_at  timestamptz not null default now()
);

alter table households enable row level security;

-- ----------------------------------------------------------------
-- 2. profiles  (mirrors auth.users)
-- ----------------------------------------------------------------
create table profiles (
  id            uuid        primary key references auth.users(id) on delete cascade,
  household_id  uuid        not null references households(id),
  display_name  text        not null,
  created_at    timestamptz not null default now()
);

alter table profiles enable row level security;

-- ----------------------------------------------------------------
-- 3. SECURITY DEFINER helper — avoids RLS recursion on profiles
-- ----------------------------------------------------------------
create or replace function current_household_id()
returns uuid language sql security definer stable as $$
  select household_id from profiles where id = auth.uid()
$$;

-- ----------------------------------------------------------------
-- 4. categories
-- ----------------------------------------------------------------
create table categories (
  id            uuid    primary key default gen_random_uuid(),
  household_id  uuid    not null references households(id),
  name          text    not null,
  kind          text    not null check (kind in ('expense', 'income')),
  is_archived   boolean not null default false
);

alter table categories enable row level security;

-- ----------------------------------------------------------------
-- 5. movements
-- ----------------------------------------------------------------
create table movements (
  id            uuid           primary key default gen_random_uuid(),
  household_id  uuid           not null references households(id),
  created_by    uuid           not null references profiles(id),
  owner_id      uuid           not null references profiles(id),
  scope         text           not null check (scope in ('individual', 'shared')),
  kind          text           not null check (kind in ('expense', 'income')),
  category_id   uuid           references categories(id),
  description   text           not null,
  amount        numeric(14,2)  not null check (amount > 0),
  currency      text           not null check (currency in ('ARS', 'USD')),
  occurred_on   date           not null,
  paid_by       uuid           references profiles(id),
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),

  -- individual: owner must be creator, no paid_by
  -- shared: paid_by is required
  constraint scope_rules check (
    (scope = 'individual' and paid_by is null and owner_id = created_by)
    or
    (scope = 'shared' and paid_by is not null)
  )
);

alter table movements enable row level security;

-- auto-update updated_at on every row change
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger movements_updated_at
  before update on movements
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------
-- 6. fx_rates  (written only by cron via service_role)
-- ----------------------------------------------------------------
create table fx_rates (
  id           uuid           primary key default gen_random_uuid(),
  rate_date    date           not null,
  dollar_type  text           not null check (dollar_type in ('oficial', 'blue', 'mep', 'ccl', 'mayorista', 'tarjeta', 'cripto')),
  buy          numeric(14,4),
  sell         numeric(14,4),
  source       text           not null default 'dolarapi',
  fetched_at   timestamptz    not null default now(),

  unique (rate_date, dollar_type)
);

alter table fx_rates enable row level security;

-- ================================================================
-- RLS POLICIES
-- ================================================================

-- households: each user sees only their own household
create policy "households: select own"
  on households for select
  using (id = current_household_id());

-- profiles: see everyone in the same household; update only yourself
create policy "profiles: select household members"
  on profiles for select
  using (household_id = current_household_id());

create policy "profiles: update own"
  on profiles for update
  using (id = auth.uid());

-- categories: full access within the household
create policy "categories: household full access"
  on categories for all
  using (household_id = current_household_id());

-- movements: select
--   individual → only the owner
--   shared     → any member of the household
create policy "movements: select"
  on movements for select
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or
    (scope = 'shared' and household_id = current_household_id())
  );

-- movements: insert — must belong to your household; individual must be self-owned
create policy "movements: insert"
  on movements for insert
  with check (
    created_by = auth.uid()
    and household_id = current_household_id()
    and (
      (scope = 'individual' and owner_id = auth.uid())
      or scope = 'shared'
    )
  );

-- movements: update — same visibility rules as select
create policy "movements: update"
  on movements for update
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or
    (scope = 'shared' and household_id = current_household_id())
  );

-- movements: delete — same visibility rules as select
create policy "movements: delete"
  on movements for delete
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or
    (scope = 'shared' and household_id = current_household_id())
  );

-- fx_rates: any authenticated user can read; no client writes (cron uses service_role)
create policy "fx_rates: authenticated read"
  on fx_rates for select
  to authenticated
  using (true);
