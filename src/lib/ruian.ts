import "server-only";

// Veřejná vyhledávací služba ČÚZK nad daty RÚIAN (zdarma, bez registrace)
const ZAKLAD = "https://ags.cuzk.cz/arcgis/rest/services/RUIAN/MapServer";

export const DRUH_POZEMKU: Record<number, string> = {
  2: "orná půda", 3: "chmelnice", 4: "vinice", 5: "zahrada", 6: "ovocný sad", 7: "trvalý travní porost",
  10: "lesní pozemek", 11: "vodní plocha", 13: "zastavěná plocha a nádvoří", 14: "ostatní plocha",
};

async function dotaz(cesta: string, parametry: Record<string, string | number>) {
  const url = `${ZAKLAD}/${cesta}?${new URLSearchParams({ ...Object.fromEntries(Object.entries(parametry).map(([k, v]) => [k, String(v)])), f: "json" })}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`RÚIAN je nedostupný (chyba ${res.status}).`);
  const json = await res.json();
  if (json.error) throw new Error(`RÚIAN: ${json.error.message ?? "chyba dotazu"}`);
  return json;
}

const bod = (x: number, y: number) => ({
  geometry: `${x},${y}`, geometryType: "esriGeometryPoint", inSR: 4326, spatialRel: "esriSpatialRelIntersects",
  returnGeometry: "false",
});

export type NalezenaAdresa = { adresa: string; x: number; y: number };

export async function hledatAdresu(text: string): Promise<NalezenaAdresa[]> {
  if (text.trim().length < 3) return [];
  const j = await dotaz("exts/GeocodeSOE/findAddressCandidates", { SingleLine: text, maxLocations: 8, outSR: 4326 });
  return (j.candidates ?? [])
    .filter((c: { attributes?: { Type?: string } }) => c.attributes?.Type === "AdresniMisto")
    .map((c: { address: string; location: { x: number; y: number } }) => ({ adresa: c.address, x: c.location.x, y: c.location.y }));
}

async function nazevKu(kod: number) {
  const j = await dotaz("7/query", { where: `kod=${Number(kod)}`, outFields: "kod,nazev", returnGeometry: "false" });
  return (j.features?.[0]?.attributes?.nazev as string) ?? null;
}

export type DetailMista = {
  adresa: string; ulice: string | null; cislo_popisne: string | null; cislo_orientacni: string | null;
  obec: string | null; psc: string | null; ruian_adresni_misto: number | null;
  katastralni_uzemi: string | null; ku_kod: number | null;
  parcela: { cislo: string; vymera: number | null; druh: string | null; ruian_kod: number | null } | null;
  zem_sirka: number; zem_delka: number;
};

export async function detailMista(x: number, y: number): Promise<DetailMista> {
  const [am, pa] = await Promise.all([
    dotaz("1/query", { ...bod(x, y), distance: 5, units: "esriSRUnit_Meter", outFields: "kod,cislodomovni,cisloorientacni,cisloorientacnipismeno,psc,adresa" }),
    dotaz("5/query", { ...bod(x, y), outFields: "id,cisloparcely,kmenovecislo,poddelenicisla,druhcislovanikod,vymeraparcely,druhpozemkukod,katastralniuzemi" }),
  ]);
  const a = am.features?.[0]?.attributes ?? {};
  const p = pa.features?.[0]?.attributes;
  const kuKod: number | null = p?.katastralniuzemi ?? null;
  const adresa: string = a.adresa ?? "";
  // "Kubelíkova 733/60, Žižkov, 13000 Praha 3"
  const casti = adresa.split(",").map((s) => s.trim());
  const prvni = casti[0] ?? "";
  const ulice = /^\D+\s\d/.test(prvni) && !/^č\.\s?(p|ev)\./i.test(prvni) ? prvni.replace(/\s[\d/a-zA-Z]+$/, "") : null;
  const posledni = casti[casti.length - 1] ?? "";
  const obec = posledni.match(/^\d{3}\s?\d{2}\s+(.+)$/)?.[1] ?? null;
  return {
    adresa,
    ulice,
    cislo_popisne: a.cislodomovni != null ? String(a.cislodomovni) : null,
    cislo_orientacni: a.cisloorientacni != null ? `${a.cisloorientacni}${a.cisloorientacnipismeno ?? ""}` : null,
    obec,
    psc: a.psc != null ? String(a.psc) : null,
    ruian_adresni_misto: a.kod ?? null,
    katastralni_uzemi: kuKod ? await nazevKu(kuKod) : null,
    ku_kod: kuKod,
    parcela: p ? { cislo: zapisParcely(p), vymera: p.vymeraparcely ?? null, druh: DRUH_POZEMKU[p.druhpozemkukod] ?? null, ruian_kod: p.id ?? null } : null,
    zem_sirka: y, zem_delka: x,
  };
}

/** Číslo parcely: „1435/1“ (pozemková) nebo „st. 3522“, „st.3522/2“ (stavební). Vrací null, když formát nesedí. */
export function rozebratParcelu(text: string): { stavebni: boolean; kmen: number; pod: number | null; zapis: string } | null {
  const m = text.trim().match(/^(st\.?|stav\.?|stavební)?\s*(\d{1,6})(?:\s*\/\s*(\d{1,4}))?$/i);
  if (!m) return null;
  const stavebni = !!m[1], kmen = Number(m[2]), pod = m[3] ? Number(m[3]) : null;
  return { stavebni, kmen, pod, zapis: `${stavebni ? "st. " : ""}${kmen}${pod ? `/${pod}` : ""}` };
}
const zapisParcely = (a: { kmenovecislo?: number; poddelenicisla?: number | null; druhcislovanikod?: number; cisloparcely?: string }) =>
  a.kmenovecislo ? `${a.druhcislovanikod === 1 ? "st. " : ""}${a.kmenovecislo}${a.poddelenicisla ? `/${a.poddelenicisla}` : ""}` : (a.cisloparcely ?? "");

// Dohledání parcely podle katastrálního území (název) a čísla parcely, např. "Žižkov" + "1435/1" nebo "st. 3522"
export async function parcelaPodleCisla(kuNazev: string, cislo: string) {
  const esc = (s: string) => s.replace(/'/g, "''");
  const c = rozebratParcelu(cislo);
  if (!c) throw new Error(`Číslo parcely „${cislo}“ nemá správný tvar – zadejte např. 1435/1, nebo u stavební parcely st. 3522.`);
  const ku = await dotaz("7/query", { where: `nazev='${esc(kuNazev.trim())}'`, outFields: "kod,nazev,obec", returnGeometry: "false" });
  const uzemi = (ku.features ?? []).map((f: { attributes: { kod: number; nazev: string } }) => f.attributes);
  if (uzemi.length === 0) throw new Error(`Katastrální území „${kuNazev}“ nenalezeno.`);
  const kody = uzemi.map((u: { kod: number }) => Number(u.kod)).join(",");
  const pa = await dotaz("5/query", {
    where: `katastralniuzemi in (${kody}) and kmenovecislo=${c.kmen} and ${c.pod ? `poddelenicisla=${c.pod}` : "poddelenicisla is null"} and druhcislovanikod=${c.stavebni ? 1 : 2}`,
    outFields: "id,cisloparcely,kmenovecislo,poddelenicisla,druhcislovanikod,vymeraparcely,druhpozemkukod,katastralniuzemi", returnGeometry: "false",
  });
  const f = pa.features ?? [];
  if (f.length === 0) throw new Error(`${c.stavebni ? "Stavební parcela" : "Parcela"} ${c.zapis} v k.ú. ${kuNazev} nenalezena.${c.stavebni ? "" : " Jde-li o stavební parcelu, napište „st. " + c.kmen + (c.pod ? "/" + c.pod : "") + "“."}`);
  if (f.length > 1) throw new Error(`Katastrální území „${kuNazev}“ existuje vícekrát – parcelu zadejte ručně.`);
  const p = f[0].attributes;
  return { cislo: zapisParcely(p), vymera: (p.vymeraparcely as number) ?? null, druh: DRUH_POZEMKU[p.druhpozemkukod] ?? null,
    ruian_kod: (p.id as number) ?? null, ku_kod: p.katastralniuzemi as number, katastralni_uzemi: uzemi[0].nazev as string };
}
