-- Archivace nemovitostí (prodej, konec správy) – záznam zůstává kvůli historii plateb a nákladů
alter table nemovitost
  add column if not exists archivovano_dne date,
  add column if not exists duvod_archivace text
    check (duvod_archivace in ('prodano','konec_spravy','zbourano','jine'));
create index if not exists nemovitost_archiv on nemovitost (organizace_id) where archivovano_dne is null;
