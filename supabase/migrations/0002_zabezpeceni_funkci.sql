-- Pomocné funkce nesmí volat nepřihlášený uživatel (anon).
-- Přihlášení je potřebují kvůli pravidlům RLS (vrací jen jejich vlastní roli/organizaci).
revoke execute on function public.aktualni_organizace()   from public, anon;
revoke execute on function public.moje_role(uuid)          from public, anon;
revoke execute on function public.muj_vlastnik(uuid)       from public, anon;
grant  execute on function public.aktualni_organizace()   to authenticated;
grant  execute on function public.moje_role(uuid)          to authenticated;
grant  execute on function public.muj_vlastnik(uuid)       to authenticated;

-- Zakládání organizací zatím jen přes administraci (interní provoz).
-- Až se otevře registrace dalších správců, povolí se roli authenticated.
revoke execute on function public.zalozit_organizaci(text) from public, anon, authenticated;
