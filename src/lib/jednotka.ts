import "server-only";
import type { supabaseServer } from "@/lib/supabase/server";
type Db = Awaited<ReturnType<typeof supabaseServer>>;

/** LV a trojmístné číslo jednotky pro VS a číslo smlouvy (stejná logika jako SQL navrhnout_vs). */
export async function lvAJednotka(supabase: Db, nemovitostId: string) {
  const { data: n } = await supabase.from("nemovitost")
    .select("nazev, lv, kod_jednotky, nadrazena_id, nadrazena:nadrazena_id(lv, vlastnictvi(vlastnik_id)), vlastnictvi(vlastnik_id)")
    .eq("id", nemovitostId).maybeSingle();
  if (!n) return null;
  const rodic = n.nadrazena as unknown as { lv: string | null; vlastnictvi: { vlastnik_id: string }[] } | null;
  const lv = String(n.lv ?? rodic?.lv ?? "").replace(/\D/g, "") || null;
  const kod = (n.kod_jednotky ?? (n.nadrazena_id ? n.nazev.match(/\d{1,3}/)?.[0] : null) ?? "0").padStart(3, "0");
  const vlastnik = n.vlastnictvi?.[0]?.vlastnik_id ?? rodic?.vlastnictvi?.[0]?.vlastnik_id ?? null;
  return { lv, kod, vlastnik };
}

/** Číslo smlouvy: RRMMDD-LV-JJJ (datum začátku nájmu), např. 261201-1910-001 */
export const cisloSmlouvy = (datumOd: string, lv: string | null, kod: string) =>
  [datumOd.slice(2, 10).replaceAll("-", ""), lv ?? "0", kod].join("-");
