-- Relax loan scope: paid_by no longer needs to equal created_by.
-- Required for debt settlements where the creditor registers
-- the other person as payer ("Saldar deuda" feature).

alter table movements drop constraint scope_rules;
alter table movements add constraint scope_rules check (
  (scope = 'individual' and paid_by is null and owner_id = created_by)
  or (scope = 'shared' and paid_by is not null)
  or (scope = 'loan' and paid_by is not null)
);

drop policy "movements: insert" on movements;
create policy "movements: insert" on movements for insert
  with check (
    created_by = auth.uid()
    and household_id = current_household_id()
    and (
      (scope = 'individual' and owner_id = auth.uid())
      or scope = 'shared'
      or (scope = 'loan' and paid_by is not null)
    )
  );
