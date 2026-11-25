-- Adresář: kategorie osob a kontaktní osoby u firem; pohled v_najemnici (aplikováno přes Supabase MCP 25. 11. 2026)
alter table osoba
  add column if not exists kategorie text[] not null default '{}',
  add column if not exists firma_id  uuid references osoba(id) on delete cascade,
  add column if not exists funkce    text,
  add column if not exists web       text;
create index if not exists osoba_firma on osoba (firma_id);
create index if not exists osoba_kategorie on osoba using gin (kategorie);
alter table osoba drop constraint if exists osoba_kategorie_check;
alter table osoba add constraint osoba_kategorie_check check (kategorie <@ array[
  'remeslnik','dodavatel_energie','dodavatel_sluzeb','pravnik','ucetni','urad','banka','pojistovna','realitni','jine']::text[]);
update osoba set kategorie = array['dodavatel_sluzeb'] where je_dodavatel and kategorie = '{}';

create or replace view v_najemnici with (security_invoker = true) as
select s.organizace_id, o.id as osoba_id, s.id as smlouva_id, so.role,
       coalesce(nullif(concat_ws(' ', o.prijmeni, o.jmeno), ''), o.nazev_firmy) as najemnik,
       o.nazev_firmy, o.ico, o.telefon, o.email, o.preferovany_kanal,
       s.nemovitost_id, n.nazev as nemovitost, n.nadrazena_id, s.variabilni_symbol, s.cislo_smlouvy,
       s.datum_od, s.datum_do, s.stav,
       (s.stav = 'aktivni' and s.datum_od <= current_date and (s.datum_do is null or s.datum_do >= current_date)) as aktivni,
       coalesce((select sum(p.castka - p.uhrazeno) from pohledavka p
                  where p.smlouva_id = s.id and p.stav in ('otevrena','castecne') and p.splatnost < current_date), 0) as dluh,
       (select count(*) from termin t where not t.splneno and (t.smlouva_id = s.id or t.nemovitost_id = s.nemovitost_id)) as otevrene_terminy,
       (select count(*) from osoba k where k.firma_id = o.id) as kontaktu
from najemni_smlouva s
join najemni_smlouva_osoba so on so.smlouva_id = s.id and so.role in ('najemce','spolunajemce')
join osoba o on o.id = so.osoba_id
join nemovitost n on n.id = s.nemovitost_id;
grant select on v_najemnici to authenticated;
