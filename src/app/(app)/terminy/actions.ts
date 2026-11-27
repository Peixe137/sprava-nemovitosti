"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { mojeRole } from "@/lib/role";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const zpet = (chyba?: string, zprava?: string): never => {
  revalidatePath("/terminy"); revalidatePath("/");
  redirect(`/terminy${chyba ? `?chyba=${encodeURIComponent(chyba)}` : zprava ? `?zprava=${encodeURIComponent(zprava)}` : ""}`);
};
const udaje = (f: FormData) => ({
  nazev: t(f, "nazev"), druh: t(f, "druh") ?? "ukol", priorita: t(f, "priorita") ?? "dulezite", datum: t(f, "datum"),
  nemovitost_id: t(f, "nemovitost"), opakovani: t(f, "opakovani") ?? "zadne",
  upozornit_dni: Number(t(f, "upozornit_dni") ?? 14), popis: t(f, "popis"),
});

export async function pridatTermin(f: FormData) {
  const d = udaje(f);
  if (!d.nazev || !d.datum) zpet("Vyplňte název a datum.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("termin").insert(d).select("id").single();
  if (error) zpet(error.message);
  revalidatePath("/terminy"); revalidatePath("/");
  redirect(`/terminy?uprav=${data!.id}&zprava=${encodeURIComponent("Přidáno. Fotky nebo dokumenty můžete přiložit níže.")}`);
}

export async function upravitTermin(id: string, f: FormData) {
  const d = udaje(f);
  if (!d.nazev || !d.datum) zpet("Vyplňte název a datum.");
  const supabase = await supabaseServer();
  const { error } = await supabase.from("termin").update(d).eq("id", id);
  zpet(error?.message, "Uloženo.");
}

const posun = (datum: string, opakovani: string) => {
  const mesicu = { mesicne: 1, rocne: 12, dvouletne: 24, petilete: 60 }[opakovani] ?? 0;
  const d = new Date(datum + "T12:00:00Z"); d.setUTCMonth(d.getUTCMonth() + mesicu); return d.toISOString().slice(0, 10);
};

/** Splněno; u opakovaného termínu (revize každý rok…) se rovnou založí další. */
export async function splnitTermin(id: string) {
  const supabase = await supabaseServer();
  const { data: x } = await supabase.from("termin").select("*").eq("id", id).single();
  if (!x) zpet("Termín nenalezen.");
  const { error } = await supabase.from("termin").update({ splneno: true, splneno_dne: new Date().toISOString().slice(0, 10) }).eq("id", id);
  if (error) zpet(error.message);
  if (x.opakovani && x.opakovani !== "zadne") {
    const { id: _, splneno: __, splneno_dne: ___, vytvoreno: ____, ...zbytek } = x;
    void _; void __; void ___; void ____;
    await supabase.from("termin").insert({ ...zbytek, datum: posun(x.datum, x.opakovani), splneno: false });
    zpet(undefined, `Splněno. Další termín založen na ${posun(x.datum, x.opakovani).split("-").reverse().join(". ")}.`);
  }
  zpet(undefined, "Splněno.");
}

export async function znovuOtevrit(id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("termin").update({ splneno: false, splneno_dne: null }).eq("id", id);
  zpet(error?.message);
}

export async function smazatTermin(id: string) {
  const supabase = await supabaseServer();
  if (!["majitel", "spravce"].includes(await mojeRole(supabase) ?? "")) zpet("Mazat může správce nebo administrátor.");
  const { error } = await supabase.from("termin").delete().eq("id", id);
  zpet(error?.message, "Smazáno.");
}
