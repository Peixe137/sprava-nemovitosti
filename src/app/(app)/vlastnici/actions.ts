"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { mojeRole, navrhnoutSmazani, NAVRZENO } from "@/lib/role";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };

const udaje = (f: FormData) => ({
  druh: t(f, "druh") ?? "vlastni_firma", nazev: t(f, "nazev"), zkratka: t(f, "zkratka")?.replace(/^@/, "").toUpperCase() ?? null,
  pravni_forma: t(f, "pravni_forma") ?? "PO", ico: t(f, "ico"), dic: t(f, "dic"), adresa: t(f, "adresa"),
  platce_dph: f.get("platce_dph") === "on", email: t(f, "email"), telefon: t(f, "telefon"), poznamka: t(f, "poznamka"),
});

export async function pridatVlastnika(f: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("vlastnik").insert(udaje(f));
  if (error) redirect(`/vlastnici?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/vlastnici");
  redirect("/vlastnici");
}

export async function upravitVlastnika(id: string, f: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("vlastnik").update({
    ...udaje(f), odmena_typ: t(f, "odmena_typ"), odmena_hodnota: n(f, "odmena_hodnota"), dan_rezim: t(f, "dan_rezim"),
  }).eq("id", id);
  if (error) redirect(`/vlastnici/${id}?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(`/vlastnici?zprava=${encodeURIComponent("Vlastník uložen.")}`);
}

export async function smazatVlastnika(id: string, f: FormData) {
  if (f.get("potvrzeni") !== "on") redirect(`/vlastnici/${id}`);
  const supabase = await supabaseServer();
  const [{ count: nem }, { count: sml }] = await Promise.all([
    supabase.from("vlastnictvi").select("id", { count: "exact", head: true }).eq("vlastnik_id", id),
    supabase.from("najemni_smlouva").select("id", { count: "exact", head: true }).eq("pronajimatel_id", id),
  ]);
  if (nem || sml) redirect(`/vlastnici/${id}?chyba=${encodeURIComponent(`Nelze smazat: vlastní ${nem ?? 0} nemovitostí a pronajímá v ${sml ?? 0} smlouvách. Nejdřív u nich změňte vlastníka.`)}`);
  if (await mojeRole(supabase) !== "majitel") {
    const { data: v } = await supabase.from("vlastnik").select("nazev").eq("id", id).single();
    const e = await navrhnoutSmazani(supabase, { tabulka: "vlastnik", id, popis: `Vlastník ${v?.nazev ?? ""}`, odkaz: `/vlastnici/${id}` });
    redirect(`/vlastnici/${id}?${e ? `chyba=${encodeURIComponent(e)}` : `zprava=${encodeURIComponent(NAVRZENO)}`}`);
  }
  const { error } = await supabase.from("vlastnik").delete().eq("id", id);
  if (error) redirect(`/vlastnici/${id}?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/vlastnici");
  redirect("/vlastnici");
}
