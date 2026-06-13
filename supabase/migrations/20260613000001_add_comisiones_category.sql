-- Add "Comisiones e impuestos" category for bank fees and taxes
with h as (select id from households where name = 'Casa')
insert into categories (household_id, name, kind)
select h.id, 'Comisiones e impuestos', 'expense'
from h;
