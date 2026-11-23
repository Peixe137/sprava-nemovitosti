-- Katastrální skladba nemovitosti: z jakých pozemků, staveb a jednotek se skládá.
-- (Jedna nemovitost/areál může stát na více parcelách a mít více budov; byt = jednotka + podíl na pozemku.)
create table katastralni_polozka (
  id                 uuid primary key default gen_random_uuid(),
  organizace_id      uuid not null default aktualni_organizace() references organizace(id) on delete cascade,
  nemovitost_id      uuid not null references nemovitost(id) on delete cascade,
  druh               text not null check (druh in ('parcela','stavba','jednotka')),
  katastralni_uzemi  text,
  ku_kod             integer,                 -- kód katastrálního území (RÚIAN)
  lv                 text,
  cislo_parcely      text,                    -- např. 1435/1, u staveb parcela, na které stojí
  druh_pozemku       text,                    -- zastavěná plocha a nádvoří, zahrada…
  vymera_m2          numeric(12,2),
  cislo_popisne      text,                    -- u stavby č.p./č.ev.
  cislo_jednotky     text,                    -- u jednotky, např. 733/5
  podil_citatel      integer,
  podil_jmenovatel   integer,
  ruian_kod          bigint,                  -- id parcely / stavebního objektu v RÚIAN
  poznamka           text,
  vytvoreno          timestamptz not null default now()
);
create index on katastralni_polozka (nemovitost_id);
create index on katastralni_polozka (organizace_id);

alter table katastralni_polozka enable row level security;
create policy tym_vse on katastralni_polozka for all
  using (moje_role(organizace_id) in ('majitel','spravce','asistent'))
  with check (moje_role(organizace_id) in ('majitel','spravce','asistent'));
create policy vlastnik_cte on katastralni_polozka for select using (
  moje_role(organizace_id) = 'vlastnik' and exists (select 1 from vlastnictvi vl
    where vl.vlastnik_id = muj_vlastnik(katastralni_polozka.organizace_id) and vl.nemovitost_id = katastralni_polozka.nemovitost_id));
grant select, insert, update, delete on katastralni_polozka to authenticated;

-- poloha a vazba na RÚIAN u nemovitosti (pro mapu a ověření adresy)
alter table nemovitost add column zem_sirka numeric(9,6), add column zem_delka numeric(9,6),
                       add column ruian_adresni_misto bigint, add column ku_kod integer;
