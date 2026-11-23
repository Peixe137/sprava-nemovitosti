"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };

export async function pridatNaklad(f: FormData) {
  const supabase = await supabaseServer();
  const sDph = f.get("s_dph") === "on";
  const castka = n(f, "castka") ?? 0;
  const sazba = n(f, "sazba_dph") ?? 0;
  // částka se zadává tak, jak je na faktuře; podle přepínače se rozpočítá na základ a DPH
  const zaklad = sDph && sazba > 0 ? Math.round((castka / (1 + sazba / 100)) * 100) / 100 : castka;
  const dph = Math.round((castka - zaklad) * 100) / 100;

  const { error } = await supabase.from("naklad").insert({
    nemovitost_id: t(f, "nemovitost_id"), kategorie: t(f, "kategorie"), datum: t(f, "datum"),
    castka_bez_dph: zaklad, dph, dodavatel_id: t(f, "dodavatel_id"),
    sluzba_vyuctovani: t(f, "sluzba_vyuctovani"), poznamka: t(f, "poznamka"),
  });
  if (error) redirect(`/finance/naklady?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/finance");
  redirect("/finance/naklady?ulozeno=1");
}

export async function smazatNaklad(id: string) {
  const supabase = await supabaseServer();
  await supabase.from("naklad").delete().eq("id", id);
  revalidatePath("/finance/naklady");
}
