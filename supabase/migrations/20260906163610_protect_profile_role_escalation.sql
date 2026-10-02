-- Fara asta, un utilizator isi poate seta singur role = 'admin' printr-un
-- update pe propriul rand, pentru ca profiles_owner_all este FOR ALL.
create or replace function public.protect_profile_role()
returns trigger
language plpgsql
security definer
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

create trigger profiles_protect_role
before update on public.profiles
for each row execute function public.protect_profile_role();
