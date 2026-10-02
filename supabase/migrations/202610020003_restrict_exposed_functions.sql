-- Funcțiile SECURITY DEFINER din schema public sunt apelabile prin API
-- (/rest/v1/rpc/...). Se închid cele care nu trebuie apelate din afară.

-- 1. rls_auto_enable rulează numai ca event trigger; nu are de ce să fie
--    apelabilă de cineva. Event trigger-ul nu are nevoie de EXECUTE.
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. is_admin este folosită de politicile RLS și de garda rolului, deci
--    utilizatorii autentificați trebuie să o poată executa, dar nu prin API.
--    Se mută într-o schemă neexpusă; politicile o referă intern, nu după nume,
--    deci continuă să funcționeze neschimbate.
create schema if not exists access;
revoke all on schema access from public;
grant usage on schema access to authenticated, service_role;

alter function public.is_admin() set schema access;
revoke execute on function access.is_admin() from public, anon;
grant execute on function access.is_admin() to authenticated, service_role;

-- Garda care împiedică un utilizator să-și schimbe singur rolul cheamă
-- funcția după nume, deci se actualizează la noua schemă.
create or replace function private.protect_profile_role()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and not access.is_admin() then
    new.role := old.role;
  end if;
  return new;
end;
$$;

-- 3. get_city_statistics rămâne apelabilă de utilizatorii autentificați
--    intenționat: întoarce numai statistici agregate pe oraș, cu prag minim
--    de șoferi (k-anonimitate), fără date individuale.
comment on function public.get_city_statistics() is
  'Intenționat apelabilă de utilizatorii autentificați: statistici agregate pe oraș, cu prag minim de șoferi; nu expune date individuale.';
