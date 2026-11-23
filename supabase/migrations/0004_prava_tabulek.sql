-- Přihlášení uživatelé smí s tabulkami pracovat; KTERÉ řádky uvidí, hlídá RLS.
-- Nepřihlášení (anon) nemají přístup k ničemu.
grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
revoke all on all tables in schema public from anon;
-- číselníky jen ke čtení
revoke insert, update, delete on typ_nemovitosti, typ_dokumentu from authenticated;
-- totéž pro tabulky založené v budoucnu
alter default privileges in schema public grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema public revoke all on tables from anon;
