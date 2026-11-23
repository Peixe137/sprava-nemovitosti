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
    trzni_hodnota: n(f, "trzni_hodnota"),
    zem_sirka: n(f, "zem_sirka"), zem_delka: n(f, "zem_delka"), ruian_adresni_misto: n(f, "ruian_adresni_misto"), ku_kod: n(f, "ku_kod"),
    drive_folder_url: t(f, "drive_folder_url"), poznamka: t(f, "poznamka"),
  }).select("id").single();
  if (error) redirect(`/nemovitosti/nova?chyba=${encodeURIComponent(error.message)}`);

  // katastrální skladba: parcela (a stavba na ní) z formuláře / RÚIAN
  const polozky = [];
  if (t(f, "parcelni_cislo")) polozky.push({
    nemovitost_id: data.id, druh: "parcela", katastralni_uzemi: t(f, "katastralni_uzemi"), ku_kod: n(f, "ku_kod"),
    lv: t(f, "lv"), cislo_parcely: t(f, "parcelni_cislo"), vymera_m2: n(f, "parcela_vymera"), druh_pozemku: t(f, "parcela_druh"),
    ruian_kod: n(f, "parcela_ruian"),
  });
  if (t(f, "cislo_popisne") && ["B", "O"].includes(String(f.get("typ_kod")))) polozky.push({
    nemovitost_id: data.id, druh: "stavba", katastralni_uzemi: t(f, "katastralni_uzemi"), ku_kod: n(f, "ku_kod"),
    lv: t(f, "lv"), cislo_parcely: t(f, "parcelni_cislo"), cislo_popisne: t(f, "cislo_popisne"),
  });
  if (polozky.length) await supabase.from("katastralni_polozka").insert(polozky);

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

export async function pridatKatastralniPolozku(nemovitostId: string, f: FormData) {
  const supabase = await supabaseServer();
  const druh = t(f, "druh") ?? "parcela";
  let doplneno: Record<string, unknown> = {};
  if (druh === "parcela" && f.get("z_ruian") === "on" && t(f, "katastralni_uzemi") && t(f, "cislo_parcely")) {
    try {
      const { parcelaPodleCisla } = await import("@/lib/ruian");
      const p = await parcelaPodleCisla(t(f, "katastralni_uzemi")!, t(f, "cislo_parcely")!);
      doplneno = { vymera_m2: p.vymera, druh_pozemku: p.druh, ruian_kod: p.ruian_kod, ku_kod: p.ku_kod, katastralni_uzemi: p.katastralni_uzemi };
    } catch (e) {
      redirect(`/nemovitosti/${nemovitostId}?chyba=${encodeURIComponent(e instanceof Error ? e.message : "RÚIAN")}#katastr`);
    }
  }
  const { error } = await supabase.from("katastralni_polozka").insert({
    nemovitost_id: nemovitostId, druh, katastralni_uzemi: t(f, "katastralni_uzemi"), lv: t(f, "lv"),
    cislo_parcely: t(f, "cislo_parcely"), vymera_m2: n(f, "vymera_m2"), druh_pozemku: t(f, "druh_pozemku"),
    cislo_popisne: t(f, "cislo_popisne"), cislo_jednotky: t(f, "cislo_jednotky"),
    podil_citatel: n(f, "podil_citatel"), podil_jmenovatel: n(f, "podil_jmenovatel"), poznamka: t(f, "poznamka"),
    ...Object.fromEntries(Object.entries(doplneno).filter(([, v]) => v != null)),
  });
  if (error) redirect(`/nemovitosti/${nemovitostId}?chyba=${encodeURIComponent(error.message)}#katastr`);
  revalidatePath(`/nemovitosti/${nemovitostId}`);
}

export async function smazatKatastralniPolozku(nemovitostId: string, id: string) {
  const supabase = await supabaseServer();
  await supabase.from("katastralni_polozka").delete().eq("id", id);
  revalidatePath(`/nemovitosti/${nemovitostId}`);
}
