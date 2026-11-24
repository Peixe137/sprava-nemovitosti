// Návrh firemní zkratky ze jména: 3 velká písmena (bez @ – zavináč se přidává při zobrazení).
// Jedno slovo → první 3 znaky; dvě a více slov → první 2 znaky prvního + první znak druhého slova.
// Právní formy (s.r.o., a.s., spol. …) a diakritika se ignorují.
const FORMY = /\b(s\.?\s?r\.?\s?o\.?|spol\.?|a\.?\s?s\.?|v\.?\s?o\.?\s?s\.?|k\.?\s?s\.?|z\.?\s?s\.?|z\.?\s?ú\.?|o\.?\s?p\.?\s?s\.?|se|s\.?\s?p\.?)(?=\s|$|,)/gi;

export function navrhZkratky(nazev: string): string {
  const slova = nazev
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(FORMY, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/).filter(Boolean);
  if (!slova.length) return "";
  const z = slova.length === 1 ? slova[0].slice(0, 3) : slova[0].slice(0, 2) + slova[1].slice(0, 1);
  return z.toUpperCase();
}
