-- Add 'loan' as a third scope for movements.
-- Loan = current user pays for something 100% owed by the other user.
-- Both household members see loan movements (same as shared).

-- 1. Update scope column check
alter table movements drop constraint movements_scope_check;
alter table movements add constraint movements_scope_check
  check (scope in ('individual', 'shared', 'loan'));

-- 2. Update scope_rules: loan requires paid_by = created_by (lender is always the creator)
alter table movements drop constraint scope_rules;
alter table movements add constraint scope_rules check (
  (scope = 'individual' and paid_by is null and owner_id = created_by)
  or (scope = 'shared' and paid_by is not null)
  or (scope = 'loan' and paid_by is not null and paid_by = created_by)
);

-- 3. Update RLS policies to include loan scope
drop policy "movements: select" on movements;
create policy "movements: select" on movements for select
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or (scope in ('shared', 'loan') and household_id = current_household_id())
  );

drop policy "movements: insert" on movements;
create policy "movements: insert" on movements for insert
  with check (
    created_by = auth.uid()
    and household_id = current_household_id()
    and (
      (scope = 'individual' and owner_id = auth.uid())
      or scope = 'shared'
      or (scope = 'loan' and paid_by = auth.uid())
    )
  );

drop policy "movements: update" on movements;
create policy "movements: update" on movements for update
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or (scope in ('shared', 'loan') and household_id = current_household_id())
  );

drop policy "movements: delete" on movements;
create policy "movements: delete" on movements for delete
  using (
    (scope = 'individual' and owner_id = auth.uid())
    or (scope in ('shared', 'loan') and household_id = current_household_id())
  );
