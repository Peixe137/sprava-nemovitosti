import "server-only";
import type { supabaseServer } from "@/lib/supabase/server";
import { MERIDLA_SLUZBY, SLUZBY, JEDNOTKY_MERIDEL } from "@/lib/format";

type Db = Awaited<ReturnType<typeof supabaseServer>>;
export type RadekVyuctovani = { sluzba: string; nazev: string; naklad: number; zalohy: number; klic: "spotreba" | "plocha" | "pevny"; podil: number | null; poznamka: string };

import { RADKY } from "@/lib/vyuctovani-radky";
export { RADKY };
const RADEK_SLUZBY = (s: string) => (s in RADKY ? s : "sluzby");
const ZALOHA: Record<string, string> = { zaloha_voda: "voda", zaloha_tuv: "tuv", zaloha_teplo: "teplo", zaloha_elektrina: "elektrina", zaloha_plyn: "plyn", zaloha_sluzby: "sluzby" };

const den = (d: string) => Math.round(Date.parse(d + "T12:00:00Z") / 864e5);
const prekryv = (a1: string, b1: string, a2: string, b2: string) => Math.max(0, Math.min(den(b1), den(b2)) - Math.max(den(a1), den(a2)) + 1);
const zaokr = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number) => v.toLocaleString("cs-CZ", { maximumFractionDigits: 2 });

/**
 * Vyúčtování služeb ke smlouvě za období:
 *  – zálohy = předepsané zálohy (položky plateb) za měsíce v období,
 *  – náklady = náklady označené k přeúčtování (u jednotky celé, u budovy podíl),
 *  – podíl budovy: podle spotřeby z měřidel (jednotka + podíl společných prostor podle plochy), jinak podle plochy.
 * Náklad s obdobím se poměrně krátí na dobu nájmu v období.
 */
export async function vypocitatVyuctovani(supabase: Db, smlouvaId: string, od: string, doo: string) {
  const { data: s } = await supabase.from("najemni_smlouva").select("id, nemovitost_id, datum_od, datum_do, nemovitost(id, nazev, plocha_m2, nadrazena_id)").eq("id", smlouvaId).single();
  if (!s) throw new Error("Smlouva nenalezena");
  const jed = s.nemovitost as unknown as { id: string; nazev: string; plocha_m2: number | null; nadrazena_id: string | null };
  const a = s.datum_od > od ? s.datum_od : od;
  const b = s.datum_do && s.datum_do < doo ? s.datum_do : doo;
  if (a > b) throw new Error("Smlouva v tomto období neplatila.");
  const budova = jed.nadrazena_id;

  const [pohl, naklady, sourozenci] = await Promise.all([
    supabase.from("pohledavka").select("obdobi, pohledavka_polozka(druh, castka)").eq("smlouva_id", smlouvaId).eq("druh", "mesicni").gte("obdobi", od.slice(0, 8) + "01").lte("obdobi", doo),
    supabase.from("naklad").select("nemovitost_id, datum, obdobi_od, obdobi_do, castka_celkem, sluzba_vyuctovani, poznamka").not("sluzba_vyuctovani", "is", null)
      .in("nemovitost_id", budova ? [jed.id, budova] : [jed.id]),
    budova ? supabase.from("nemovitost").select("id, plocha_m2, archivovano_dne").eq("nadrazena_id", budova) : Promise.resolve({ data: [] as { id: string; plocha_m2: number | null; archivovano_dne: string | null }[] }),
  ]);

  // zálohy
  const zalohy = new Map<string, number>();
  for (const p of pohl.data ?? []) for (const x of (p.pohledavka_polozka ?? []) as { druh: string; castka: number }[]) {
    const r = ZALOHA[x.druh]; if (r) zalohy.set(r, (zalohy.get(r) ?? 0) + Number(x.castka));
  }

  // měřidla a odečty (jednotka, budova, ostatní jednotky budovy)
  const jednotky = (sourozenci.data ?? []).filter((x) => !x.archivovano_dne);
  const idsMeridel = [jed.id, ...(budova ? [budova, ...jednotky.map((x) => x.id)] : [])];
  const { data: mer } = await supabase.from("meridlo").select("id, nemovitost_id, druh, ucel, jednotka").in("nemovitost_id", [...new Set(idsMeridel)]);
  const meridla = (mer ?? []) as { id: string; nemovitost_id: string; druh: string; ucel: string; jednotka: string | null }[];
  const { data: od_ } = meridla.length ? await supabase.from("odecet").select("meridlo_id, datum, stav").in("meridlo_id", meridla.map((m) => m.id)).order("datum") : { data: [] };
  const odecty = (od_ ?? []) as { meridlo_id: string; datum: string; stav: number }[];
  const spotreba = (mid: string): number | null => {
    const r = odecty.filter((o) => o.meridlo_id === mid);
    const zac = [...r].reverse().find((o) => o.datum <= a) ?? r.find((o) => o.datum >= a);
    const kon = [...r].reverse().find((o) => o.datum <= b);
    return zac && kon && kon.datum > zac.datum ? Number(kon.stav) - Number(zac.stav) : null;
  };
  const soucet = (ms: typeof meridla) => { const v = ms.map((m) => spotreba(m.id)).filter((x): x is number => x != null); return v.length ? v.reduce((p, c) => p + c, 0) : null; };
  const plochaCelkem = jednotky.reduce((p, x) => p + Number(x.plocha_m2 ?? 0), 0);
  const podilPlochy = budova && jed.plocha_m2 && plochaCelkem ? Number(jed.plocha_m2) / plochaCelkem : null;

  /** Podíl jednotky na nákladu budovy pro službu (a vysvětlení). */
  const podilBudovy = (sluzba: string): { podil: number | null; klic: RadekVyuctovani["klic"]; text: string } => {
    const druhy = MERIDLA_SLUZBY[sluzba];
    if (druhy) {
      const sDruh = (m: (typeof meridla)[number]) => druhy.includes(m.druh);
      const j = soucet(meridla.filter((m) => m.nemovitost_id === jed.id && sDruh(m)));
      const hlavni = soucet(meridla.filter((m) => m.nemovitost_id === budova && m.ucel === "hlavni" && sDruh(m)));
      let spol = soucet(meridla.filter((m) => m.nemovitost_id === budova && m.ucel === "spolecne" && sDruh(m)));
      const vsechnyJ = soucet(meridla.filter((m) => m.nemovitost_id !== budova && m.ucel === "jednotka" && sDruh(m)));
      if (spol == null && hlavni != null && vsechnyJ != null) spol = Math.max(0, hlavni - vsechnyJ);
      const celkem = hlavni ?? (vsechnyJ != null ? vsechnyJ + (spol ?? 0) : null);
      if (j != null && celkem) {
        const spolJ = (spol ?? 0) * (podilPlochy ?? 0);
        const u = MERIDLA_SLUZBY[sluzba].map((d) => JEDNOTKY_MERIDEL[d])[0];
        return { podil: (j + spolJ) / celkem, klic: "spotreba",
          text: `spotřeba jednotky ${fmt(j)} ${u}${spol ? ` + společné prostory ${fmt(spol)} ${u} × ${fmt((podilPlochy ?? 0) * 100)} % plochy` : ""} z celkem ${fmt(celkem)} ${u}` };
      }
    }
    if (podilPlochy != null) return { podil: podilPlochy, klic: "plocha", text: `podle plochy ${fmt(Number(jed.plocha_m2))} m² z ${fmt(plochaCelkem)} m²` };
    return { podil: null, klic: "plocha", text: "chybí plocha jednotek i odečty – doplňte ručně" };
  };

  const radky = new Map<string, RadekVyuctovani>();
  const radek = (k: string) => radky.get(k) ?? (radky.set(k, { sluzba: k, nazev: RADKY[k], naklad: 0, zalohy: 0, klic: "pevny", podil: null, poznamka: "" }), radky.get(k)!);
  for (const [k, v] of zalohy) radek(k).zalohy = zaokr(v);
  const poznamky = new Map<string, string[]>();
  for (const n of (naklady.data ?? []) as { nemovitost_id: string; datum: string; obdobi_od: string | null; obdobi_do: string | null; castka_celkem: number; sluzba_vyuctovani: string; poznamka: string | null }[]) {
    const z = n.obdobi_od ?? n.datum, k = n.obdobi_do ?? n.datum;
    const dny = prekryv(z, k, a, b);
    if (!dny) continue;
    const cast = Number(n.castka_celkem) * dny / (den(k) - den(z) + 1);
    const r = radek(RADEK_SLUZBY(n.sluzba_vyuctovani));
    if (n.nemovitost_id === jed.id || !budova) {
      r.naklad += cast; r.klic = r.klic === "pevny" ? "pevny" : r.klic;
      poznamky.set(r.sluzba, [...(poznamky.get(r.sluzba) ?? []), `${SLUZBY[n.sluzba_vyuctovani]}: přímo jednotky ${fmt(cast)} Kč`]);
    } else {
      const p = podilBudovy(n.sluzba_vyuctovani);
      r.naklad += cast * (p.podil ?? 0); r.klic = p.klic; r.podil = p.podil;
      poznamky.set(r.sluzba, [...(poznamky.get(r.sluzba) ?? []), `${SLUZBY[n.sluzba_vyuctovani]}: budova ${fmt(cast)} Kč × ${p.podil != null ? fmt(p.podil * 100) + " %" : "?"} (${p.text})`]);
    }
  }
  for (const r of radky.values()) { r.naklad = zaokr(r.naklad); r.poznamka = [...new Set(poznamky.get(r.sluzba) ?? [])].join("; "); }
  const poradi = Object.keys(RADKY);
  return { od: a, do: b, jednotka: jed, radky: [...radky.values()].sort((x, y) => poradi.indexOf(x.sluzba) - poradi.indexOf(y.sluzba)) };
}
