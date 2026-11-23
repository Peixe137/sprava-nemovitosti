-- Role: majitel = Administrátor (vše vč. mazání a uživatelů), spravce = Správce (zakládá a upravuje, mazání jen navrhuje),
-- ucetni = Účetní (finance upravuje, ostatní čte), host = jen čtení. vlastnik/najemnik = budoucí klientský přístup.
alter table clenstvi drop constraint if exists clenstvi_role_check;
update clenstvi set role = 'spravce' where role = 'asistent';
alter table clenstvi add constraint clenstvi_role_check
  check (role in ('majitel','spravce','ucetni','host','vlastnik','najemnik'));

create or replace function moje_aktualni_role() returns text
  language sql stable security definer set search_path = public as
  $$ select moje_role(aktualni_organizace()) $$;
revoke execute on function moje_aktualni_role() from public, anon;
grant execute on function moje_aktualni_role() to authenticated;

do $$
declare
  t text;
  -- tabulky, kde účetní smí zapisovat
  finance text[] := array['bankovni_ucet','bankovni_pohyb','parovani','pohledavka','pohledavka_polozka','predpis_polozka',
                          'naklad','prijem_ostatni','vyuctovani','vyuctovani_polozka','rezervace','osoba','komunikace'];
  -- technické vazby, které se mažou při běžných úpravách (výměna vlastníka, přepočet plateb, odebrání kontaktu)
  technicke text[] := array['vlastnictvi','pohledavka','pohledavka_polozka','parovani','najemni_smlouva_osoba'];
  zapis text;
  mazani text;
begin
  foreach t in array array[
    'vlastnik','osoba','nemovitost','vlastnictvi','bankovni_ucet','bankovni_pohyb',
    'najemni_smlouva','najemni_smlouva_osoba','predpis_polozka','pohledavka','pohledavka_polozka',
    'parovani','odberne_misto','meridlo','odecet','naklad','prijem_ostatni','vyuctovani',
    'vyuctovani_polozka','dokument','termin','upominka_pravidlo','komunikace','vykaz_vlastnik',
    'katastralni_polozka','rezervace']
  loop
    execute format('drop policy if exists tym_vse on %I', t);
    execute format('drop policy if exists tym_cte on %I', t);
    execute format('drop policy if exists tym_zakladat on %I', t);
    execute format('drop policy if exists tym_upravit on %I', t);
    execute format('drop policy if exists tym_mazat on %I', t);
    zapis := case when t = any(finance) then $r$('majitel','spravce','ucetni')$r$ else $r$('majitel','spravce')$r$ end;
    mazani := case when t = any(technicke) then
                case when t = any(finance) then $r$('majitel','spravce','ucetni')$r$ else $r$('majitel','spravce')$r$ end
              else $r$('majitel')$r$ end;
    execute format($p$create policy tym_cte on %I for select using (moje_role(organizace_id) in ('majitel','spravce','ucetni','host'))$p$, t);
    execute format($p$create policy tym_zakladat on %I for insert with check (moje_role(organizace_id) in %s)$p$, t, zapis);
    execute format($p$create policy tym_upravit on %I for update using (moje_role(organizace_id) in %s) with check (moje_role(organizace_id) in %s)$p$, t, zapis, zapis);
    execute format($p$create policy tym_mazat on %I for delete using (moje_role(organizace_id) in %s)$p$, t, mazani);
  end loop;
end $$;

-- Žádosti o smazání: správce navrhne, administrátor schválí (a smaže) nebo zamítne
create table if not exists zadost_smazani (
  id            uuid primary key default gen_random_uuid(),
  organizace_id uuid not null default aktualni_organizace() references organizace(id) on delete cascade,
  tabulka       text not null check (tabulka in ('nemovitost','najemni_smlouva','rezervace','naklad','vlastnik','osoba',
                                                 'dokument','katastralni_polozka','predpis_polozka')),
  zaznam_id     uuid not null,
  popis         text not null,
  odkaz         text,
  duvod         text,
  navrhl        uuid not null default auth.uid() references auth.users(id) on delete set null,
  navrzeno      timestamptz not null default now(),
  stav          text not null default 'navrh' check (stav in ('navrh','schvaleno','zamitnuto')),
  vyridil       uuid references auth.users(id) on delete set null,
  vyrizeno      timestamptz
);
create unique index if not exists zadost_smazani_otevrena on zadost_smazani (tabulka, zaznam_id) where stav = 'navrh';
alter table zadost_smazani enable row level security;
create policy cte on zadost_smazani for select using (moje_role(organizace_id) in ('majitel','spravce','ucetni'));
create policy navrhnout on zadost_smazani for insert with check (moje_role(organizace_id) in ('majitel','spravce','ucetni') and navrhl = auth.uid());
create policy vyridit on zadost_smazani for update using (moje_role(organizace_id) = 'majitel') with check (moje_role(organizace_id) = 'majitel');
grant select, insert, update on zadost_smazani to authenticated;

-- Členové organizace s e-mailem (pro správu uživatelů); vidí jen administrátor
create or replace function clenove_organizace()
returns table (user_id uuid, email text, role text, posledni_prihlaseni timestamptz)
language sql stable security definer set search_path = public as $$
  select c.user_id, u.email::text, c.role, u.last_sign_in_at
    from clenstvi c join auth.users u on u.id = c.user_id
   where c.organizace_id = aktualni_organizace() and moje_role(aktualni_organizace()) = 'majitel'
   order by u.email
$$;
revoke execute on function clenove_organizace() from public, anon;
grant execute on function clenove_organizace() to authenticated;

-- Přidání existujícího uživatele (už se jednou přihlásil / byl pozván v Supabase) do organizace podle e-mailu
create or replace function pridat_clena(p_email text, p_role text)
returns text language plpgsql security definer set search_path = public as $$
declare uid uuid; org uuid := aktualni_organizace();
begin
  if moje_role(org) <> 'majitel' then raise exception 'Uživatele spravuje jen administrátor.'; end if;
  if p_role not in ('majitel','spravce','ucetni','host') then raise exception 'Neznámá role.'; end if;
  select id into uid from auth.users where lower(email) = lower(trim(p_email));
  if uid is null then return 'neexistuje'; end if;
  insert into clenstvi (organizace_id, user_id, role) values (org, uid, p_role)
    on conflict (organizace_id, user_id) do update set role = excluded.role;
  insert into profil (user_id, aktivni_organizace_id) values (uid, org) on conflict (user_id) do nothing;
  return 'ok';
end $$;
revoke execute on function pridat_clena(text, text) from public, anon;
grant execute on function pridat_clena(text, text) to authenticated;
