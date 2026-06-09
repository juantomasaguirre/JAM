-- Add Liquidaciones category for both expense and income kinds.
-- Used to represent debt settlements between the two users.
with h as (select id from households where name = 'Casa')
insert into categories (household_id, name, kind)
select h.id, cats.name, cats.kind
from h
cross join (values
  ('Liquidaciones', 'expense'),
  ('Liquidaciones', 'income')
) as cats(name, kind);
