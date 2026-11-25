"use server";
import { STITKY_DODAVATELE } from "@/lib/format";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { mojeRole, navrhnoutSmazani, NAVRZENO } from "@/lib/role";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };

const udaje = (f: FormData) => {
  const kategorie = Array.from(new Set(f.getAll("kategorie").map((x) => String(x).trim()).filter(Boolean)));
  const druh = t(f, "druh") ?? (t(f, "nazev_firmy") ? "PO" : "FO");
  return {
    druh, jmeno: t(f, "jmeno"), prijmeni: t(f, "prijmeni"), nazev_firmy: t(f, "nazev_firmy"), ico: t(f, "ico"),
    email: t(f, "email"), telefon: t(f, "telefon"), whatsapp: t(f, "whatsapp"), adresa: t(f, "adresa"), web: t(f, "web"),
    funkce: t(f, "funkce"), poznamka: t(f, "poznamka"), kategorie,
    je_dodavatel: kategorie.some((k) => STITKY_DODAVATELE.includes(k)),
  };
};

export async function pridatOsobu(f: FormData) {
  const supabase = await supabaseServer();
  const z = udaje(f);
  if (!z.prijmeni && !z.nazev_firmy) redirect("/osoby?chyba=" + encodeURIComponent("Vyplňte příjmení nebo název firmy."));
  const { data, error } = await supabase.from("osoba").insert(z).select("id").single();
  if (error) redirect("/osoby?chyba=" + encodeURIComponent(error.message));
  revalidatePath("/osoby");
  redirect(`/osoby/${data.id}?zprava=${encodeURIComponent("Kontakt uložen.")}`);
}

export async function upravitOsobu(id: string, f: FormData) {
  const supabase = await supabaseServer();
  const z = udaje(f);
  if (!z.prijmeni && !z.nazev_firmy) redirect(`/osoby/${id}?chyba=` + encodeURIComponent("Vyplňte příjmení nebo název firmy."));
  const { error } = await supabase.from("osoba").update(z).eq("id", id);
  if (error) redirect(`/osoby/${id}?chyba=` + encodeURIComponent(error.message));
  revalidatePath("/", "layout");
  redirect(`/osoby/${id}?zprava=${encodeURIComponent("Uloženo.")}`);
}

/** Kontaktní osoba firmy (vedoucí, účetní, technik…). */
export async function pridatKontaktFirmy(firmaId: string, f: FormData) {
  const supabase = await supabaseServer();
  if (!t(f, "prijmeni") && !t(f, "jmeno")) redirect(`/osoby/${firmaId}?chyba=` + encodeURIComponent("Vyplňte jméno kontaktní osoby."));
  const { error } = await supabase.from("osoba").insert({
    druh: "FO", firma_id: firmaId, jmeno: t(f, "jmeno"), prijmeni: t(f, "prijmeni") ?? t(f, "jmeno"),
    funkce: t(f, "funkce"), telefon: t(f, "telefon"), email: t(f, "email"), poznamka: t(f, "poznamka"),
    preferovany_kanal: t(f, "email") ? "email" : "sms",
  });
  revalidatePath(`/osoby/${firmaId}`);
  redirect(`/osoby/${firmaId}${error ? `?chyba=${encodeURIComponent(error.message)}` : "#kontakty"}`);
}

export async function smazatOsobu(id: string, zpet: string) {
  const supabase = await supabaseServer();
  const { count } = await supabase.from("najemni_smlouva_osoba").select("smlouva_id", { count: "exact", head: true }).eq("osoba_id", id);
  if (count) redirect(`${zpet}?chyba=` + encodeURIComponent("Osoba je u nájemní smlouvy – nejdřív ji odeberte ze smlouvy."));
  if (await mojeRole(supabase) !== "majitel") {
    const { data: o } = await supabase.from("osoba").select("jmeno, prijmeni, nazev_firmy").eq("id", id).single();
    const e = await navrhnoutSmazani(supabase, { tabulka: "osoba", id, odkaz: `/osoby/${id}`,
      popis: `Kontakt ${o?.nazev_firmy ?? `${o?.jmeno ?? ""} ${o?.prijmeni ?? ""}`}` });
    redirect(`${zpet}?${e ? `chyba=${encodeURIComponent(e)}` : `zprava=${encodeURIComponent(NAVRZENO)}`}`);
  }
  const { error } = await supabase.from("osoba").delete().eq("id", id);
  if (error) redirect(`${zpet}?chyba=` + encodeURIComponent(error.message));
  revalidatePath("/osoby");
  redirect(zpet);
}
