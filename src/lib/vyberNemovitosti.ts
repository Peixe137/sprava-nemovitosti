import "server-only";
import type { supabaseServer } from "@/lib/supabase/server";
type Db = Awaited<ReturnType<typeof supabaseServer>>;
export type Moznost = { id: string; nazev: string; popis: string | null };

type Radek = { id: string; nazev: string; ulice: string | null; cislo_popisne: string | null; obec: string | null; lv: string | null;
  vyuziti: string | null; nadrazena: { nazev: string } | null };

/** Nemovitosti pro vyhledávací výběr: název + adresa, LV a budova, aby šly najít i podle ulice nebo LV. */
export async function moznostiNemovitosti(supabase: Db, o: { jenBudovy?: boolean; vcetneArchivu?: boolean } = {}): Promise<(Moznost & { vyuziti: string | null })[]> {
  let q = supabase.from("nemovitost").select("id, nazev, ulice, cislo_popisne, obec, lv, vyuziti, nadrazena:nadrazena_id(nazev)").order("nazev");
  if (!o.vcetneArchivu) q = q.is("archivovano_dne", null);
  if (o.jenBudovy) q = q.is("nadrazena_id", null);
  const { data } = await q;
  return ((data ?? []) as unknown as Radek[]).map((n) => ({
    id: n.id, nazev: n.nazev, vyuziti: n.vyuziti,
    popis: [n.nadrazena ? `v ${n.nadrazena.nazev}` : null, [n.ulice, n.cislo_popisne].filter(Boolean).join(" ") || null, n.obec, n.lv ? `LV ${n.lv}` : null]
      .filter(Boolean).join(" · ") || null,
  }));
}
