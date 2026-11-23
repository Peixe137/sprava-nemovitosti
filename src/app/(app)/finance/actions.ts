"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { mojeRole, navrhnoutSmazani, NAVRZENO } from "@/lib/role";

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

  // nový dodavatel zadaný přímo ve formuláři má přednost před výběrem
  let dodavatel = t(f, "dodavatel_id");
  if (t(f, "novy_nazev")) {
    const { data: d, error: ed } = await supabase.from("osoba").insert({
      druh: t(f, "novy_ico") ? "PO" : "FO", nazev_firmy: t(f, "novy_nazev"), ico: t(f, "novy_ico"), adresa: t(f, "novy_adresa"),
      telefon: t(f, "novy_telefon"), email: t(f, "novy_email"), je_dodavatel: true,
      poznamka: t(f, "novy_obor") ? `Obor: ${t(f, "novy_obor")}` : null,
    }).select("id").single();
    if (ed) redirect(`/finance/naklady?chyba=${encodeURIComponent("Dodavatel: " + ed.message)}`);
    dodavatel = d.id;
  }
  const { error } = await supabase.from("naklad").insert({
    nemovitost_id: t(f, "nemovitost_id"), kategorie: t(f, "kategorie"), datum: t(f, "datum"),
    castka_bez_dph: zaklad, dph, dodavatel_id: dodavatel,
    sluzba_vyuctovani: t(f, "sluzba_vyuctovani"), poznamka: t(f, "poznamka"),
  });
  if (error) redirect(`/finance/naklady?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/finance");
  redirect("/finance/naklady?ulozeno=1");
}

export async function smazatNaklad(id: string) {
  const supabase = await supabaseServer();
  if (await mojeRole(supabase) !== "majitel") {
    const { data: x } = await supabase.from("naklad").select("datum, castka_celkem, poznamka").eq("id", id).single();
    const e = await navrhnoutSmazani(supabase, { tabulka: "naklad", id, odkaz: "/finance/naklady",
      popis: `Náklad ${x?.datum ?? ""} ${x?.castka_celkem ?? ""} Kč ${x?.poznamka ?? ""}` });
    redirect(`/finance/naklady?${e ? `chyba=${encodeURIComponent(e)}` : `zprava=${encodeURIComponent(NAVRZENO)}`}`);
  }
  await supabase.from("naklad").delete().eq("id", id);
  revalidatePath("/finance/naklady");
}
