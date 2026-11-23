"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };

export async function pridatSmlouvu(f: FormData) {
  const supabase = await supabaseServer();
  const chyba = (m: string) => redirect(`/smlouvy/nova?chyba=${encodeURIComponent(m)}`);

  const { data: osoba, error: e1 } = await supabase.from("osoba").insert({
    druh: t(f, "nazev_firmy") ? "PO" : "FO", jmeno: t(f, "jmeno"), prijmeni: t(f, "prijmeni"), nazev_firmy: t(f, "nazev_firmy"),
    ico: t(f, "ico"), adresa: t(f, "adresa"), email: t(f, "email"), telefon: t(f, "telefon"),
    preferovany_kanal: t(f, "preferovany_kanal") ?? "sms",
  }).select("id").single();
  if (e1) chyba("Nájemník: " + e1.message);

  const datumOd = t(f, "datum_od")!;
  const { data: s, error: e2 } = await supabase.from("najemni_smlouva").insert({
    nemovitost_id: t(f, "nemovitost_id"), pronajimatel_id: t(f, "pronajimatel_id"),
    cislo_smlouvy: t(f, "cislo_smlouvy"), variabilni_symbol: t(f, "variabilni_symbol"),
    datum_od: datumOd, datum_do: t(f, "datum_do"), den_splatnosti: n(f, "den_splatnosti") ?? 15,
    kauce_castka: n(f, "kauce_castka") ?? 0, poznamka: t(f, "poznamka"),
  }).select("id").single();
  if (e2) chyba("Smlouva: " + e2.message);

  await supabase.from("najemni_smlouva_osoba").insert({ smlouva_id: s!.id, osoba_id: osoba!.id, role: "najemce" });

  const od = datumOd.slice(0, 8) + "01";
  const polozky = [
    ["najem", n(f, "najem")], ["zaloha_voda", n(f, "zaloha_voda")], ["zaloha_teplo", n(f, "zaloha_teplo")],
    ["zaloha_elektrina", n(f, "zaloha_elektrina")], ["zaloha_sluzby", n(f, "zaloha_sluzby")],
  ].filter(([, c]) => c && Number(c) > 0)
    .map(([druh, castka]) => ({ smlouva_id: s!.id, druh, castka, platnost_od: od }));
  if (polozky.length) {
    const { error: e3 } = await supabase.from("predpis_polozka").insert(polozky);
    if (e3) redirect(`/smlouvy/${s!.id}?chyba=${encodeURIComponent("Předpis: " + e3.message)}`);
  }
  await supabase.rpc("vygenerovat_pohledavky", { p_smlouva: s!.id });
  revalidatePath("/smlouvy");
  redirect(`/smlouvy/${s!.id}`);
}

export async function doplnitPredpisy(smlouvaId: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.rpc("vygenerovat_pohledavky", { p_smlouva: smlouvaId });
  if (error) redirect(`/smlouvy/${smlouvaId}?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath(`/smlouvy/${smlouvaId}`);
}

export async function zaplaceno(smlouvaId: string, pohledavkaId: string, zbyva: number, f: FormData) {
  const supabase = await supabaseServer();
  const castka = n(f, "castka") ?? zbyva;
  const { error } = await supabase.rpc("zapsat_uhradu", { p_pohledavka: pohledavkaId, p_castka: castka });
  if (error) redirect(`/smlouvy/${smlouvaId}?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath(`/smlouvy/${smlouvaId}`);
}
