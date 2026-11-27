-- 28. 11. 2026: přílohy (fotky, dokumenty), předávací protokoly, odečty, cejchy v termínech, vyúčtování služeb

-- 1) Přílohy k čemukoli (úkol, odečet, protokol, nemovitost…); soubory v Supabase Storage, bucket „prilohy“ (soukromý)
create table if not exists priloha (
  id            uuid primary key default gen_random_uuid(),
  organizace_id uuid not null default aktualni_organizace() references organizace(id) on delete cascade,
  tabulka       text not null,
  zaznam_id     uuid not null,
  cesta         text not null,      -- <organizace_id>/<tabulka>/<zaznam_id>/<soubor>
  nazev         text not null,
  typ           text,
  velikost      bigint,
  vytvoril      uuid default auth.uid(),
  vytvoreno     timestamptz not null default now()
);
create index if not exists priloha_zaznam on priloha (tabulka, zaznam_id);
alter table priloha enable row level security;

insert into storage.buckets (id, name, public, file_size_limit)
values ('prilohy', 'prilohy', false, 26214400)
on conflict (id) do nothing;

drop policy if exists "prilohy cte" on storage.objects;
drop policy if exists "prilohy nahrava" on storage.objects;
drop policy if exists "prilohy maze" on storage.objects;
create policy "prilohy cte" on storage.objects for select to authenticated
  using (bucket_id = 'prilohy' and moje_role(((storage.foldername(name))[1])::uuid) in ('majitel','spravce','ucetni','host','udrzbar'));
create policy "prilohy nahrava" on storage.objects for insert to authenticated
  with check (bucket_id = 'prilohy' and moje_role(((storage.foldername(name))[1])::uuid) in ('majitel','spravce','ucetni','udrzbar'));
create policy "prilohy maze" on storage.objects for delete to authenticated
  using (bucket_id = 'prilohy' and moje_role(((storage.foldername(name))[1])::uuid) in ('majitel','spravce'));

-- 2) Předávací protokol (převzetí / předání bytu) – stavy měřidel jsou odečty s odkazem na protokol
create table if not exists predavaci_protokol (
  id            uuid primary key default gen_random_uuid(),
  organizace_id uuid not null default aktualni_organizace() references organizace(id) on delete cascade,
  smlouva_id    uuid not null references najemni_smlouva(id) on delete cascade,
  druh          text not null check (druh in ('prevzeti','predani')),
  datum         date not null default current_date,
  klice         text,
  stav_popis    text,
  zavady        text,
  poznamka      text,
  vytvoreno     timestamptz not null default now()
);
alter table predavaci_protokol enable row level security;

alter table odecet add column if not exists protokol_id uuid references predavaci_protokol(id) on delete set null;
alter table odecet add column if not exists poznamka text;
alter table odecet add column if not exists vytvoreno timestamptz not null default now();
alter table meridlo add column if not exists poznamka text;
alter table odberne_misto add column if not exists poznamka text;

-- 3) Vyúčtování služeb: popis a podíl u položky
alter table vyuctovani_polozka add column if not exists podil numeric(9,6);
alter table vyuctovani_polozka add column if not exists poznamka text;
alter table vyuctovani add column if not exists poznamka text;
alter table vyuctovani add column if not exists vytvoreno timestamptz not null default now();

-- RLS nových tabulek (stejně jako ostatní: čte tým, zapisuje správce/účetní, údržbář přílohy a protokoly)
do $$
declare t text;
begin
  foreach t in array array['priloha','predavaci_protokol'] loop
    execute format($p$create policy tym_cte on %I for select using (moje_role(organizace_id) in ('majitel','spravce','ucetni','host','udrzbar'))$p$, t);
    execute format($p$create policy tym_zakladat on %I for insert with check (moje_role(organizace_id) in ('majitel','spravce','ucetni','udrzbar'))$p$, t);
    execute format($p$create policy tym_upravit on %I for update using (moje_role(organizace_id) in ('majitel','spravce','ucetni','udrzbar')) with check (moje_role(organizace_id) in ('majitel','spravce','ucetni','udrzbar'))$p$, t);
    execute format($p$create policy tym_mazat on %I for delete using (moje_role(organizace_id) in ('majitel','spravce'))$p$, t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
    execute format('drop trigger if exists zapsat_log on %I', t);
    execute format('create trigger zapsat_log after insert or update or delete on %I for each row execute function zapsat_log()', t);
  end loop;
  -- odečty zapisuje i údržbář
  drop policy if exists tym_zakladat on odecet;
  drop policy if exists tym_upravit on odecet;
  create policy tym_zakladat on odecet for insert with check (moje_role(organizace_id) in ('majitel','spravce','ucetni','udrzbar'));
  create policy tym_upravit on odecet for update using (moje_role(organizace_id) in ('majitel','spravce','ucetni','udrzbar')) with check (moje_role(organizace_id) in ('majitel','spravce','ucetni','udrzbar'));
end $$;

-- 4) Konec cejchu měřidla do 60 dnů patří mezi blížící se termíny
create or replace view v_terminy with (security_invoker = true) as
 select t.organizace_id, 'termin'::text as zdroj, t.id, t.druh, t.nazev, t.datum, t.nemovitost_id
   from termin t
  where not t.splneno and t.datum <= current_date + t.upozornit_dni
union all
 select d.organizace_id, 'dokument'::text, d.id, d.typ_kod, d.nazev, d.platnost_do, d.nemovitost_id
   from dokument d
  where d.platnost_do is not null and d.platnost_do <= current_date + 30
union all
 select s.organizace_id, 'smlouva'::text, s.id, 'konec_smlouvy'::text, 'Konec nájmu VS ' || s.variabilni_symbol, s.datum_do, s.nemovitost_id
   from najemni_smlouva s
  where s.stav = 'aktivni' and s.datum_do <= current_date + 90
union all
 select m.organizace_id, 'meridlo'::text, m.id, 'cejch_meridla'::text,
        'Cejch: ' || case m.druh when 'voda_studena' then 'vodoměr SV' when 'voda_tepla' then 'vodoměr TV' when 'elektrina' then 'elektroměr'
                                  when 'plyn' then 'plynoměr' when 'teplo' then 'měřič tepla' else 'rozúčtovač' end
          || coalesce(' ' || m.vyrobni_cislo, '') || ' – ' || n.nazev,
        m.cejch_do, m.nemovitost_id
   from meridlo m join nemovitost n on n.id = m.nemovitost_id
  where m.aktivni and m.cejch_do is not null and m.cejch_do <= current_date + 60;
