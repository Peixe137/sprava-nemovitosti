-- Účel měřidla: hlavní (patní) měřidlo budovy, společné prostory, nebo měřidlo jednotky
alter table meridlo add column if not exists ucel text not null default 'jednotka' check (ucel in ('hlavni','spolecne','jednotka'));
