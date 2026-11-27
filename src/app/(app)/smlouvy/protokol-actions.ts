"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };

/** Předávací protokol: uloží protokol a stavy měřidel jako počáteční (převzetí) nebo konečné (předání) odečty. */
export async function ulozitProtokol(smlouvaId: string, f: FormData) {
  const druh = t(f, "druh") === "predani" ? "predani" : "prevzeti";
  const datum = t(f, "datum") ?? new Date().toISOString().slice(0, 10);
  const supabase = await supabaseServer();
  const { data: p, error } = await supabase.from("predavaci_protokol").insert({
    smlouva_id: smlouvaId, druh, datum, klice: t(f, "klice"), stav_popis: t(f, "stav_popis"), zavady: t(f, "zavady"), poznamka: t(f, "poznamka"),
  }).select("id").single();
  if (error) redirect(`/smlouvy/${smlouvaId}/protokol/novy?druh=${druh}&chyba=${encodeURIComponent(error.message)}`);
  const odecty = [...f.keys()].filter((k) => k.startsWith("stav_")).map((k) => ({ meridlo_id: k.slice(5), stav: Number(String(f.get(k)).replace(/\s/g, "").replace(",", ".")), raw: String(f.get(k)).trim() }))
    .filter((o) => o.raw !== "" && !Number.isNaN(o.stav))
    .map(({ meridlo_id, stav }) => ({ meridlo_id, stav, datum, druh: druh === "prevzeti" ? "pocatecni" : "konecny", protokol_id: p!.id }));
  if (odecty.length) {
    const { error: e2 } = await supabase.from("odecet").insert(odecty);
    if (e2) redirect(`/smlouvy/${smlouvaId}/protokol/${p!.id}?chyba=${encodeURIComponent("Protokol uložen, odečty ne: " + e2.message)}`);
  }
  revalidatePath(`/smlouvy/${smlouvaId}`);
  redirect(`/smlouvy/${smlouvaId}/protokol/${p!.id}`);
}

export async function upravitProtokol(smlouvaId: string, id: string, f: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("predavaci_protokol").update({
    klice: t(f, "klice"), stav_popis: t(f, "stav_popis"), zavady: t(f, "zavady"), poznamka: t(f, "poznamka"),
  }).eq("id", id);
  revalidatePath(`/smlouvy/${smlouvaId}/protokol/${id}`);
  redirect(`/smlouvy/${smlouvaId}/protokol/${id}${error ? `?chyba=${encodeURIComponent(error.message)}` : ""}`);
}
