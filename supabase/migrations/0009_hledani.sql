-- Rychlé hledání napříč databází (bez ohledu na diakritiku a velikost písmen). Běží s právy volajícího → RLS platí.
create extension if not exists unaccent with schema extensions;

create or replace function public.bez_diakritiky(t text) returns text
  language sql immutable parallel safe set search_path = '' as
$$ select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(t, ''))) $$;

create or replace function public.hledat(q text, p_limit int default 8)
returns table (druh text, id uuid, titulek text, popis text, odkaz text)
language sql stable security invoker set search_path = public as
$$
with h as (select '%' || bez_diakritiky(trim(q)) || '%' as v)
(select 'nemovitost', n.id, n.nazev,
        concat_ws(' · ', nullif(concat_ws(' ', n.ulice, n.cislo_popisne), ''), n.obec, 'LV ' || n.lv,
                  case when n.archivovano_dne is not null then 'archiv' end),
        '/nemovitosti/' || n.id
   from nemovitost n, h
  where bez_diakritiky(concat_ws(' ', n.nazev, n.ulice, n.cislo_popisne, n.cislo_evidencni, n.obec, n.psc,
                                 n.katastralni_uzemi, n.lv, n.parcelni_cislo, n.poznamka)) like h.v
  order by n.archivovano_dne nulls first, n.nazev limit p_limit)
union all
(select 'katastr', k.nemovitost_id,
        case k.druh when 'parcela' then 'parc. ' || k.cislo_parcely when 'stavba' then 'stavba č.p. ' || coalesce(k.cislo_popisne, '?')
             else 'jednotka ' || coalesce(k.cislo_jednotky, '?') end,
        concat_ws(' · ', n.nazev, 'k.ú. ' || k.katastralni_uzemi, 'LV ' || k.lv),
        '/nemovitosti/' || k.nemovitost_id || '#katastr'
   from katastralni_polozka k join nemovitost n on n.id = k.nemovitost_id, h
  where bez_diakritiky(concat_ws(' ', k.cislo_parcely, k.cislo_popisne, k.cislo_jednotky, k.lv, k.katastralni_uzemi, k.poznamka)) like h.v
  limit p_limit)
union all
(select 'vlastnik', v.id, v.nazev, concat_ws(' · ', '@' || v.zkratka, 'IČO ' || v.ico, v.email, v.telefon), '/vlastnici'
   from vlastnik v, h
  where bez_diakritiky(concat_ws(' ', v.nazev, v.zkratka, v.ico, v.dic, v.adresa, v.email, v.telefon, v.poznamka)) like h.v
  limit p_limit)
union all
(select 'osoba', o.id, coalesce(nullif(concat_ws(' ', o.jmeno, o.prijmeni), ''), o.nazev_firmy),
        concat_ws(' · ', o.telefon, o.email, (select string_agg(n.nazev, ', ') from najemni_smlouva_osoba so
          join najemni_smlouva s on s.id = so.smlouva_id join nemovitost n on n.id = s.nemovitost_id where so.osoba_id = o.id)),
        coalesce((select '/smlouvy/' || so.smlouva_id from najemni_smlouva_osoba so
          join najemni_smlouva s on s.id = so.smlouva_id where so.osoba_id = o.id order by s.datum_od desc limit 1), '/smlouvy')
   from osoba o, h
  where bez_diakritiky(concat_ws(' ', o.jmeno, o.prijmeni, o.nazev_firmy, o.ico, o.email, o.telefon, o.whatsapp, o.adresa, o.poznamka)) like h.v
  limit p_limit)
union all
(select 'smlouva', s.id, concat_ws(' ', 'Smlouva', s.cislo_smlouvy, 'VS ' || s.variabilni_symbol),
        concat_ws(' · ', n.nazev, s.stav), '/smlouvy/' || s.id
   from najemni_smlouva s join nemovitost n on n.id = s.nemovitost_id, h
  where bez_diakritiky(concat_ws(' ', s.cislo_smlouvy, s.variabilni_symbol, s.poznamka)) like h.v
  limit p_limit)
union all
(select 'platba', p.id, concat_ws(' · ', to_char(p.datum, 'DD.MM.YYYY'), p.castka::text || ' ' || p.mena),
        concat_ws(' · ', p.protiucet_nazev, 'VS ' || p.vs, p.zprava), '/finance/platby'
   from bankovni_pohyb p, h
  where bez_diakritiky(concat_ws(' ', p.protiucet_nazev, p.protiucet, p.vs, p.ss, p.ks, p.zprava)) like h.v
  order by p.datum desc limit p_limit)
union all
(select 'naklad', x.id, concat_ws(' · ', to_char(x.datum, 'DD.MM.YYYY'), x.kategorie, x.castka_celkem::text || ' Kč'),
        concat_ws(' · ', n.nazev, x.poznamka), '/finance/naklady'
   from naklad x left join nemovitost n on n.id = x.nemovitost_id, h
  where bez_diakritiky(concat_ws(' ', x.kategorie, x.poznamka, x.sluzba_vyuctovani)) like h.v
  order by x.datum desc limit p_limit)
union all
(select 'dokument', d.id, d.nazev, concat_ws(' · ', d.typ_kod, to_char(d.datum_dokumentu, 'DD.MM.YYYY')),
        coalesce(d.drive_url, '/nemovitosti/' || d.nemovitost_id)
   from dokument d, h
  where bez_diakritiky(concat_ws(' ', d.nazev, d.typ_kod, d.poznamka)) like h.v
  limit p_limit)
$$;

revoke execute on function public.hledat(text, int) from public, anon;
grant execute on function public.hledat(text, int) to authenticated;
grant execute on function public.bez_diakritiky(text) to authenticated;
