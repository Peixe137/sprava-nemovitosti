-- Vygeneruje měsíční pohledávky (předpisy k úhradě) pro smlouvu od začátku nájmu
-- do zadaného měsíce. Už existující měsíce přeskočí. Běží s právy přihlášeného uživatele (RLS platí).
create or replace function vygenerovat_pohledavky(p_smlouva uuid, p_do date default current_date)
returns integer
language plpgsql security invoker set search_path = public as $$
declare
  s        najemni_smlouva%rowtype;
  mesic    date;
  konec    date;
  splatno  date;
  celkem   numeric(12,2);
  nova_id  uuid;
  pocet    integer := 0;
begin
  select * into s from najemni_smlouva where id = p_smlouva;
  if not found then raise exception 'Smlouva nenalezena'; end if;

  mesic := date_trunc('month', s.datum_od)::date;
  konec := date_trunc('month', least(p_do, coalesce(s.datum_do, p_do)))::date;

  while mesic <= konec loop
    select coalesce(sum(castka), 0) into celkem
      from predpis_polozka
     where smlouva_id = s.id
       and platnost_od <= (mesic + interval '1 month - 1 day')::date
       and (platnost_do is null or platnost_do >= mesic);

    if celkem > 0 then
      splatno := (case when s.splatnost_predem then mesic else (mesic + interval '1 month')::date end)
                 + least(s.den_splatnosti,
                         extract(day from (date_trunc('month', case when s.splatnost_predem then mesic else (mesic + interval '1 month')::date end) + interval '1 month - 1 day'))::int) - 1;

      insert into pohledavka (organizace_id, smlouva_id, druh, obdobi, splatnost, castka)
      values (s.organizace_id, s.id, 'mesicni', mesic, splatno, celkem)
      on conflict (smlouva_id, druh, obdobi) do nothing
      returning id into nova_id;

      if nova_id is not null then
        insert into pohledavka_polozka (organizace_id, pohledavka_id, druh, castka)
        select s.organizace_id, nova_id, druh, sum(castka)
          from predpis_polozka
         where smlouva_id = s.id
           and platnost_od <= (mesic + interval '1 month - 1 day')::date
           and (platnost_do is null or platnost_do >= mesic)
         group by druh;
        pocet := pocet + 1;
      end if;
      nova_id := null;
    end if;

    mesic := (mesic + interval '1 month')::date;
  end loop;

  return pocet;
end $$;

revoke execute on function vygenerovat_pohledavky(uuid, date) from public, anon;
grant  execute on function vygenerovat_pohledavky(uuid, date) to authenticated;

-- Ruční zápis přijaté platby k pohledávce (do napojení Fio): přepočítá uhrazeno a stav
create or replace function zapsat_uhradu(p_pohledavka uuid, p_castka numeric)
returns void
language plpgsql security invoker set search_path = public as $$
begin
  update pohledavka
     set uhrazeno = uhrazeno + p_castka,
         stav = case when uhrazeno + p_castka >= castka then 'uhrazena'
                     when uhrazeno + p_castka > 0 then 'castecne'
                     else 'otevrena' end
   where id = p_pohledavka;
  if not found then raise exception 'Pohledávka nenalezena'; end if;
end $$;

revoke execute on function zapsat_uhradu(uuid, numeric) from public, anon;
grant  execute on function zapsat_uhradu(uuid, numeric) to authenticated;
