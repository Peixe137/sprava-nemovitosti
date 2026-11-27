-- služba „elektřina“ (podružné elektroměry jednotek) vedle elektřiny společných prostor
alter table naklad drop constraint if exists naklad_sluzba_vyuctovani_check;
alter table naklad add constraint naklad_sluzba_vyuctovani_check check (sluzba_vyuctovani in ('voda','teplo','tuv','elektrina','elektrina_spol','plyn','vytah','uklid','osvetleni','odpad','ostatni'));
