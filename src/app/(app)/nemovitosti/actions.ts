"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };

export async function pridatNemovitost(f: FormData) {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.from("nemovitost").insert({
    typ_kod: t(f, "typ_kod"), nazev: t(f, "nazev"), nadrazena_id: t(f, "nadrazena_id"), stav: t(f, "stav") ?? "drzeni",
    katastralni_uzemi: t(f, "katastralni_uzemi"), lv: t(f, "lv"), parcelni_cislo: t(f, "parcelni_cislo"),
    cislo_popisne: t(f, "cislo_popisne"), ulice: t(f, "ulice"), obec: t(f, "obec"), psc: t(f, "psc"),
    plocha_m2: n(f, "plocha_m2"), porizovaci_cena: n(f, "porizovaci_cena"), datum_porizeni: t(f, "datum_porizeni"),
    trzni_hodnota: n(f, "trzni_hodnota"), drive_folder_url: t(f, "drive_folder_url"), poznamka: t(f, "poznamka"),
  }).select("id").single();
  if (error) redirect(`/nemovitosti/nova?chyba=${encodeURIComponent(error.message)}`);

  const vlastnik = t(f, "vlastnik_id");
  if (vlastnik) {
    const { error: e2 } = await supabase.from("vlastnictvi").insert({
      nemovitost_id: data.id, vlastnik_id: vlastnik,
      podil_citatel: n(f, "podil_citatel") ?? 1, podil_jmenovatel: n(f, "podil_jmenovatel") ?? 1,
    });
    if (e2) redirect(`/nemovitosti/${data.id}?chyba=${encodeURIComponent("Nemovitost uložena, ale vlastnictví ne: " + e2.message)}`);
  }
  revalidatePath("/nemovitosti");
  redirect(`/nemovitosti/${data.id}`);
}
