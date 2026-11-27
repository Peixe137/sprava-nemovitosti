"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };
const zpet = (kam: string, chyba?: string): never => { revalidatePath(kam.split("?")[0].split("#")[0]); redirect(chyba ? `${kam.split("#")[0]}${kam.includes("?") ? "&" : "?"}chyba=${encodeURIComponent(chyba)}#energie` : kam); };

export async function pridatOdberneMisto(nemovitostId: string, f: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("odberne_misto").insert({
    nemovitost_id: nemovitostId, komodita: t(f, "komodita") ?? "elektrina", ean_eic: t(f, "ean_eic"), dodavatel_id: t(f, "dodavatel_id"),
    zaloha_mesicne: n(f, "zaloha_mesicne"), na_koho: t(f, "na_koho") ?? "vlastnik", platnost_od: t(f, "platnost_od"), poznamka: t(f, "poznamka"),
  });
  zpet(`/nemovitosti/${nemovitostId}#energie`, error?.message);
}

export async function ukoncitOdberneMisto(nemovitostId: string, id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("odberne_misto").update({ platnost_do: new Date().toISOString().slice(0, 10) }).eq("id", id);
  zpet(`/nemovitosti/${nemovitostId}#energie`, error?.message);
}

export async function pridatMeridlo(nemovitostId: string, f: FormData) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("meridlo").insert({
    nemovitost_id: nemovitostId, druh: t(f, "druh") ?? "voda_studena", ucel: t(f, "ucel") ?? "jednotka", vyrobni_cislo: t(f, "vyrobni_cislo"),
    umisteni: t(f, "umisteni"), jednotka: t(f, "jednotka"), cejch_do: t(f, "cejch_do"), odberne_misto_id: t(f, "odberne_misto_id"), poznamka: t(f, "poznamka"), aktivni: true,
  }).select("id").single();
  if (error) zpet(`/nemovitosti/${nemovitostId}#energie`, error.message);
  // počáteční stav rovnou jako první odečet
  if (n(f, "stav") != null) await supabase.from("odecet").insert({ meridlo_id: data!.id, datum: t(f, "datum_stavu") ?? new Date().toISOString().slice(0, 10), stav: n(f, "stav"), druh: "pocatecni" });
  zpet(`/nemovitosti/${nemovitostId}#energie`);
}

export async function upravitMeridlo(id: string, zpetNa: string, f: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("meridlo").update({
    druh: t(f, "druh"), ucel: t(f, "ucel") ?? "jednotka", vyrobni_cislo: t(f, "vyrobni_cislo"), umisteni: t(f, "umisteni"), jednotka: t(f, "jednotka"),
    cejch_do: t(f, "cejch_do"), poznamka: t(f, "poznamka"), aktivni: f.get("aktivni") === "on",
  }).eq("id", id);
  zpet(zpetNa, error?.message);
}

/** Zápis odečtu – vrací id (fotky nahrává formulář hned potom). */
export async function zapsatOdecet(meridloId: string, f: FormData): Promise<{ id?: string; chyba?: string }> {
  const stav = n(f, "stav");
  if (stav == null || Number.isNaN(stav)) return { chyba: "Zadejte stav měřidla." };
  const supabase = await supabaseServer();
  const { data: posledni } = await supabase.from("odecet").select("stav, datum").eq("meridlo_id", meridloId).lte("datum", t(f, "datum") ?? "9999").order("datum", { ascending: false }).limit(1).maybeSingle();
  const druh = t(f, "druh") ?? "pravidelny";
  if (posledni && druh !== "vymena" && stav < Number(posledni.stav) && f.get("potvrdit") !== "1")
    return { chyba: `Stav je nižší než minulý odečet (${posledni.stav} z ${posledni.datum}). Jde-li o výměnu měřidla, zvolte druh „Výměna“.` };
  const { data, error } = await supabase.from("odecet").insert({
    meridlo_id: meridloId, datum: t(f, "datum") ?? new Date().toISOString().slice(0, 10), stav, druh, poznamka: t(f, "poznamka"),
  }).select("id").single();
  if (error) return { chyba: error.message };
  revalidatePath("/nemovitosti", "layout"); revalidatePath(`/meridla/${meridloId}`); revalidatePath("/odecty");
  return { id: data.id };
}

export async function smazatOdecet(meridloId: string, id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("odecet").delete().eq("id", id);
  zpet(`/meridla/${meridloId}`, error?.message);
}

/** Hromadný zápis: pole stav_<meridlo_id>; prázdná se přeskočí. */
export async function hromadneOdecty(f: FormData) {
  const datum = t(f, "datum") ?? new Date().toISOString().slice(0, 10);
  const druh = t(f, "druh") ?? "pravidelny";
  const zaznamy = [...f.keys()].filter((k) => k.startsWith("stav_")).map((k) => ({ meridlo_id: k.slice(5), stav: n(f, k) }))
    .filter((z) => z.stav != null && !Number.isNaN(z.stav)).map((z) => ({ ...z, datum, druh }));
  const zpetNa = `/odecty${t(f, "nemovitost") ? `?nemovitost=${t(f, "nemovitost")}` : ""}`;
  if (!zaznamy.length) zpet(zpetNa, "Nezadali jste žádný stav.");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("odecet").insert(zaznamy);
  if (error) zpet(zpetNa, error.message);
  revalidatePath("/odecty");
  redirect(`${zpetNa}${zpetNa.includes("?") ? "&" : "?"}zprava=${encodeURIComponent(`Uloženo ${zaznamy.length} odečtů k ${datum.split("-").reverse().join(". ")}.`)}`);
}
