-- =====================================================================
--  SPRÁVA NEMOVITOSTÍ – datový model, fáze 1
--  Cíl: Supabase (PostgreSQL 15+), server v EU
--  Číselníky typů nemovitostí a dokumentů převzaty z Notionu
--  (Nemovitosti (DB) → TYP NEMO, Typy dokumentů (DB) → Zkratka)
-- =====================================================================

-- gen_random_uuid() je v PostgreSQL 13+ vestavěná, žádné rozšíření není potřeba

-- ---------------------------------------------------------------------
-- 0. ČÍSELNÍKY
-- ---------------------------------------------------------------------

create table typ_nemovitosti (
  kod          text primary key,            -- B, J, N, P, O, D
  nazev        text not null,
  popis        text,
  -- definice polí navíc pro daný typ (např. pozemek: výměra, druh pozemku)
  extra_pole   jsonb not null default '[]'::jsonb
);

insert into typ_nemovitosti (kod, nazev, extra_pole) values
 ('B','Budova',            '[{"klic":"pocet_podlazi","nazev":"Počet podlaží","typ":"cislo"},{"klic":"rok_vystavby","nazev":"Rok výstavby","typ":"cislo"},{"klic":"zpusob_vyuziti","nazev":"Způsob využití","typ":"text"}]'),
 ('J','Jednotka',          '[{"klic":"dispozice","nazev":"Dispozice","typ":"text"},{"klic":"podlazi","nazev":"Podlaží","typ":"cislo"},{"klic":"cislo_jednotky","nazev":"Číslo jednotky","typ":"text"},{"klic":"podil_spol_casti","nazev":"Podíl na spol. částech","typ":"text"}]'),
 ('N','Nebytová jednotka', '[{"klic":"ucel","nazev":"Účel užívání","typ":"text"},{"klic":"cislo_jednotky","nazev":"Číslo jednotky","typ":"text"}]'),
 ('P','Pozemek',           '[{"klic":"druh_pozemku","nazev":"Druh pozemku","typ":"text"},{"klic":"parcelni_cisla","nazev":"Parcelní čísla","typ":"text"}]'),
 ('O','Ostatní',           '[]'),
 ('D','Podíl',             '[{"klic":"predmet_podilu","nazev":"Předmět podílu","typ":"text"}]');

create table typ_dokumentu (
  kod      text primary key,                -- KUS, NAS, LV, ...
  nazev    text not null,
  aktivni  boolean not null default true,
  -- dokument tohoto typu mívá platnost (pojistka, revize…) → hlídat termín
  ma_platnost boolean not null default false
);

insert into typ_dokumentu (kod, nazev, ma_platnost) values
 ('AML','AML',false),('BAN','Banky',false),('CEP','Čestné prohlášení',false),
 ('DAN','Daňové přiznání',false),('DAS','Darovací smlouva',false),
 ('DOA','Dokumentace k vozidlům',false),('DON','Dokumentace k nemovitosti',false),
 ('ENE','Energie',false),('EXE','Exekuce',false),('FAP','Faktura přijatá',false),
 ('FAV','Faktura vydaná',false),('FID','Firemní dokumenty',false),
 ('FIN','Finance a platby',false),('INF','Informační dokumenty',false),
 ('KUS','Kupní smlouva',false),('LV','List vlastnictví',false),('NAB','Nabídky',false),
 ('NAS','Nájemní smlouva',true),('NNV','Návrh na vklad',false),
 ('OCE','Vlastní vydaná ocenění nemovitostí',false),('PLM','Plná moc',true),
 ('POJ','Pojištění',true),('POK','Pokuta',false),
 ('POS','Posudky, externí ocenění a revize',true),('PRP','Předávací protokol',false),
 ('PRT','Protokoly',false),('PUJ','PŮJČKY',false),('SML','Smlouvy a dohody obecné',true),
 ('SNV','Smlouva o nájmu vozidla',true),('SOC','Sociálka',false),
 ('SOR','Smlouva o rezervaci SOR',true),('SOU','Smlouva úschově',false),
 ('SOZ','Smlouva o zápůjčce',false),('URD','Úřední a soudní dokumenty',false),
 ('VYU','Vyúčtování',false),('VZD','Vzdělání',false),('ZAD','Žádosti a objednávky',false),
 ('ZAS','Zástavní smlouva ZAS',false),('ZPS','Zprostředkovatelská smlouva ZPS',true);

-- ---------------------------------------------------------------------
-- 0b. ORGANIZACE (víc nezávislých správců v jedné aplikaci)
-- ---------------------------------------------------------------------
-- Teď existuje jen jedna organizace (vy). Později se může zaregistrovat
-- kdokoli další a vidí výhradně data své organizace. Každá datová tabulka
-- má sloupec organizace_id a zabezpečení (RLS) filtruje podle členství.

create table organizace (
  id          uuid primary key default gen_random_uuid(),
  nazev       text not null,
  ico         text,
  tarif       text not null default 'interni' check (tarif in ('interni','zkusebni','zakladni','profi')),
  aktivni     boolean not null default true,
  vytvoreno   timestamptz not null default now()
);

create table profil (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  jmeno                  text,
  aktivni_organizace_id  uuid references organizace(id) on delete set null
);

-- Člen organizace a jeho role v ní (jeden člověk může být ve více organizacích)
create table clenstvi (
  organizace_id  uuid not null references organizace(id) on delete cascade,
  user_id        uuid not null references auth.users(id) on delete cascade,
  role           text not null check (role in ('majitel','spravce','asistent','vlastnik','najemnik')),
  vlastnik_id    uuid,                         -- pro roli vlastnik (FK doplněn níže)
  osoba_id       uuid,                         -- pro roli najemnik (FK doplněn níže)
  primary key (organizace_id, user_id)
);

create or replace function aktualni_organizace() returns uuid
  language sql stable security definer set search_path = public as
  $$ select aktivni_organizace_id from profil where user_id = auth.uid() $$;

create or replace function moje_role(org uuid) returns text
  language sql stable security definer set search_path = public as
  $$ select role from clenstvi where organizace_id = org and user_id = auth.uid() $$;

create or replace function muj_vlastnik(org uuid) returns uuid
  language sql stable security definer set search_path = public as
  $$ select vlastnik_id from clenstvi where organizace_id = org and user_id = auth.uid() $$;

-- ---------------------------------------------------------------------
-- 1. VLASTNÍCI A OSOBY
-- ---------------------------------------------------------------------

-- Vlastník = ten, komu nemovitost patří: vaše firma, vy osobně, nebo klient ve správě
create table vlastnik (
  id              uuid primary key default gen_random_uuid(),
  druh            text not null check (druh in ('vlastni_firma','vlastni_osoba','klient_sprava')),
  nazev           text not null,
  zkratka         text,                        -- firemní tag bez @ (z Notion MOJE FIRMY), unikátní v rámci organizace
  pravni_forma    text not null default 'PO' check (pravni_forma in ('PO','FO')),
  ico             text,
  dic             text,
  platce_dph      boolean not null default false,
  adresa          text,
  email           text,
  telefon         text,
  -- odměna za správu (jen u klient_sprava)
  odmena_typ      text check (odmena_typ in ('procento_z_vybraneho','pevna_mesicne','pevna_za_jednotku')),
  odmena_hodnota  numeric(12,2),
  -- pro odhad zdanění výnosu
  dan_rezim       text check (dan_rezim in ('DPPO','FO_skutecne_vydaje','FO_pausal_30')),
  notion_page_id  text,
  poznamka        text,
  vytvoreno       timestamptz not null default now()
);

-- Osoba = nájemník, spolunájemník, ručitel, dodavatel, kontaktní osoba
create table osoba (
  id                 uuid primary key default gen_random_uuid(),
  druh               text not null default 'FO' check (druh in ('FO','PO')),
  jmeno              text,
  prijmeni           text,
  nazev_firmy        text,
  ico                text,
  email              text,
  telefon            text,                     -- ve formátu +420…
  whatsapp           text,
  preferovany_kanal  text not null default 'sms' check (preferovany_kanal in ('sms','whatsapp','email')),
  souhlas_whatsapp   boolean not null default false,   -- opt-in vyžadovaný Metou
  adresa             text,
  je_dodavatel       boolean not null default false,
  poznamka           text,
  vytvoreno          timestamptz not null default now(),
  check (coalesce(prijmeni, nazev_firmy) is not null)
);

-- ---------------------------------------------------------------------
-- 2. NEMOVITOSTI
-- ---------------------------------------------------------------------
-- Jedna tabulka pro všechny úrovně: budova/areál/pozemek je "kořen",
-- byty, nebytové prostory, garáže jsou jeho podřízené záznamy (nadrazena_id).
-- Pronajímat se dá kterýkoli záznam.

create table nemovitost (
  id                uuid primary key default gen_random_uuid(),
  nadrazena_id      uuid references nemovitost(id) on delete restrict,
  typ_kod           text not null references typ_nemovitosti(kod),
  nazev             text not null,             -- název podle konvence složek
  stav              text not null default 'drzeni' check (stav in
                      ('v_nakupu','drzeni','pronajem','rekonstrukce','v_prodeji',
                       'pravni_vady','prodano','ve_sprave','ukonceno')),
  -- katastr
  katastralni_uzemi text,
  lv                text,
  parcelni_cislo    text,
  cislo_popisne     text,
  cislo_evidencni   text,
  -- adresa
  ulice             text,
  obec              text,
  psc               text,
  plocha_m2         numeric(12,2),
  vlastnosti        jsonb not null default '{}'::jsonb,   -- hodnoty polí z typ_nemovitosti.extra_pole
  -- ekonomika (pro výnosnost)
  porizovaci_cena   numeric(14,2),
  datum_porizeni    date,
  vedlejsi_naklady_porizeni numeric(14,2) default 0,   -- daň, provize, právník…
  trzni_hodnota     numeric(14,2),
  datum_oceneni     date,
  -- vazby na stávající systém
  notion_page_id    text,
  drive_folder_url  text,
  clickup_task_id   text,
  poznamka          text,
  vytvoreno         timestamptz not null default now(),
  check (nadrazena_id is null or nadrazena_id <> id)
);
create index on nemovitost (nadrazena_id);
create index on nemovitost (typ_kod);

-- Vlastnictví vč. spoluvlastnických podílů a historie
create table vlastnictvi (
  id              uuid primary key default gen_random_uuid(),
  nemovitost_id   uuid not null references nemovitost(id) on delete cascade,
  vlastnik_id     uuid not null references vlastnik(id) on delete restrict,
  podil_citatel   integer not null default 1 check (podil_citatel > 0),
  podil_jmenovatel integer not null default 1 check (podil_jmenovatel >= podil_citatel),
  platnost_od     date,
  platnost_do     date,
  unique (nemovitost_id, vlastnik_id, platnost_od)
);
create index on vlastnictvi (vlastnik_id);

-- ---------------------------------------------------------------------
-- 3. BANKA
-- ---------------------------------------------------------------------

create table bankovni_ucet (
  id               uuid primary key default gen_random_uuid(),
  vlastnik_id      uuid not null references vlastnik(id) on delete restrict,
  nazev            text not null,
  cislo_uctu       text not null,
  kod_banky        text not null,             -- 2010 = Fio
  iban             text,
  banka            text not null default 'FIO' check (banka in ('FIO','PSD2','IMPORT')),
  -- token se NEUKLÁDÁ sem, ale do Supabase Vault; zde jen název tajemství
  vault_secret_nazev text,
  posledni_sync    timestamptz,
  aktivni          boolean not null default true
);

create table bankovni_pohyb (
  id               uuid primary key default gen_random_uuid(),
  ucet_id          uuid not null references bankovni_ucet(id) on delete cascade,
  banka_pohyb_id   text not null,             -- ID pohybu z Fio (deduplikace)
  datum            date not null,
  castka           numeric(14,2) not null,    -- + příjem / − výdej
  mena             text not null default 'CZK',
  vs               text,
  ks               text,
  ss               text,
  protiucet        text,
  protiucet_banka  text,
  protiucet_nazev  text,
  zprava           text,
  typ              text,
  surova_data      jsonb,
  stav_parovani    text not null default 'nesparovano'
                     check (stav_parovani in ('nesparovano','sparovano','castecne','ignorovat','naklad')),
  vytvoreno        timestamptz not null default now(),
  unique (ucet_id, banka_pohyb_id)
);
create index on bankovni_pohyb (vs);
create index on bankovni_pohyb (datum);

-- ---------------------------------------------------------------------
-- 4. NÁJEMNÍ SMLOUVY A PŘEDPISY
-- ---------------------------------------------------------------------

create table najemni_smlouva (
  id                    uuid primary key default gen_random_uuid(),
  nemovitost_id         uuid not null references nemovitost(id) on delete restrict,
  pronajimatel_id       uuid not null references vlastnik(id) on delete restrict,
  bankovni_ucet_id      uuid references bankovni_ucet(id),
  cislo_smlouvy         text,
  variabilni_symbol     text not null,           -- unikátní v rámci organizace
  datum_od              date not null,
  datum_do              date,                  -- null = doba neurčitá
  vypovedni_lhuta_mesicu integer default 3,
  den_splatnosti        integer not null default 15 check (den_splatnosti between 1 and 31),
  splatnost_predem      boolean not null default true,  -- nájem na běžný měsíc předem
  kauce_castka          numeric(12,2) default 0,
  kauce_prijata_dne     date,
  kauce_vracena_dne     date,
  valorizace            text not null default 'zadna' check (valorizace in ('zadna','inflace_csu','pevne_procento')),
  valorizace_procento   numeric(5,2),
  valorizace_mesic      integer check (valorizace_mesic between 1 and 12),
  stav                  text not null default 'aktivni' check (stav in ('navrh','aktivni','vypovezena','ukoncena')),
  upominky_zapnuty      boolean not null default true,
  poznamka              text,
  vytvoreno             timestamptz not null default now(),
  check (datum_do is null or datum_do >= datum_od)
);
create index on najemni_smlouva (nemovitost_id);

create table najemni_smlouva_osoba (
  smlouva_id  uuid not null references najemni_smlouva(id) on delete cascade,
  osoba_id    uuid not null references osoba(id) on delete restrict,
  role        text not null default 'najemce' check (role in ('najemce','spolunajemce','rucitel','kontakt')),
  primary key (smlouva_id, osoba_id)
);

-- Pravidelné složky platby (nájem, zálohy) s platností – historie změn
create table predpis_polozka (
  id            uuid primary key default gen_random_uuid(),
  smlouva_id    uuid not null references najemni_smlouva(id) on delete cascade,
  druh          text not null check (druh in
                  ('najem','zaloha_voda','zaloha_teplo','zaloha_tuv','zaloha_elektrina','zaloha_plyn',
                   'zaloha_sluzby','parkovani','fond_oprav_prefakturace','jine')),
  popis         text,
  castka        numeric(12,2) not null,
  sazba_dph     numeric(4,2) not null default 0,
  je_zaloha_na_sluzby boolean generated always as (druh like 'zaloha_%') stored,
  platnost_od   date not null,
  platnost_do   date
);
create index on predpis_polozka (smlouva_id);

-- Pohledávka = konkrétní částka k úhradě (měsíční předpis, nedoplatek z vyúčtování…)
create table pohledavka (
  id            uuid primary key default gen_random_uuid(),
  smlouva_id    uuid not null references najemni_smlouva(id) on delete cascade,
  druh          text not null default 'mesicni' check (druh in ('mesicni','vyuctovani','kauce','penale','jine')),
  obdobi        date,                        -- 1. den měsíce, ke kterému patří
  splatnost     date not null,
  castka        numeric(12,2) not null,
  uhrazeno      numeric(12,2) not null default 0,
  stav          text not null default 'otevrena' check (stav in ('otevrena','castecne','uhrazena','prominuta','preplatek')),
  vyuctovani_id uuid,                        -- FK doplněn níže
  vytvoreno     timestamptz not null default now(),
  unique (smlouva_id, druh, obdobi)
);
create index on pohledavka (splatnost) where stav in ('otevrena','castecne');

create table pohledavka_polozka (
  id              uuid primary key default gen_random_uuid(),
  pohledavka_id   uuid not null references pohledavka(id) on delete cascade,
  druh            text not null,
  castka          numeric(12,2) not null
);

-- Spárování platby z banky s pohledávkou (1 platba může pokrýt více pohledávek a naopak)
create table parovani (
  id             uuid primary key default gen_random_uuid(),
  pohyb_id       uuid not null references bankovni_pohyb(id) on delete cascade,
  pohledavka_id  uuid not null references pohledavka(id) on delete cascade,
  castka         numeric(12,2) not null check (castka > 0),
  zpusob         text not null default 'auto' check (zpusob in ('auto','rucni')),
  vytvoril       uuid,
  vytvoreno      timestamptz not null default now(),
  unique (pohyb_id, pohledavka_id)
);

-- ---------------------------------------------------------------------
-- 5. ENERGIE A MĚŘIDLA
-- ---------------------------------------------------------------------

create table odberne_misto (
  id             uuid primary key default gen_random_uuid(),
  nemovitost_id  uuid not null references nemovitost(id) on delete cascade,
  komodita       text not null check (komodita in ('elektrina','plyn','voda','teplo')),
  ean_eic        text,                       -- EAN (elektřina) / EIC (plyn) / číslo OM
  dodavatel_id   uuid references osoba(id),
  zaloha_mesicne numeric(12,2),
  na_koho        text not null default 'vlastnik' check (na_koho in ('vlastnik','najemce')),
  platnost_od    date,
  platnost_do    date
);

create table meridlo (
  id               uuid primary key default gen_random_uuid(),
  nemovitost_id    uuid not null references nemovitost(id) on delete cascade,
  odberne_misto_id uuid references odberne_misto(id),
  druh             text not null check (druh in ('voda_studena','voda_tepla','elektrina','plyn','teplo','rtn')),
  vyrobni_cislo    text,
  umisteni         text,
  jednotka         text not null default 'm3',
  cejch_do         date,
  aktivni          boolean not null default true
);

create table odecet (
  id         uuid primary key default gen_random_uuid(),
  meridlo_id uuid not null references meridlo(id) on delete cascade,
  datum      date not null,
  stav       numeric(14,3) not null,
  druh       text not null default 'pravidelny' check (druh in ('pocatecni','pravidelny','konecny','vymena')),
  foto_url   text,
  unique (meridlo_id, datum, druh)
);

-- ---------------------------------------------------------------------
-- 6. NÁKLADY A OSTATNÍ PŘÍJMY
-- ---------------------------------------------------------------------

create table naklad (
  id               uuid primary key default gen_random_uuid(),
  nemovitost_id    uuid not null references nemovitost(id) on delete restrict,
  vlastnik_id      uuid references vlastnik(id),   -- kdo náklad nese (u spoluvlastnictví)
  kategorie        text not null check (kategorie in
                     ('oprava','udrzba','pojisteni','dan_z_nemovitosti','fond_oprav','sprava_svj',
                      'energie','voda','odpad','uver_uroky','odmena_sprava','pravni_ucetni',
                      'technicke_zhodnoceni','porizeni','revize','ostatni')),
  datum            date not null,
  obdobi_od        date,
  obdobi_do        date,
  castka_bez_dph   numeric(14,2) not null,
  dph              numeric(14,2) not null default 0,
  castka_celkem    numeric(14,2) generated always as (castka_bez_dph + dph) stored,
  -- služba, která se rozúčtuje nájemníkům ve vyúčtování
  sluzba_vyuctovani text check (sluzba_vyuctovani in ('voda','teplo','tuv','elektrina_spol','plyn','vytah','uklid','osvetleni','odpad','ostatni')),
  dodavatel_id     uuid references osoba(id),
  pohyb_id         uuid references bankovni_pohyb(id),
  dokument_id      uuid,                       -- FK doplněn níže
  poznamka         text,
  vytvoreno        timestamptz not null default now()
);
create index on naklad (nemovitost_id, datum);

create table prijem_ostatni (
  id             uuid primary key default gen_random_uuid(),
  nemovitost_id  uuid not null references nemovitost(id) on delete restrict,
  druh           text not null check (druh in ('pojistne_plneni','jednorazovy_najem','refakturace','dotace','ostatni')),
  datum          date not null,
  castka         numeric(14,2) not null,
  pohyb_id       uuid references bankovni_pohyb(id),
  poznamka       text
);

-- ---------------------------------------------------------------------
-- 7. VYÚČTOVÁNÍ SLUŽEB (zák. 67/2013 Sb.)
-- ---------------------------------------------------------------------

create table vyuctovani (
  id            uuid primary key default gen_random_uuid(),
  smlouva_id    uuid not null references najemni_smlouva(id) on delete restrict,
  obdobi_od     date not null,
  obdobi_do     date not null,
  lhuta_dorucit date generated always as ((obdobi_do + interval '4 months')::date) stored,
  zalohy_celkem numeric(12,2),
  naklady_celkem numeric(12,2),
  vysledek      numeric(12,2),               -- + nedoplatek / − přeplatek
  stav          text not null default 'rozpracovano' check (stav in ('rozpracovano','odeslano','vyrovnano')),
  odeslano_dne  date,
  dokument_id   uuid,
  unique (smlouva_id, obdobi_od)
);

create table vyuctovani_polozka (
  id              uuid primary key default gen_random_uuid(),
  vyuctovani_id   uuid not null references vyuctovani(id) on delete cascade,
  sluzba          text not null,
  klic            text not null default 'spotreba' check (klic in ('spotreba','plocha','osoby','jednotky','pevny')),
  naklad          numeric(12,2) not null,
  zalohy          numeric(12,2) not null,
  rozdil          numeric(12,2) generated always as (naklad - zalohy) stored
);

alter table pohledavka add constraint pohledavka_vyuctovani_fk
  foreign key (vyuctovani_id) references vyuctovani(id) on delete set null;

-- ---------------------------------------------------------------------
-- 8. DOKUMENTY (soubory zůstávají na Google Disku)
-- ---------------------------------------------------------------------

create table dokument (
  id              uuid primary key default gen_random_uuid(),
  typ_kod         text not null references typ_dokumentu(kod),
  nazev           text not null,              -- TYP YYMM Subjekty Predmet Upresneni @Firma
  datum_dokumentu date,
  platnost_do     date,
  nemovitost_id   uuid references nemovitost(id) on delete set null,
  smlouva_id      uuid references najemni_smlouva(id) on delete set null,
  osoba_id        uuid references osoba(id) on delete set null,
  vlastnik_id     uuid references vlastnik(id) on delete set null,
  drive_file_id   text,
  drive_url       text,
  notion_page_id  text,
  poznamka        text,
  vytvoreno       timestamptz not null default now()
);
create index on dokument (nemovitost_id);
create index on dokument (platnost_do) where platnost_do is not null;

alter table naklad    add constraint naklad_dokument_fk    foreign key (dokument_id) references dokument(id) on delete set null;
alter table vyuctovani add constraint vyuctovani_dokument_fk foreign key (dokument_id) references dokument(id) on delete set null;

-- ---------------------------------------------------------------------
-- 9. TERMÍNY, UPOMÍNKY, KOMUNIKACE
-- ---------------------------------------------------------------------

-- Hlídané termíny (revize, pojistka, konec smlouvy, daň z nemovitosti, valorizace…)
create table termin (
  id               uuid primary key default gen_random_uuid(),
  druh             text not null check (druh in ('revize','pojisteni','konec_smlouvy','dan_z_nemovitosti',
                                                 'valorizace','vyuctovani','cejch_meridla','jiny')),
  nazev            text not null,
  datum            date not null,
  opakovani        text not null default 'zadne' check (opakovani in ('zadne','mesicne','rocne','dvouletne','petilete')),
  upozornit_dni    integer not null default 30,
  nemovitost_id    uuid references nemovitost(id) on delete cascade,
  smlouva_id       uuid references najemni_smlouva(id) on delete cascade,
  dokument_id      uuid references dokument(id) on delete set null,
  splneno          boolean not null default false,
  clickup_task_id  text
);
create index on termin (datum) where not splneno;

-- Pravidla upomínek (globální, nebo přepsaná pro konkrétní smlouvu)
create table upominka_pravidlo (
  id            uuid primary key default gen_random_uuid(),
  smlouva_id    uuid references najemni_smlouva(id) on delete cascade,   -- null = výchozí pro všechny
  poradi        integer not null,
  dni_od_splatnosti integer not null,        -- −3 = 3 dny před, +10 = 10 dní po
  akce          text not null check (akce in ('zprava','clickup_ukol','pdf_vyzva')),
  kanal         text check (kanal in ('preferovany','sms','whatsapp','email')),
  sablona       text,                         -- text s proměnnými {jmeno} {castka} {splatnost} {vs} {ucet}
  aktivni       boolean not null default true
);

-- výchozí pravidla se zakládají každé nové organizaci (viz zalozit_organizaci níže)

create table komunikace (
  id             uuid primary key default gen_random_uuid(),
  osoba_id       uuid references osoba(id) on delete set null,
  smlouva_id     uuid references najemni_smlouva(id) on delete set null,
  pohledavka_id  uuid references pohledavka(id) on delete set null,
  pravidlo_id    uuid references upominka_pravidlo(id) on delete set null,
  kanal          text not null check (kanal in ('sms','whatsapp','email','telefon','osobne')),
  smer           text not null default 'odchozi' check (smer in ('odchozi','prichozi')),
  prijemce       text,
  text           text,
  stav           text not null default 'ceka' check (stav in ('ceka','odeslano','doruceno','precteno','chyba')),
  externi_id     text,
  chyba          text,
  vytvoreno      timestamptz not null default now(),
  odeslano       timestamptz,
  -- ochrana proti dvojímu odeslání stejné upomínky
  unique (pohledavka_id, pravidlo_id)
);

-- ---------------------------------------------------------------------
-- 10. SPRÁVA PRO KLIENTY – měsíční výkaz vlastníkovi
-- ---------------------------------------------------------------------

create table vykaz_vlastnik (
  id            uuid primary key default gen_random_uuid(),
  vlastnik_id   uuid not null references vlastnik(id) on delete restrict,
  obdobi        date not null,               -- 1. den měsíce
  prijmy        numeric(14,2) not null default 0,
  naklady       numeric(14,2) not null default 0,
  odmena        numeric(14,2) not null default 0,
  k_vyplate     numeric(14,2) generated always as (prijmy - naklady - odmena) stored,
  stav          text not null default 'navrh' check (stav in ('navrh','odeslano','vyplaceno')),
  vyplaceno_dne date,
  dokument_id   uuid references dokument(id),
  unique (vlastnik_id, obdobi)
);

-- ---------------------------------------------------------------------
-- 11. PŘIŘAZENÍ VŠECH DATOVÝCH TABULEK K ORGANIZACI
-- ---------------------------------------------------------------------

alter table clenstvi add constraint clenstvi_vlastnik_fk foreign key (vlastnik_id) references vlastnik(id) on delete set null;
alter table clenstvi add constraint clenstvi_osoba_fk    foreign key (osoba_id)    references osoba(id)    on delete set null;

do $$
declare t text;
begin
  foreach t in array array[
    'vlastnik','osoba','nemovitost','vlastnictvi','bankovni_ucet','bankovni_pohyb',
    'najemni_smlouva','najemni_smlouva_osoba','predpis_polozka','pohledavka','pohledavka_polozka',
    'parovani','odberne_misto','meridlo','odecet','naklad','prijem_ostatni','vyuctovani',
    'vyuctovani_polozka','dokument','termin','upominka_pravidlo','komunikace','vykaz_vlastnik']
  loop
    execute format('alter table %I add column organizace_id uuid not null default aktualni_organizace()
                    references organizace(id) on delete cascade', t);
    execute format('create index on %I (organizace_id)', t);
  end loop;
end $$;

-- unikátnost v rámci organizace (dva různí správci můžou mít stejný VS)
alter table vlastnik        add unique (organizace_id, zkratka);
alter table bankovni_ucet   add unique (organizace_id, cislo_uctu, kod_banky);
alter table najemni_smlouva add unique (organizace_id, variabilni_symbol);

-- Založení nové organizace: vytvoří ji, udělá z volajícího majitele a nahraje výchozí upomínky
create or replace function zalozit_organizaci(p_nazev text) returns uuid
  language plpgsql security definer set search_path = public as $$
declare org uuid;
begin
  insert into organizace (nazev) values (p_nazev) returning id into org;
  if auth.uid() is not null then
    insert into clenstvi (organizace_id, user_id, role) values (org, auth.uid(), 'majitel');
    insert into profil (user_id, aktivni_organizace_id) values (auth.uid(), org)
      on conflict (user_id) do update set aktivni_organizace_id = excluded.aktivni_organizace_id;
  end if;
  insert into upominka_pravidlo (organizace_id, poradi, dni_od_splatnosti, akce, kanal, sablona) values
   (org, 1, -3, 'zprava', 'preferovany', 'Dobrý den {jmeno}, připomínáme splatnost nájmu {castka} Kč dne {splatnost}, účet {ucet}, VS {vs}. Děkujeme.'),
   (org, 2,  3, 'zprava', 'preferovany', 'Dobrý den {jmeno}, neevidujeme úhradu nájmu {castka} Kč splatného {splatnost}. Prosíme o úhradu na účet {ucet}, VS {vs}.'),
   (org, 3, 10, 'zprava', 'preferovany', 'Dobrý den {jmeno}, stále evidujeme dlužný nájem {castka} Kč (splatnost {splatnost}). Prosíme o okamžitou úhradu, jinak budeme nuceni postupovat dále.'),
   (org, 4, 10, 'clickup_ukol', null, 'Nájemník {jmeno} dluží {castka} Kč – kontaktovat osobně'),
   (org, 5, 30, 'pdf_vyzva', 'email', 'Předžalobní výzva');
  return org;
end $$;

-- =====================================================================
-- 12. POHLEDY (přehledy)
-- =====================================================================

-- Dlužníci: otevřené pohledávky po splatnosti
create view v_dluznici with (security_invoker = true) as
select p.organizace_id, p.id as pohledavka_id, s.id as smlouva_id, s.variabilni_symbol,
       n.nazev as nemovitost, v.nazev as vlastnik,
       string_agg(coalesce(o.prijmeni || ' ' || o.jmeno, o.nazev_firmy), ', ') as najemnik,
       p.obdobi, p.splatnost, p.castka, p.uhrazeno, p.castka - p.uhrazeno as dluh,
       current_date - p.splatnost as dni_po_splatnosti
from pohledavka p
join najemni_smlouva s on s.id = p.smlouva_id
join nemovitost n on n.id = s.nemovitost_id
join vlastnik v on v.id = s.pronajimatel_id
left join najemni_smlouva_osoba so on so.smlouva_id = s.id and so.role in ('najemce','spolunajemce')
left join osoba o on o.id = so.osoba_id
where p.stav in ('otevrena','castecne') and p.splatnost < current_date
group by p.id, s.id, n.nazev, v.nazev;

-- Výnosnost po nemovitostech a letech (provozní; zdanění se dopočítá v aplikaci podle dan_rezim)
create view v_vynosnost with (security_invoker = true) as
with roky as (
  select distinct extract(year from d)::int as rok, nemovitost_id from (
    select p.obdobi as d, s.nemovitost_id from pohledavka p join najemni_smlouva s on s.id = p.smlouva_id where p.obdobi is not null
    union all select datum, nemovitost_id from naklad
    union all select datum, nemovitost_id from prijem_ostatni
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
  select nemovitost_id, extract(year from datum)::int rok, sum(castka) as ostatni_prijmy
  from prijem_ostatni group by 1,2
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

-- Blížící se termíny (vč. platnosti dokumentů a konců smluv)
create view v_terminy with (security_invoker = true) as
select t.organizace_id, 'termin' as zdroj, t.id, t.druh, t.nazev, t.datum, t.nemovitost_id from termin t
  where not t.splneno and t.datum <= current_date + t.upozornit_dni
union all
select d.organizace_id, 'dokument', d.id, d.typ_kod, d.nazev, d.platnost_do, d.nemovitost_id from dokument d
  where d.platnost_do is not null and d.platnost_do <= current_date + 30
union all
select s.organizace_id, 'smlouva', s.id, 'konec_smlouvy', 'Konec nájmu VS ' || s.variabilni_symbol, s.datum_do, s.nemovitost_id
  from najemni_smlouva s where s.stav = 'aktivni' and s.datum_do <= current_date + 90;

-- =====================================================================
-- 13. ZABEZPEČENÍ (Row Level Security) – každý vidí jen svou organizaci
-- =====================================================================

do $$
declare t text;
begin
  foreach t in array array[
    'vlastnik','osoba','nemovitost','vlastnictvi','bankovni_ucet','bankovni_pohyb',
    'najemni_smlouva','najemni_smlouva_osoba','predpis_polozka','pohledavka','pohledavka_polozka',
    'parovani','odberne_misto','meridlo','odecet','naklad','prijem_ostatni','vyuctovani',
    'vyuctovani_polozka','dokument','termin','upominka_pravidlo','komunikace','vykaz_vlastnik']
  loop
    execute format('alter table %I enable row level security', t);
    -- majitel, správce a asistent organizace: plný přístup k datům své organizace
    execute format($p$create policy tym_vse on %I for all
                     using (moje_role(organizace_id) in ('majitel','spravce','asistent'))
                     with check (moje_role(organizace_id) in ('majitel','spravce','asistent'))$p$, t);
  end loop;
end $$;

-- vlastník (klient ve správě): jen čtení vlastních nemovitostí, smluv, nákladů, výkazů a dokumentů
create policy vlastnik_cte on nemovitost for select using (
  moje_role(organizace_id) = 'vlastnik' and exists (
    select 1 from vlastnictvi vl where vl.vlastnik_id = muj_vlastnik(nemovitost.organizace_id)
      and (vl.nemovitost_id = nemovitost.id or vl.nemovitost_id = nemovitost.nadrazena_id)));
create policy vlastnik_cte on najemni_smlouva for select using (
  moje_role(organizace_id) = 'vlastnik' and pronajimatel_id = muj_vlastnik(organizace_id));
create policy vlastnik_cte on naklad for select using (
  moje_role(organizace_id) = 'vlastnik' and exists (select 1 from vlastnictvi vl
    where vl.vlastnik_id = muj_vlastnik(naklad.organizace_id) and vl.nemovitost_id = naklad.nemovitost_id));
create policy vlastnik_cte on vykaz_vlastnik for select using (
  moje_role(organizace_id) = 'vlastnik' and vlastnik_id = muj_vlastnik(organizace_id));
create policy vlastnik_cte on dokument for select using (
  moje_role(organizace_id) = 'vlastnik' and vlastnik_id = muj_vlastnik(organizace_id));

-- číselníky jsou společné pro všechny
alter table typ_nemovitosti enable row level security;
alter table typ_dokumentu   enable row level security;
create policy cist_ciselniky on typ_nemovitosti for select using (auth.uid() is not null);
create policy cist_ciselniky on typ_dokumentu   for select using (auth.uid() is not null);

-- organizace, členství, profil
alter table organizace enable row level security;
alter table clenstvi   enable row level security;
alter table profil     enable row level security;
create policy clen_cte on organizace for select using (moje_role(id) is not null);
create policy majitel_upravuje on organizace for update using (moje_role(id) = 'majitel');
create policy clen_cte on clenstvi for select using (moje_role(organizace_id) is not null);
create policy majitel_spravuje on clenstvi for all
  using (moje_role(organizace_id) = 'majitel') with check (moje_role(organizace_id) = 'majitel');
create policy muj_profil on profil for all using (user_id = auth.uid()) with check (user_id = auth.uid());
