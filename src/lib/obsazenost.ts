/** Pronajato = existuje aktivní smlouva, která dnes platí. Nikdy se nevyplňuje ručně. */
export type SmlouvaObdobi = { nemovitost_id: string; datum_od: string; datum_do: string | null; stav: string };
export function pronajateIds(smlouvy: SmlouvaObdobi[], dnes = new Date().toISOString().slice(0, 10)) {
  return new Set(smlouvy.filter((s) => s.stav === "aktivni" && s.datum_od <= dnes && (!s.datum_do || s.datum_do >= dnes)).map((s) => s.nemovitost_id));
}
