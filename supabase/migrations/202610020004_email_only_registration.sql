-- Înregistrarea se face numai cu email: verificarea telefonului prin SMS este
-- scoasă deocamdată (cost per mesaj). Profilul se creează imediat ce emailul
-- este confirmat; telefonul devine opțional și se completează numai dacă va
-- exista vreodată și este confirmat.
alter table public.profiles alter column phone_number drop not null;

create or replace function private.create_profile_after_contact_verification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  normalized_phone text;
begin
  if new.email_confirmed_at is not null then
    normalized_phone := case
      when new.phone is not null and new.phone <> '' and new.phone_confirmed_at is not null
        then '+' || ltrim(new.phone, '+')
      else null
    end;

    insert into public.profiles (user_id, phone_number)
    values (new.id, normalized_phone)
    on conflict (user_id) do update
      set phone_number = coalesce(excluded.phone_number, public.profiles.phone_number);
  end if;
  return new;
end;
$$;
