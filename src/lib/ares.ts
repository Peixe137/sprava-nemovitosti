import "server-only";

export type AresVysledek = {
  ico: string;
  nazev: string;
  dic: string | null;
  adresa: string | null;
  ulice: string | null;
  obec: string | null;
  psc: string | null;
  pravni_forma: "PO" | "FO";
  platce_dph: boolean;
  zanikl: boolean;
};

// Právní formy fyzických osob podnikajících (číselník ČSÚ): 100–109
const jeFO = (kod: string) => /^10\d$/.test(kod);

export function platneIco(ico: string) {
  if (!/^\d{8}$/.test(ico)) return false;
  const c = ico.split("").map(Number);
  const s = c.slice(0, 7).reduce((a, n, i) => a + n * (8 - i), 0);
  const kontrola = (11 - (s % 11)) % 10;
  return kontrola === c[7];
}

export async function nacistZAres(icoVstup: string): Promise<AresVysledek> {
  const ico = icoVstup.replace(/\s/g, "").padStart(8, "0");
  if (!platneIco(ico)) throw new Error("Neplatné IČO.");
  const res = await fetch(`https://ares.gov.cz/ekonomicke-subjekty-v-be/rest/ekonomicke-subjekty/${ico}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (res.status === 404) throw new Error("Subjekt s tímto IČO v ARES neexistuje.");
  if (!res.ok) throw new Error(`ARES je nedostupný (chyba ${res.status}). Zkuste to za chvíli.`);
  const d = await res.json();
  const s = d.sidlo ?? {};
  const cislo = [s.cisloDomovni, s.cisloOrientacni].filter(Boolean).join("/");
  return {
    ico,
    nazev: d.obchodniJmeno,
    dic: d.dic ?? null,
    adresa: s.textovaAdresa ?? null,
    ulice: [s.nazevUlice ?? s.nazevCastiObce, cislo].filter(Boolean).join(" ") || null,
    obec: s.nazevObce ?? null,
    psc: s.psc ? String(s.psc) : null,
    pravni_forma: jeFO(String(d.pravniForma ?? "")) ? "FO" : "PO",
    platce_dph: d.seznamRegistraci?.stavZdrojeDph === "AKTIVNI",
    zanikl: !!d.datumZaniku,
  };
}
