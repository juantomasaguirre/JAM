-- Seed inicial — ejecutar UNA SOLA VEZ en el SQL Editor de Supabase.
-- Crea el hogar y vincula los dos usuarios ya existentes en auth.users.

do $$
declare
  hh_id  uuid := gen_random_uuid();
  coni   uuid := '7d1a1698-4550-4ee4-8ebf-414d1b0288b4';
  juanto uuid := '8daf8bcd-4e7b-4dfb-b3e0-0908fdd1eaba';
begin
  insert into households (id, name)
  values (hh_id, 'Casa');

  insert into profiles (id, household_id, display_name)
  values
    (coni,   hh_id, 'Coni'),
    (juanto, hh_id, 'Juanto');
end;
$$;
