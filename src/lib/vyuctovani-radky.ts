import { SLUZBY } from "@/lib/format";

/** Řádky vyúčtování: služby s vlastním řádkem; ostatní se slučují do „Ostatní služby“. */
export const RADKY: Record<string, string> = {
  voda: SLUZBY.voda, tuv: SLUZBY.tuv, teplo: SLUZBY.teplo, elektrina: SLUZBY.elektrina, plyn: SLUZBY.plyn,
  sluzby: "Ostatní služby (el. spol. prostor, výtah, úklid, osvětlení, odpad…)",
};
