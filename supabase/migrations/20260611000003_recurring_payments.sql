-- ============================================================
-- Recurring payments: shared household reminders (no payment tracking)
-- ============================================================

create table recurring_payments (
  id           uuid        primary key default gen_random_uuid(),
  household_id uuid        not null references households(id),
  created_by   uuid        not null references profiles(id),
  name         text        not null,
  due_day      int         not null check (due_day >= 1 and due_day <= 31),
  is_active    boolean     not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

alter table recurring_payments enable row level security;

create trigger recurring_payments_updated_at
  before update on recurring_payments
  for each row execute function set_updated_at();

-- Both household members can see, edit and delete shared payments
create policy "recurring_payments: select"
  on recurring_payments for select
  using (household_id = current_household_id());

create policy "recurring_payments: insert"
  on recurring_payments for insert
  with check (created_by = auth.uid() and household_id = current_household_id());

create policy "recurring_payments: update"
  on recurring_payments for update
  using (household_id = current_household_id());

create policy "recurring_payments: delete"
  on recurring_payments for delete
  using (household_id = current_household_id());
