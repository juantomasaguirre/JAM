-- ============================================================
-- Monthly payment checks — tracks which recurring payments are
-- marked as paid for a given year/month. No explicit reset needed:
-- querying by year+month naturally gives a fresh slate each month.
-- ============================================================

create table recurring_payment_checks (
  id                   uuid        primary key default gen_random_uuid(),
  recurring_payment_id uuid        not null references recurring_payments(id) on delete cascade,
  household_id         uuid        not null references households(id),
  year                 int         not null,
  month                int         not null check (month >= 1 and month <= 12),
  paid_by              uuid        not null references profiles(id),
  paid_at              timestamptz not null default now(),
  unique(recurring_payment_id, year, month)
);

alter table recurring_payment_checks enable row level security;

create policy "recurring_payment_checks: select"
  on recurring_payment_checks for select
  using (household_id = current_household_id());

create policy "recurring_payment_checks: insert"
  on recurring_payment_checks for insert
  with check (
    household_id = current_household_id()
    and paid_by = auth.uid()
  );

create policy "recurring_payment_checks: delete"
  on recurring_payment_checks for delete
  using (household_id = current_household_id());
