-- Přepočet plateb smlouvy podle aktuálního předpisu (např. po změně nájmu z měsíčního na čtvrtletní).
-- Zaplacené částky se zachovají: bankovní platby se znovu spárují, ručně zapsané úhrady se rozdělí od nejstarší platby.
create or replace function prepocitat_pohledavky(p_smlouva uuid)
returns text
language plpgsql security invoker set search_path = public as $$
declare
  rucne   numeric(14,2);
  pohyb   uuid;
  r       record;
  dil     numeric(14,2);
  pocet   integer;
begin
  if exists (select 1 from pohledavka where smlouva_id = p_smlouva and druh = 'mesicni' and stav = 'prominuta') then
    raise exception 'Smlouva má prominuté platby – přepočet by je zrušil. Upravte je ručně.';
  end if;

  select coalesce(sum(p.uhrazeno), 0) - coalesce((select sum(pa.castka) from parovani pa join pohledavka x on x.id = pa.pohledavka_id
                                                  where x.smlouva_id = p_smlouva and x.druh = 'mesicni'), 0)
    into rucne
    from pohledavka p where p.smlouva_id = p_smlouva and p.druh = 'mesicni';

  create temp table if not exists _pohyby (id uuid) on commit drop;
  truncate _pohyby;
  insert into _pohyby select distinct pa.pohyb_id from parovani pa join pohledavka x on x.id = pa.pohledavka_id
   where x.smlouva_id = p_smlouva and x.druh = 'mesicni';

  delete from pohledavka where smlouva_id = p_smlouva and druh = 'mesicni';
  pocet := vygenerovat_pohledavky(p_smlouva);

  -- bankovní platby znovu spárovat
  for pohyb in select id from _pohyby loop
    update bankovni_pohyb set stav_parovani = 'nesparovano' where id = pohyb;
    perform sparovat_pohyb(pohyb);
  end loop;

  -- ručně zapsané úhrady rozdělit od nejstarší
  for r in select id, castka - uhrazeno as dluh from pohledavka
            where smlouva_id = p_smlouva and druh = 'mesicni' and stav in ('otevrena','castecne') order by splatnost, obdobi loop
    exit when rucne <= 0;
    dil := least(rucne, r.dluh);
    update pohledavka set uhrazeno = uhrazeno + dil,
           stav = case when uhrazeno + dil >= castka then 'uhrazena' else 'castecne' end
     where id = r.id;
    rucne := rucne - dil;
  end loop;

  -- co zbude, se nezahodí: zapíše se jako přeplatek k poslední platbě (oprava 0013b)
  if rucne > 0 then
    update pohledavka set uhrazeno = uhrazeno + rucne, stav = 'preplatek'
     where id = (select id from pohledavka where smlouva_id = p_smlouva and druh = 'mesicni' order by obdobi desc limit 1);
  end if;

  return pocet || ' plateb' || case when rucne > 0 then ', přeplatek ' || rucne || ' Kč' else '' end;
end $$;
revoke execute on function prepocitat_pohledavky(uuid) from public, anon;
grant execute on function prepocitat_pohledavky(uuid) to authenticated;
