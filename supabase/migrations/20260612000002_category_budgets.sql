-- ============================================================
-- Category budgets — monthly spending limits per category,
-- shared at household level, stored in ARS.
-- ============================================================

create table category_budgets (
  id            uuid           primary key default gen_random_uuid(),
  household_id  uuid           not null references households(id),
  category_id   uuid           not null references categories(id),
  monthly_limit numeric(14,2)  not null check (monthly_limit > 0),
  created_at    timestamptz    not null default now(),
  updated_at    timestamptz    not null default now(),
  unique(household_id, category_id)
);

alter table category_budgets enable row level security;

create trigger category_budgets_updated_at
  before update on category_budgets
  for each row execute function set_updated_at();

create policy "category_budgets: select"
  on category_budgets for select
  using (household_id = current_household_id());

create policy "category_budgets: insert"
  on category_budgets for insert
  with check (household_id = current_household_id());

create policy "category_budgets: update"
  on category_budgets for update
  using (household_id = current_household_id());

create policy "category_budgets: delete"
  on category_budgets for delete
  using (household_id = current_household_id());
