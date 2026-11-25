-- Adresář: kategorie → volné štítky (libovolný text, víc najednou). Původní klíče převedeny na čitelné názvy.
alter table osoba drop constraint if exists osoba_kategorie_check;

update osoba set kategorie = array(
  select case k
    when 'remeslnik' then 'Řemeslník' when 'dodavatel_energie' then 'Dodavatel energií'
    when 'dodavatel_sluzeb' then 'Dodavatel služeb' when 'pravnik' then 'Právník / advokát'
    when 'ucetni' then 'Účetní' when 'urad' then 'Úřad' when 'banka' then 'Banka'
    when 'pojistovna' then 'Pojišťovna' when 'realitni' then 'Realitní' when 'jine' then 'Ostatní'
    else k end
  from unnest(kategorie) k
) where kategorie <> '{}';

-- štítky bez prázdných hodnot a bez duplicit řeší aplikace; tady jen pojistka proti prázdnému textu
alter table osoba add constraint osoba_kategorie_neprazdne check (array_position(kategorie, '') is null);
