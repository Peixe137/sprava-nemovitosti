-- Krátkodobé pronájmy (Airbnb, Booking, přímé rezervace) + příprava na e-mailovou schránku správy
alter table nemovitost drop constraint if exists nemovitost_vyuziti_check;
alter table nemovitost add constraint nemovitost_vyuziti_check
  check (vyuziti in ('pronajem','kratkodoby','vlastni','rekonstrukce','bez_vyuziti'));

create table if not exists rezervace (
  id                uuid primary key default gen_random_uuid(),
  organizace_id     uuid not null default aktualni_organizace() references organizace(id) on delete cascade,
  nemovitost_id     uuid not null references nemovitost(id) on delete restrict,
  platforma         text not null default 'airbnb' check (platforma in ('airbnb','booking','primo','jine')),
  kod_rezervace     text,
  host              text,
  host_email        text,
  host_telefon      text,
  pocet_hostu       integer check (pocet_hostu > 0),
  prijezd           date not null,
  odjezd            date not null,
  noci              integer generated always as (odjezd - prijezd) stored,
  cena_ubytovani    numeric(12,2),      -- co zaplatil host za ubytování (bez úklidu a poplatku z pobytu)
  uklid             numeric(12,2),
  poplatek_platformy numeric(12,2),     -- provize Airbnb/Booking
  poplatek_z_pobytu numeric(12,2),      -- vybraný od hosta, odvádí se obci
  vyplata           numeric(12,2),      -- co skutečně přišlo na účet
  datum_vyplaty     date,
  stav              text not null default 'potvrzena' check (stav in ('potvrzena','zrusena')),
  pohyb_id          uuid references bankovni_pohyb(id) on delete set null,
  poznamka          text,
  vytvoreno         timestamptz not null default now(),
  check (odjezd > prijezd)
);
create index if not exists rezervace_obdobi on rezervace (organizace_id, nemovitost_id, prijezd, odjezd);
create unique index if not exists rezervace_kod on rezervace (organizace_id, platforma, kod_rezervace) where kod_rezervace is not null;
alter table rezervace enable row level security;
create policy tym_vse on rezervace for all
  using (moje_role(organizace_id) in ('majitel','spravce','asistent'))
  with check (moje_role(organizace_id) in ('majitel','spravce','asistent'));
create policy vlastnik_cte on rezervace for select using (
  moje_role(organizace_id) = 'vlastnik' and exists (select 1 from vlastnictvi vl
    where vl.vlastnik_id = muj_vlastnik(rezervace.organizace_id) and vl.nemovitost_id = rezervace.nemovitost_id));
grant select, insert, update, delete on rezervace to authenticated;

-- Příprava na e-mail správy (zatím nepoužito): schránka + příchozí zprávy v komunikaci
create table if not exists emailova_schranka (
  id                 uuid primary key default gen_random_uuid(),
  organizace_id      uuid not null default aktualni_organizace() references organizace(id) on delete cascade,
  adresa             text not null,
  nazev              text,
  imap_server        text,
  smtp_server        text,
  vault_secret_nazev text,              -- heslo jen ve Vaultu, nikdy v tabulce
  posledni_sync      timestamptz,
  aktivni            boolean not null default false,
  unique (organizace_id, adresa)
);
alter table emailova_schranka enable row level security;
create policy tym_vse on emailova_schranka for all
  using (moje_role(organizace_id) in ('majitel','spravce'))
  with check (moje_role(organizace_id) in ('majitel','spravce'));
grant select, insert, update, delete on emailova_schranka to authenticated;

alter table komunikace
  add column if not exists schranka_id  uuid references emailova_schranka(id) on delete set null,
  add column if not exists nemovitost_id uuid references nemovitost(id) on delete set null,
  add column if not exists odesilatel   text,
  add column if not exists predmet      text,
  add column if not exists message_id   text,
  add column if not exists vlakno_id    text,
  add column if not exists prilohy      jsonb,
  add column if not exists prijato      timestamptz;
create unique index if not exists komunikace_message_id on komunikace (organizace_id, message_id) where message_id is not null;

create or replace view v_vynosnost with (security_invoker = true) as
with roky as (
  select distinct extract(year from d)::int as rok, nemovitost_id from (
    select p.obdobi as d, s.nemovitost_id from pohledavka p join najemni_smlouva s on s.id = p.smlouva_id where p.obdobi is not null
    union all select datum, nemovitost_id from naklad
    union all select datum, nemovitost_id from prijem_ostatni
    union all select odjezd, nemovitost_id from rezervace where stav <> 'zrusena'
  ) x
),
predepsano as (
  select s.nemovitost_id, extract(year from p.obdobi)::int rok,
         sum(pp.castka) filter (where pp.druh = 'najem') as najem_predepsany
  from pohledavka p
  join najemni_smlouva s on s.id = p.smlouva_id
  join pohledavka_polozka pp on pp.pohledavka_id = p.id
  where p.druh = 'mesicni'
  group by 1,2
),
vybrano as (
  select s.nemovitost_id, extract(year from p.obdobi)::int rok,
         round(sum(pp.castka * case when p.castka = 0 then 0 else p.uhrazeno / p.castka end)
           filter (where pp.druh = 'najem'), 2) as najem_vybrany
  from pohledavka p
  join najemni_smlouva s on s.id = p.smlouva_id
  join pohledavka_polozka pp on pp.pohledavka_id = p.id
  where p.druh = 'mesicni'
  group by 1,2
),
nakl as (
  select nemovitost_id, extract(year from datum)::int rok,
         sum(castka_celkem) filter (where kategorie not in ('technicke_zhodnoceni','porizeni') and sluzba_vyuctovani is null) as provozni_naklady,
         sum(castka_celkem) filter (where kategorie = 'technicke_zhodnoceni') as investice
  from naklad group by 1,2
),
ost as (
  select nemovitost_id, rok, sum(c) as ostatni_prijmy from (
    select nemovitost_id, extract(year from datum)::int rok, castka c from prijem_ostatni
    -- krátkodobé pronájmy: čistá výplata bez poplatku z pobytu (ten se odvádí obci)
    union all select nemovitost_id, extract(year from odjezd)::int, coalesce(vyplata,0) - coalesce(poplatek_z_pobytu,0)
      from rezervace where stav <> 'zrusena'
  ) x group by 1,2
)
select n.organizace_id, n.id as nemovitost_id, n.nazev, n.typ_kod, r.rok,
       coalesce(pr.najem_predepsany,0) as najem_predepsany,
       coalesce(vy.najem_vybrany,0)    as najem_vybrany,
       coalesce(pr.najem_predepsany,0) - coalesce(vy.najem_vybrany,0) as ztrata_neplaceni,
       coalesce(o.ostatni_prijmy,0)    as ostatni_prijmy,
       coalesce(k.provozni_naklady,0)  as provozni_naklady,
       coalesce(k.investice,0)         as investice,
       coalesce(vy.najem_vybrany,0) + coalesce(o.ostatni_prijmy,0) - coalesce(k.provozni_naklady,0) as cisty_provozni_vynos,
       round(100 * (coalesce(vy.najem_vybrany,0) + coalesce(o.ostatni_prijmy,0) - coalesce(k.provozni_naklady,0))
             / nullif(n.porizovaci_cena + coalesce(n.vedlejsi_naklady_porizeni,0), 0), 2) as vynos_z_porizeni_pct,
       round(100 * (coalesce(vy.najem_vybrany,0) + coalesce(o.ostatni_prijmy,0) - coalesce(k.provozni_naklady,0))
             / nullif(n.trzni_hodnota, 0), 2) as vynos_z_trzni_hodnoty_pct
from roky r
join nemovitost n on n.id = r.nemovitost_id
left join predepsano pr on pr.nemovitost_id = n.id and pr.rok = r.rok
left join vybrano vy    on vy.nemovitost_id = n.id and vy.rok = r.rok
left join nakl k        on k.nemovitost_id = n.id and k.rok = r.rok
left join ost o         on o.nemovitost_id = n.id and o.rok = r.rok;

create or replace function public.hledat(q text, p_limit int default 8)
returns table (druh text, id uuid, titulek text, popis text, odkaz text)
language sql stable security invoker set search_path = public as
$$
with h as (select '%' || bez_diakritiky(trim(q)) || '%' as v)
(select 'nemovitost', n.id, n.nazev,
        concat_ws(' · ', nullif(concat_ws(' ', n.ulice, n.cislo_popisne), ''), n.obec, 'LV ' || n.lv,
                  case when n.archivovano_dne is not null then 'archiv' end),
        '/nemovitosti/' || n.id
   from nemovitost n, h
  where bez_diakritiky(concat_ws(' ', n.nazev, n.ulice, n.cislo_popisne, n.cislo_evidencni, n.obec, n.psc,
                                 n.katastralni_uzemi, n.lv, n.parcelni_cislo, n.poznamka)) like h.v
  order by n.archivovano_dne nulls first, n.nazev limit p_limit)
union all
(select 'katastr', k.nemovitost_id,
        case k.druh when 'parcela' then 'parc. ' || k.cislo_parcely when 'stavba' then 'stavba č.p. ' || coalesce(k.cislo_popisne, '?')
             else 'jednotka ' || coalesce(k.cislo_jednotky, '?') end,
        concat_ws(' · ', n.nazev, 'k.ú. ' || k.katastralni_uzemi, 'LV ' || k.lv),
        '/nemovitosti/' || k.nemovitost_id || '#katastr'
   from katastralni_polozka k join nemovitost n on n.id = k.nemovitost_id, h
  where bez_diakritiky(concat_ws(' ', k.cislo_parcely, k.cislo_popisne, k.cislo_jednotky, k.lv, k.katastralni_uzemi, k.poznamka)) like h.v
  limit p_limit)
union all
(select 'vlastnik', v.id, v.nazev, concat_ws(' · ', '@' || v.zkratka, 'IČO ' || v.ico, v.email, v.telefon), '/vlastnici'
   from vlastnik v, h
  where bez_diakritiky(concat_ws(' ', v.nazev, v.zkratka, v.ico, v.dic, v.adresa, v.email, v.telefon, v.poznamka)) like h.v
  limit p_limit)
union all
(select 'osoba', o.id, coalesce(nullif(concat_ws(' ', o.jmeno, o.prijmeni), ''), o.nazev_firmy),
        concat_ws(' · ', o.telefon, o.email, (select string_agg(n.nazev, ', ') from najemni_smlouva_osoba so
          join najemni_smlouva s on s.id = so.smlouva_id join nemovitost n on n.id = s.nemovitost_id where so.osoba_id = o.id)),
        coalesce((select '/smlouvy/' || so.smlouva_id from najemni_smlouva_osoba so
          join najemni_smlouva s on s.id = so.smlouva_id where so.osoba_id = o.id order by s.datum_od desc limit 1), '/smlouvy')
   from osoba o, h
  where bez_diakritiky(concat_ws(' ', o.jmeno, o.prijmeni, o.nazev_firmy, o.ico, o.email, o.telefon, o.whatsapp, o.adresa, o.poznamka)) like h.v
  limit p_limit)
union all
(select 'smlouva', s.id, concat_ws(' ', 'Smlouva', s.cislo_smlouvy, 'VS ' || s.variabilni_symbol),
        concat_ws(' · ', n.nazev, s.stav), '/smlouvy/' || s.id
   from najemni_smlouva s join nemovitost n on n.id = s.nemovitost_id, h
  where bez_diakritiky(concat_ws(' ', s.cislo_smlouvy, s.variabilni_symbol, s.poznamka)) like h.v
  limit p_limit)
union all
(select 'platba', p.id, concat_ws(' · ', to_char(p.datum, 'DD.MM.YYYY'), p.castka::text || ' ' || p.mena),
        concat_ws(' · ', p.protiucet_nazev, 'VS ' || p.vs, p.zprava), '/finance/platby'
   from bankovni_pohyb p, h
  where bez_diakritiky(concat_ws(' ', p.protiucet_nazev, p.protiucet, p.vs, p.ss, p.ks, p.zprava)) like h.v
  order by p.datum desc limit p_limit)
union all
(select 'naklad', x.id, concat_ws(' · ', to_char(x.datum, 'DD.MM.YYYY'), x.kategorie, x.castka_celkem::text || ' Kč'),
        concat_ws(' · ', n.nazev, x.poznamka), '/finance/naklady'
   from naklad x left join nemovitost n on n.id = x.nemovitost_id, h
  where bez_diakritiky(concat_ws(' ', x.kategorie, x.poznamka, x.sluzba_vyuctovani)) like h.v
  order by x.datum desc limit p_limit)
union all
(select 'dokument', d.id, d.nazev, concat_ws(' · ', d.typ_kod, to_char(d.datum_dokumentu, 'DD.MM.YYYY')),
        coalesce(d.drive_url, '/nemovitosti/' || d.nemovitost_id)
   from dokument d, h
  where bez_diakritiky(concat_ws(' ', d.nazev, d.typ_kod, d.poznamka)) like h.v
  limit p_limit)
union all
(select 'rezervace', r.id, concat_ws(' · ', r.host, to_char(r.prijezd, 'DD.MM.') || '–' || to_char(r.odjezd, 'DD.MM.YYYY')),
        concat_ws(' · ', n.nazev, r.platforma, r.kod_rezervace), '/kratkodobe/' || r.id
   from rezervace r join nemovitost n on n.id = r.nemovitost_id, h
  where bez_diakritiky(concat_ws(' ', r.host, r.host_email, r.host_telefon, r.kod_rezervace, r.poznamka)) like h.v
  order by r.prijezd desc limit p_limit)
$$;
