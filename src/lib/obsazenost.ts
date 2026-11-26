/** Pronajato = existuje aktivní smlouva, která dnes platí. Nikdy se nevyplňuje ručně. */
export type SmlouvaObdobi = { nemovitost_id: string; datum_od: string; datum_do: string | null; stav: string };
export function pronajateIds(smlouvy: SmlouvaObdobi[], dnes = new Date().toISOString().slice(0, 10)) {
  return new Set(smlouvy.filter((s) => s.stav === "aktivni" && s.datum_od <= dnes && (!s.datum_do || s.datum_do >= dnes)).map((s) => s.nemovitost_id));
}

/** Nemovitosti, které dnes volné jsou, ale mají už podepsanou smlouvu od budoucího data → nejbližší datum začátku. */
export function budouciNajem(smlouvy: SmlouvaObdobi[], dnes = new Date().toISOString().slice(0, 10)) {
  const m = new Map<string, string>();
  for (const s of smlouvy) {
    if (s.stav !== "aktivni" || s.datum_od <= dnes) continue;
    const d = m.get(s.nemovitost_id);
    if (!d || s.datum_od < d) m.set(s.nemovitost_id, s.datum_od);
  }
  return m;
}
