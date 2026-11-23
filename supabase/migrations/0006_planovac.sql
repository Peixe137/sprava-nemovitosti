-- Každý den v noci doplní měsíční platby u všech aktivních smluv.
create extension if not exists pg_cron;
select cron.schedule('generovani-plateb', '15 1 * * *', $$ select public.vygenerovat_pohledavky_vsem(); $$);

-- Stahování z Fio (až budou tokeny): každou hodinu zavolá Edge Function fio-sync.
-- create extension if not exists pg_net;
-- select cron.schedule('fio-sync', '7 * * * *', $$
--   select net.http_post(
--     url := 'https://lenaybuxhnbnxaccjlxy.supabase.co/functions/v1/fio-sync',
--     headers := jsonb_build_object('Authorization', 'Bearer ' ||
--       (select decrypted_secret from vault.decrypted_secrets where name = 'fio_sync_secret')));
-- $$);
