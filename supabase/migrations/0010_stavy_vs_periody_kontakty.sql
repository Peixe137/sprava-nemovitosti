-- 1) Stav nemovitosti rozdělen: fáze (stav) × využití × upozornění; obsazenost se počítá ze smluv
alter table nemovitost
  add column if not exists vyuziti text not null default 'pronajem'
    check (vyuziti in ('pronajem','vlastni','rekonstrukce','bez_vyuziti')),
  add column if not exists upozorneni text,
  add column if not exists kod_jednotky text check (kod_jednotky ~ '^[0-9]{1,3}$');

update nemovitost set vyuziti = 'rekonstrukce' where stav = 'rekonstrukce';
update nemovitost set upozorneni = 'Řešení právních vad' where stav = 'pravni_vady' and upozorneni is null;
update nemovitost set stav = 'drzeni' where stav not in ('v_nakupu','drzeni','v_prodeji');
alter table nemovitost drop constraint if exists nemovitost_stav_check;
alter table nemovitost add constraint nemovitost_stav_check check (stav in ('v_nakupu','drzeni','v_prodeji'));

-- 2) Periodicita položek předpisu (nájem i zálohy)
alter table predpis_polozka
  add column if not exists perioda text not null default 'mesicne'
    check (perioda in ('mesicne','ctvrtletne','pololetne','rocne'));

-- 3) Kontaktní osoby u smlouvy (vedoucí pobočky, účetní…)
alter table najemni_smlouva_osoba
  add column if not exists funkce text,
  add column if not exists poznamka text;

-- 4) VS unikátní v organizaci
create unique index if not exists najemni_smlouva_vs_uni on najemni_smlouva (organizace_id, ltrim(variabilni_symbol, '0'));

-- Návrh VS: LV + číslo jednotky (3 číslice) + pořadí smlouvy na jednotce (1–9). Např. 1910 001 1 → 19100011
create or replace function navrhnout_vs(p_nemovitost uuid)
returns text language plpgsql stable security invoker set search_path = public as $$
declare
  n nemovitost%rowtype; r nemovitost%rowtype; lv text; kod text; vs text;
begin
  select * into n from nemovitost where id = p_nemovitost;
  if not found then return null; end if;
  if n.nadrazena_id is not null then select * into r from nemovitost where id = n.nadrazena_id; end if;
  lv := regexp_replace(coalesce(n.lv, r.lv, ''), '\D', '', 'g');
  if lv = '' or length(lv) > 6 then return null; end if;
  kod := coalesce(n.kod_jednotky,
                  case when n.nadrazena_id is not null then (regexp_match(n.nazev, '(\d{1,3})'))[1] end,
                  '0');
  for i in 1..9 loop
    vs := lv || lpad(kod, 3, '0') || i;
    if not exists (select 1 from najemni_smlouva where ltrim(variabilni_symbol, '0') = ltrim(vs, '0')) then
      return vs;
    end if;
  end loop;
  return null;
end $$;
revoke execute on function navrhnout_vs(uuid) from public, anon;
grant execute on function navrhnout_vs(uuid) to authenticated;

-- Generování pohledávek s periodou: položka se předepíše v měsících, kdy uplynul násobek periody od jejího začátku
create or replace function vygenerovat_pohledavky(p_smlouva uuid, p_do date default current_date)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  s najemni_smlouva%rowtype; mesic date; konec date; splatno date; celkem numeric(12,2); nova_id uuid; pocet integer := 0;
begin
  select * into s from najemni_smlouva where id = p_smlouva;
  if not found then raise exception 'Smlouva nenalezena'; end if;
  mesic := date_trunc('month', s.datum_od)::date;
  konec := date_trunc('month', least(p_do, coalesce(s.datum_do, p_do)))::date;

  while mesic <= konec loop
    create temp table if not exists _pol (druh text, castka numeric) on commit drop;
    truncate _pol;
    insert into _pol
    select druh, castka from predpis_polozka pp
     where smlouva_id = s.id
       and platnost_od <= (mesic + interval '1 month - 1 day')::date
       and (platnost_do is null or platnost_do >= mesic)
       and ((extract(year from mesic) - extract(year from date_trunc('month', pp.platnost_od))) * 12
            + extract(month from mesic) - extract(month from date_trunc('month', pp.platnost_od)))::int
           % case pp.perioda when 'ctvrtletne' then 3 when 'pololetne' then 6 when 'rocne' then 12 else 1 end = 0;
    select coalesce(sum(castka), 0) into celkem from _pol;

    if celkem > 0 then
      splatno := (case when s.splatnost_predem then mesic else (mesic + interval '1 month')::date end)
                 + least(s.den_splatnosti,
                         extract(day from (date_trunc('month', case when s.splatnost_predem then mesic else (mesic + interval '1 month')::date end) + interval '1 month - 1 day'))::int) - 1;
      insert into pohledavka (organizace_id, smlouva_id, druh, obdobi, splatnost, castka)
      values (s.organizace_id, s.id, 'mesicni', mesic, splatno, celkem)
      on conflict (smlouva_id, druh, obdobi) do nothing
      returning id into nova_id;
      if nova_id is not null then
        insert into pohledavka_polozka (organizace_id, pohledavka_id, druh, castka)
        select s.organizace_id, nova_id, druh, sum(castka) from _pol group by druh;
        pocet := pocet + 1;
      end if;
      nova_id := null;
    end if;
    mesic := (mesic + interval '1 month')::date;
  end loop;
  return pocet;
end $$;
revoke execute on function vygenerovat_pohledavky(uuid, date) from public, anon;
grant execute on function vygenerovat_pohledavky(uuid, date) to authenticated;
