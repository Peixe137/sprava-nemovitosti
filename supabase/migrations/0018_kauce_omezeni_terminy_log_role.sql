-- 27. 11. 2026: DIČ osob, omezení z LV, kauce jako platba, úkoly a termíny s prioritou, role Údržbář, log změn

-- 1) DIČ u osob (z ARES)
alter table osoba add column if not exists dic text;
alter table profil add column if not exists telefon text;

-- 2) Omezení vlastnického práva z listu vlastnictví (zástava, exekuce, věcné břemeno…)
create table if not exists omezeni (
  id            uuid primary key default gen_random_uuid(),
  organizace_id uuid not null default aktualni_organizace() references organizace(id) on delete cascade,
  nemovitost_id uuid not null references nemovitost(id) on delete cascade,
  druh          text not null check (druh in ('zastava','exekuce','vecne_bremeno','predkupni_pravo','zakaz_zcizeni','jine')),
  popis         text,
  opravneny     text,          -- u koho (banka, exekutor, oprávněný z břemene)
  datum         date,
  vytvoreno     timestamptz not null default now()
);
create index if not exists omezeni_nemovitost on omezeni (nemovitost_id);
alter table omezeni enable row level security;

-- 3) Úkoly a termíny: obecný úkol, priorita, popis, kdy splněno
alter table termin drop constraint if exists termin_druh_check;
alter table termin add constraint termin_druh_check check (druh in ('ukol','revize','pojisteni','konec_smlouvy','dan_z_nemovitosti','valorizace','vyuctovani','cejch_meridla','jiny'));
alter table termin add column if not exists priorita text not null default 'dulezite' check (priorita in ('nedulezite','dulezite','urgentni'));
alter table termin add column if not exists popis text;
alter table termin add column if not exists splneno_dne date;
alter table termin add column if not exists vytvoreno timestamptz not null default now();
alter table termin alter column splneno set default false;
alter table termin alter column opakovani set default 'zadne';

-- 4) Role Údržbář: vidí nemovitosti, termíny a revize, termíny plní
alter table clenstvi drop constraint if exists clenstvi_role_check;
alter table clenstvi add constraint clenstvi_role_check check (role in ('majitel','spravce','ucetni','host','udrzbar','vlastnik','najemnik'));

do $$
declare t text;
begin
  -- RLS pro novou tabulku omezeni stejně jako ostatní (zápis správce, mazání administrátor)
  execute $p$create policy tym_cte on omezeni for select using (moje_role(organizace_id) in ('majitel','spravce','ucetni','host','udrzbar'))$p$;
  execute $p$create policy tym_zakladat on omezeni for insert with check (moje_role(organizace_id) in ('majitel','spravce'))$p$;
  execute $p$create policy tym_upravit on omezeni for update using (moje_role(organizace_id) in ('majitel','spravce')) with check (moje_role(organizace_id) in ('majitel','spravce'))$p$;
  execute $p$create policy tym_mazat on omezeni for delete using (moje_role(organizace_id) in ('majitel','spravce'))$p$;
  -- údržbář čte technické tabulky
  foreach t in array array['nemovitost','katastralni_polozka','termin','dokument','odberne_misto','meridlo','odecet'] loop
    execute format('drop policy if exists tym_cte on %I', t);
    execute format($p$create policy tym_cte on %I for select using (moje_role(organizace_id) in ('majitel','spravce','ucetni','host','udrzbar'))$p$, t);
  end loop;
  -- termíny: zakládá a plní i údržbář
  drop policy if exists tym_zakladat on termin;
  drop policy if exists tym_upravit on termin;
  create policy tym_zakladat on termin for insert with check (moje_role(organizace_id) in ('majitel','spravce','udrzbar'));
  create policy tym_upravit on termin for update using (moje_role(organizace_id) in ('majitel','spravce','udrzbar')) with check (moje_role(organizace_id) in ('majitel','spravce','udrzbar'));
end $$;
grant select, insert, update, delete on omezeni to authenticated;

create or replace function pridat_clena(p_email text, p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; org uuid := aktualni_organizace();
begin
  if moje_role(org) <> 'majitel' then raise exception 'Uživatele spravuje jen administrátor.'; end if;
  if p_role not in ('majitel','spravce','ucetni','host','udrzbar') then raise exception 'Neznámá role.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'neexistuje'; end if;
  insert into clenstvi (organizace_id, user_id, role) values (org, uid, p_role)
    on conflict (organizace_id, user_id) do update set role = excluded.role;
  insert into profil (user_id, aktivni_organizace_id) values (uid, org) on conflict (user_id) do nothing;
  return 'ok';
end $$;

drop function if exists clenove_organizace();
create function clenove_organizace()
returns table (user_id uuid, email text, role text, posledni_prihlaseni timestamptz, jmeno text, telefon text, pozvan timestamptz)
language sql stable security definer set search_path = public as $$
  select c.user_id, u.email::text, c.role, u.last_sign_in_at, p.jmeno, p.telefon, u.invited_at
    from clenstvi c join auth.users u on u.id = c.user_id left join profil p on p.user_id = c.user_id
   where c.organizace_id = aktualni_organizace() and moje_role(aktualni_organizace()) = 'majitel'
   order by u.email
$$;
revoke execute on function clenove_organizace() from public, anon;
grant execute on function clenove_organizace() to authenticated;

-- jméno a telefon člena může upravit jen administrátor (profil jinak patří uživateli)
create or replace function upravit_clena(p_user uuid, p_jmeno text, p_telefon text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if moje_role(aktualni_organizace()) <> 'majitel' then raise exception 'Uživatele spravuje jen administrátor.'; end if;
  if not exists (select 1 from clenstvi where organizace_id = aktualni_organizace() and user_id = p_user) then raise exception 'Uživatel není členem.'; end if;
  insert into profil (user_id, jmeno, telefon, aktivni_organizace_id) values (p_user, nullif(trim(p_jmeno), ''), nullif(trim(p_telefon), ''), aktualni_organizace())
    on conflict (user_id) do update set jmeno = excluded.jmeno, telefon = excluded.telefon;
end $$;
revoke execute on function upravit_clena(uuid, text, text) from public, anon;
grant execute on function upravit_clena(uuid, text, text) to authenticated;

-- 5) Kauce jako platba: ke smlouvě s kaucí patří pohledávka „kauce“ (splatná dnem začátku), páruje se podle VS
create or replace function kauce_pohledavka() returns trigger
language plpgsql security definer set search_path = public as $$
declare p pohledavka%rowtype;
begin
  select * into p from pohledavka where smlouva_id = new.id and druh = 'kauce' limit 1;
  if coalesce(new.kauce_castka, 0) <= 0 then
    if found and p.uhrazeno = 0 then delete from pohledavka where id = p.id; end if;
    return new;
  end if;
  if not found then
    insert into pohledavka (organizace_id, smlouva_id, druh, obdobi, splatnost, castka, uhrazeno, stav)
    values (new.organizace_id, new.id, 'kauce', date_trunc('month', new.datum_od)::date, new.datum_od, new.kauce_castka,
            case when new.kauce_prijata_dne is not null then new.kauce_castka else 0 end,
            case when new.kauce_prijata_dne is not null then 'uhrazena' else 'otevrena' end);
  elsif p.castka <> new.kauce_castka or p.splatnost <> new.datum_od then
    update pohledavka set castka = new.kauce_castka, splatnost = new.datum_od, obdobi = date_trunc('month', new.datum_od)::date,
           stav = case when uhrazeno >= new.kauce_castka then 'uhrazena' when uhrazeno > 0 then 'castecne' else 'otevrena' end
     where id = p.id;
  end if;
  return new;
end $$;
drop trigger if exists kauce_pohledavka on najemni_smlouva;
create trigger kauce_pohledavka after insert or update of kauce_castka, datum_od, kauce_prijata_dne on najemni_smlouva
  for each row execute function kauce_pohledavka();

-- zaplacená kauce zapíše datum přijetí do smlouvy
create or replace function kauce_prijata() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.druh = 'kauce' and new.stav = 'uhrazena' and old.stav is distinct from 'uhrazena' then
    update najemni_smlouva set kauce_prijata_dne = coalesce(kauce_prijata_dne, current_date) where id = new.smlouva_id;
  end if;
  return new;
end $$;
drop trigger if exists kauce_prijata on pohledavka;
create trigger kauce_prijata after update of stav on pohledavka for each row execute function kauce_prijata();

update najemni_smlouva set kauce_castka = kauce_castka where coalesce(kauce_castka, 0) > 0; -- doplní pohledávky ke stávajícím smlouvám

-- 6) Log změn: kdo, kdy, co (přidání, úprava jen změněných polí, smazání). Čte jen administrátor.
create table if not exists log_zmen (
  id            bigint generated always as identity primary key,
  organizace_id uuid,
  kdy           timestamptz not null default now(),
  user_id       uuid default auth.uid(),
  tabulka       text not null,
  zaznam_id     uuid,
  akce          text not null check (akce in ('pridano','upraveno','smazano')),
  zmeny         jsonb
);
create index if not exists log_zmen_kdy on log_zmen (organizace_id, kdy desc);
create index if not exists log_zmen_zaznam on log_zmen (zaznam_id);
alter table log_zmen enable row level security;
create policy cte on log_zmen for select using (moje_role(organizace_id) = 'majitel');
grant select on log_zmen to authenticated;

create or replace function zapsat_log() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  stary jsonb; novy jsonb; rozdil jsonb := '{}'; k text;
begin
  if tg_op = 'INSERT' then
    novy := to_jsonb(new);
    insert into log_zmen (organizace_id, tabulka, zaznam_id, akce, zmeny)
    values ((novy->>'organizace_id')::uuid, tg_table_name, coalesce(novy->>'id', novy->>'user_id', novy->>'smlouva_id', novy->>'nemovitost_id')::uuid, 'pridano', novy - 'organizace_id' - 'vytvoreno');
    return new;
  elsif tg_op = 'UPDATE' then
    stary := to_jsonb(old); novy := to_jsonb(new);
    for k in select jsonb_object_keys(novy) loop
      if stary->k is distinct from novy->k then rozdil := rozdil || jsonb_build_object(k, jsonb_build_array(stary->k, novy->k)); end if;
    end loop;
    if rozdil <> '{}' then
      insert into log_zmen (organizace_id, tabulka, zaznam_id, akce, zmeny)
      values ((novy->>'organizace_id')::uuid, tg_table_name, coalesce(novy->>'id', novy->>'user_id', novy->>'smlouva_id', novy->>'nemovitost_id')::uuid, 'upraveno', rozdil);
    end if;
    return new;
  else
    stary := to_jsonb(old);
    insert into log_zmen (organizace_id, tabulka, zaznam_id, akce, zmeny)
    values ((stary->>'organizace_id')::uuid, tg_table_name, coalesce(stary->>'id', stary->>'user_id', stary->>'smlouva_id', stary->>'nemovitost_id')::uuid, 'smazano', stary - 'organizace_id');
    return old;
  end if;
end $$;

do $$
declare t text;
begin
  foreach t in array array['nemovitost','vlastnik','osoba','vlastnictvi','najemni_smlouva','najemni_smlouva_osoba','predpis_polozka',
                           'naklad','prijem_ostatni','rezervace','bankovni_ucet','parovani','dokument','termin','katastralni_polozka',
                           'omezeni','clenstvi','zadost_smazani','odberne_misto','meridlo','odecet','vyuctovani']
  loop
    execute format('drop trigger if exists zapsat_log on %I', t);
    execute format('create trigger zapsat_log after insert or update or delete on %I for each row execute function zapsat_log()', t);
  end loop;
end $$;
