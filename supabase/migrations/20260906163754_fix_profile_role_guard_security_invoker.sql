-- Versiunea anterioara era SECURITY DEFINER, iar acolo current_user devine
-- proprietarul functiei (postgres), deci garda se anula singura si orice
-- utilizator se putea promova admin. SECURITY INVOKER pastreaza rolul real
-- al apelantului ('authenticated' prin PostgREST).
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.role is distinct from old.role
     and current_user not in ('postgres', 'supabase_admin', 'service_role')
     and not public.is_admin() then
    new.role := old.role;
  end if;

  return new;
end;
$$;
