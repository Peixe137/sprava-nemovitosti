-- Import bankovních výpisů (GPC/ABO, SEPA XML camt.053): ruční spárování pohybu se smlouvou.
-- sparovat_pohyb(pohyb, smlouva): bez smlouvy hledá podle VS (auto), se smlouvou páruje ručně.
create or replace function sparovat_pohyb(p_pohyb uuid, p_smlouva uuid)
returns text
language plpgsql set search_path = public as $$
declare
  p      bankovni_pohyb%rowtype;
  s_id   uuid := p_smlouva;
  zbyva  numeric(14,2);
  r      record;
  dil    numeric(14,2);
begin
  select * into p from bankovni_pohyb where id = p_pohyb;
  if not found then return 'nenalezeno'; end if;
  if p.castka <= 0 then return 'vydaj'; end if;

  if s_id is null then
    if coalesce(p.vs, '') = '' then return 'bez_vs'; end if;
    select id into s_id from najemni_smlouva
     where organizace_id = p.organizace_id
       and ltrim(variabilni_symbol, '0') = ltrim(p.vs, '0')
     order by (stav = 'aktivni') desc, datum_od desc
     limit 1;
    if s_id is null then return 'nezname_vs'; end if;
  end if;

  zbyva := p.castka - coalesce((select sum(castka) from parovani where pohyb_id = p.id), 0);

  for r in
    select id, castka - uhrazeno as dluh from pohledavka
     where smlouva_id = s_id and stav in ('otevrena', 'castecne')
     order by splatnost, obdobi
  loop
    exit when zbyva <= 0;
    dil := least(zbyva, r.dluh);
    continue when dil <= 0;
    insert into parovani (organizace_id, pohyb_id, pohledavka_id, castka, zpusob, vytvoril)
    values (p.organizace_id, p.id, r.id, dil, case when p_smlouva is null then 'auto' else 'rucni' end, auth.uid())
    on conflict (pohyb_id, pohledavka_id) do update set castka = parovani.castka + excluded.castka;
    update pohledavka
       set uhrazeno = uhrazeno + dil,
           stav = case when uhrazeno + dil >= castka then 'uhrazena' else 'castecne' end
     where id = r.id;
    zbyva := zbyva - dil;
  end loop;

  update bankovni_pohyb
     set stav_parovani = case when zbyva <= 0 then 'sparovano' else 'castecne' end
   where id = p.id;

  return case when zbyva > 0 then 'preplatek ' || zbyva else 'sparovano' end;
end $$;

create or replace function sparovat_pohyb(p_pohyb uuid)
returns text language sql set search_path = public as $$ select sparovat_pohyb(p_pohyb, null::uuid) $$;

revoke execute on function sparovat_pohyb(uuid, uuid) from public, anon;
grant  execute on function sparovat_pohyb(uuid, uuid) to authenticated, service_role;
