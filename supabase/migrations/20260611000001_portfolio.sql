-- ============================================================
-- Portfolio tracking: assets and transactions for broker operations
-- RLS enabled on all tables. Transactions cascade-delete with asset.
-- ============================================================

create table portfolio_assets (
  id           uuid          primary key default gen_random_uuid(),
  household_id uuid          not null references households(id),
  owner_id     uuid          not null references profiles(id),
  name         text          not null,
  asset_type   text          not null check (asset_type in ('stock', 'bond', 'etf', 'on', 'other')),
  currency     text          not null check (currency in ('ARS', 'USD')),
  is_closed    boolean       not null default false,
  created_at   timestamptz   not null default now(),
  updated_at   timestamptz   not null default now()
);

alter table portfolio_assets enable row level security;

create trigger portfolio_assets_updated_at
  before update on portfolio_assets
  for each row execute function set_updated_at();

create policy "portfolio_assets: select"
  on portfolio_assets for select
  using (owner_id = auth.uid());

create policy "portfolio_assets: insert"
  on portfolio_assets for insert
  with check (owner_id = auth.uid() and household_id = current_household_id());

create policy "portfolio_assets: update"
  on portfolio_assets for update
  using (owner_id = auth.uid());

create policy "portfolio_assets: delete"
  on portfolio_assets for delete
  using (owner_id = auth.uid());

-- ----------------------------------------------------------------

create table portfolio_transactions (
  id               uuid           primary key default gen_random_uuid(),
  asset_id         uuid           not null references portfolio_assets(id) on delete cascade,
  owner_id         uuid           not null references profiles(id),
  transaction_type text           not null check (transaction_type in ('buy', 'sell', 'dividend', 'coupon')),
  occurred_on      date           not null,
  quantity         numeric(18,6),
  price_per_unit   numeric(14,4),
  total_amount     numeric(14,2)  not null check (total_amount > 0),
  exchange_rate    numeric(14,4),
  notes            text,
  created_at       timestamptz    not null default now(),
  updated_at       timestamptz    not null default now()
);

alter table portfolio_transactions enable row level security;

create trigger portfolio_transactions_updated_at
  before update on portfolio_transactions
  for each row execute function set_updated_at();

create policy "portfolio_transactions: select"
  on portfolio_transactions for select
  using (owner_id = auth.uid());

create policy "portfolio_transactions: insert"
  on portfolio_transactions for insert
  with check (owner_id = auth.uid());

create policy "portfolio_transactions: update"
  on portfolio_transactions for update
  using (owner_id = auth.uid());

create policy "portfolio_transactions: delete"
  on portfolio_transactions for delete
  using (owner_id = auth.uid());
