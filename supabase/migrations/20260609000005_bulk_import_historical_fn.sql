-- SECURITY DEFINER function for one-time historical import.
-- Bypasses the insert policy's `created_by = auth.uid()` constraint so that
-- movements originally paid by the other user can be attributed to them.
-- Security maintained: caller must be authenticated and all movements must
-- belong to their household; all user references must be household members.
create or replace function bulk_import_historical(p_rows jsonb)
returns int language plpgsql security definer as $$
declare
  v_household_id uuid;
  v_count        int;
begin
  if auth.uid() is null then
    raise exception 'unauthenticated';
  end if;

  select household_id into v_household_id
  from profiles where id = auth.uid();

  -- All household_id values must match caller's household
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where (r->>'household_id')::uuid <> v_household_id
  ) then
    raise exception 'household_mismatch';
  end if;

  -- All user references (created_by, owner_id, paid_by) must be household members
  if exists (
    select 1 from jsonb_array_elements(p_rows) r
    where not exists (
      select 1 from profiles p
      where p.id = (r->>'created_by')::uuid
        and p.household_id = v_household_id
    )
  ) then
    raise exception 'user_not_in_household';
  end if;

  insert into movements (
    household_id, created_by, owner_id, scope, kind,
    category_id, description, amount, currency, occurred_on, paid_by
  )
  select
    (r->>'household_id')::uuid,
    (r->>'created_by')::uuid,
    (r->>'owner_id')::uuid,
    r->>'scope',
    r->>'kind',
    (r->>'category_id')::uuid,
    r->>'description',
    (r->>'amount')::numeric,
    r->>'currency',
    (r->>'occurred_on')::date,
    (r->>'paid_by')::uuid
  from jsonb_array_elements(p_rows) r;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
