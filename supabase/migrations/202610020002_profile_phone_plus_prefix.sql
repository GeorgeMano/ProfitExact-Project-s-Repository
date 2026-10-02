-- Supabase Auth păstrează telefonul fără „+” (de exemplu 40733111222), dar
-- profilul cere formatul internațional +407XXXXXXXX. Fără normalizare,
-- confirmarea codului prin SMS eșua la crearea profilului și înregistrarea
-- nu se putea termina.
create or replace function private.create_profile_after_contact_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
begin
  if new.email_confirmed_at is not null
    and new.phone_confirmed_at is not null
    and new.phone is not null then
    normalized_phone := '+' || ltrim(new.phone, '+');

    insert into public.profiles (user_id, phone_number)
    values (new.id, normalized_phone)
    on conflict (user_id) do update set phone_number = excluded.phone_number;
  end if;
  return new;
end;
$$;
