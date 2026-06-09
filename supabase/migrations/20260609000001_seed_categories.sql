-- Default categories for the "Casa" household.
-- Managed from dev side; no user-facing CRUD for now.
with h as (
  select id from households where name = 'Casa'
)
insert into categories (household_id, name, kind)
select h.id, cats.name, cats.kind
from h
cross join (values
  ('Alquiler y expensas', 'expense'),
  ('Servicios',           'expense'),
  ('Suscripciones',       'expense'),
  ('Transporte',          'expense'),
  ('Comida y mercado',    'expense'),
  ('Salidas y ocio',      'expense'),
  ('Salud',               'expense'),
  ('Ropa',                'expense'),
  ('Inversiones',         'expense'),
  ('Otros',               'expense'),
  ('Sueldo',              'income'),
  ('Aguinaldo',           'income'),
  ('Freelance',           'income'),
  ('Inversiones',         'income')
) as cats(name, kind);
