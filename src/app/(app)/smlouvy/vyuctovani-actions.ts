"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => Number(String(f.get(k) ?? "0").replace(/\s/g, "").replace(",", ".")) || 0;

/** Uloží vyúčtování (hodnoty z náhledu, případně ručně upravené). Nedoplatek se zapíše jako platba splatná do 30 dnů. */
export async function ulozitVyuctovani(smlouvaId: string, f: FormData) {
  const od = t(f, "od")!, doo = t(f, "do")!;
  const sluzby = f.getAll("sluzba").map(String);
  const polozky = sluzby.map((s) => ({ sluzba: s, klic: t(f, `klic_${s}`) ?? "pevny", naklad: n(f, `naklad_${s}`), zalohy: n(f, `zalohy_${s}`),
    podil: t(f, `podil_${s}`) ? Number(t(f, `podil_${s}`)) : null, poznamka: t(f, `pozn_${s}`) }));
  const naklady = polozky.reduce((a, p) => a + p.naklad, 0), zalohy = polozky.reduce((a, p) => a + p.zalohy, 0);
  const vysledek = Math.round((naklady - zalohy) * 100) / 100;
  const supabase = await supabaseServer();
  const { data: v, error } = await supabase.from("vyuctovani").insert({
    smlouva_id: smlouvaId, obdobi_od: od, obdobi_do: doo, zalohy_celkem: zalohy, naklady_celkem: naklady, vysledek, poznamka: t(f, "poznamka"),
  }).select("id, organizace_id").single();
  if (error) redirect(`/smlouvy/${smlouvaId}/vyuctovani/nove?od=${od}&do=${doo}&chyba=${encodeURIComponent(error.message.includes("unique") ? "Vyúčtování od tohoto data už existuje." : error.message)}`);
  await supabase.from("vyuctovani_polozka").insert(polozky.map((p) => ({ ...p, vyuctovani_id: v!.id })));
  if (vysledek > 0) {
    const splatnost = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
    await supabase.from("pohledavka").insert({ smlouva_id: smlouvaId, druh: "vyuctovani", obdobi: doo, splatnost, castka: vysledek, vyuctovani_id: v!.id });
  }
  revalidatePath(`/smlouvy/${smlouvaId}`);
  redirect(`/smlouvy/${smlouvaId}/vyuctovani/${v!.id}`);
}

export async function oznacitVyuctovani(smlouvaId: string, id: string, stav: "odeslano" | "vyrovnano" | "rozpracovano") {
  const supabase = await supabaseServer();
  await supabase.from("vyuctovani").update({ stav, ...(stav === "odeslano" ? { odeslano_dne: new Date().toISOString().slice(0, 10) } : {}) }).eq("id", id);
  revalidatePath(`/smlouvy/${smlouvaId}/vyuctovani/${id}`);
  redirect(`/smlouvy/${smlouvaId}/vyuctovani/${id}`);
}

export async function smazatVyuctovani(smlouvaId: string, id: string) {
  const supabase = await supabaseServer();
  await supabase.from("pohledavka").delete().eq("vyuctovani_id", id).eq("uhrazeno", 0);
  const { error } = await supabase.from("vyuctovani").delete().eq("id", id);
  revalidatePath(`/smlouvy/${smlouvaId}`);
  redirect(`/smlouvy/${smlouvaId}${error ? `?chyba=${encodeURIComponent(error.message)}` : ""}`);
}
