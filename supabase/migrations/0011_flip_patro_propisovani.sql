-- Fáze FLIP, patro jednotky, propisování údajů z budovy do podnemovitostí (triggery).
alter table nemovitost drop constraint if exists nemovitost_stav_check;
alter table nemovitost add constraint nemovitost_stav_check check (stav in ('v_nakupu','drzeni','flip','v_prodeji'));
alter table nemovitost add column if not exists patro integer check (patro between -5 and 99);

create or replace function propsat_z_nadrazene() returns trigger
language plpgsql security invoker set search_path = public as $$
declare r nemovitost%rowtype;
begin
  if new.nadrazena_id is null then return new; end if;
  select * into r from nemovitost where id = new.nadrazena_id;
  if not found then return new; end if;
  new.katastralni_uzemi := r.katastralni_uzemi; new.ku_kod := r.ku_kod; new.lv := r.lv;
  new.ulice := r.ulice; new.cislo_popisne := r.cislo_popisne; new.cislo_evidencni := r.cislo_evidencni;
  new.obec := r.obec; new.psc := r.psc; new.zem_sirka := r.zem_sirka; new.zem_delka := r.zem_delka;
  new.datum_porizeni := r.datum_porizeni;
  return new;
end $$;
drop trigger if exists nemovitost_propsat on nemovitost;
create trigger nemovitost_propsat before insert or update on nemovitost for each row execute function propsat_z_nadrazene();

create or replace function propsat_do_podrizenych() returns trigger
language plpgsql security invoker set search_path = public as $$
begin
  if (new.katastralni_uzemi, new.ku_kod, new.lv, new.ulice, new.cislo_popisne, new.cislo_evidencni, new.obec, new.psc,
      new.zem_sirka, new.zem_delka, new.datum_porizeni)
     is distinct from
     (old.katastralni_uzemi, old.ku_kod, old.lv, old.ulice, old.cislo_popisne, old.cislo_evidencni, old.obec, old.psc,
      old.zem_sirka, old.zem_delka, old.datum_porizeni) then
    update nemovitost set nadrazena_id = nadrazena_id where nadrazena_id = new.id;
  end if;
  return null;
end $$;
drop trigger if exists nemovitost_propsat_dolu on nemovitost;
create trigger nemovitost_propsat_dolu after update on nemovitost for each row execute function propsat_do_podrizenych();

update nemovitost set nadrazena_id = nadrazena_id where nadrazena_id is not null;
