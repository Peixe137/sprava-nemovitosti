"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { lvAJednotka, cisloSmlouvy } from "@/lib/jednotka";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };

export async function pridatSmlouvu(f: FormData) {
  const supabase = await supabaseServer();
  const nemId = t(f, "nemovitost_id") ?? "";
  const chyba = (m: string) => redirect(`/smlouvy/nova?nemovitost=${nemId}&chyba=${encodeURIComponent(m)}`);

  const vs = (t(f, "variabilni_symbol") ?? "").replace(/\s/g, "");
  if (!/^\d{1,10}$/.test(vs)) chyba("Variabilní symbol musí mít 1–10 číslic.");
  const { count: obsazeny } = await supabase.from("najemni_smlouva").select("id", { count: "exact", head: true }).eq("variabilni_symbol", vs);
  if (obsazeny) chyba(`VS ${vs} už má jiná smlouva – platby by se nedaly spárovat. Zvolte jiný.`);
  const polozkyForm = f.getAll("p_druh").map((druh, i) => ({
    druh: String(druh), popis: String(f.getAll("p_popis")[i] ?? "").trim() || null,
    castka: Number(String(f.getAll("p_castka")[i] ?? "").replace(/\s/g, "").replace(",", ".")) || 0,
    perioda: String(f.getAll("p_perioda")[i] ?? "mesicne"),
  })).filter((p) => p.castka > 0);
  if (!polozkyForm.some((p) => p.druh === "najem")) chyba("Chybí položka Nájem s částkou.");

  const { data: osoba, error: e1 } = await supabase.from("osoba").insert({
    druh: t(f, "nazev_firmy") ? "PO" : "FO", jmeno: t(f, "jmeno"), prijmeni: t(f, "prijmeni"), nazev_firmy: t(f, "nazev_firmy"),
    ico: t(f, "ico"), adresa: t(f, "adresa"), email: t(f, "email"), telefon: t(f, "telefon"),
    preferovany_kanal: t(f, "preferovany_kanal") ?? "sms",
  }).select("id").single();
  if (e1) chyba("Nájemník: " + e1.message);

  const datumOd = t(f, "datum_od")!;
  const j = await lvAJednotka(supabase, nemId);
  const { data: s, error: e2 } = await supabase.from("najemni_smlouva").insert({
    nemovitost_id: t(f, "nemovitost_id"), pronajimatel_id: t(f, "pronajimatel_id"),
    cislo_smlouvy: t(f, "cislo_smlouvy") ?? (j ? cisloSmlouvy(datumOd, j.lv, j.kod) : null), variabilni_symbol: vs,
    datum_od: datumOd, datum_do: t(f, "datum_do"), den_splatnosti: n(f, "den_splatnosti") ?? 15,
    kauce_castka: n(f, "kauce_castka") ?? 0, poznamka: t(f, "poznamka"),
  }).select("id").single();
  if (e2) chyba("Smlouva: " + e2.message);

  await supabase.from("najemni_smlouva_osoba").insert({ smlouva_id: s!.id, osoba_id: osoba!.id, role: "najemce" });

  const od = datumOd.slice(0, 8) + "01";
  const polozky = polozkyForm.map((p) => ({ ...p, smlouva_id: s!.id, platnost_od: od }));
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

const zpet = (id: string, chyba?: string) => {
  revalidatePath(`/smlouvy/${id}`);
  redirect(`/smlouvy/${id}${chyba ? `?chyba=${encodeURIComponent(chyba)}` : ""}`);
};

/** Nová položka předpisu (záloha, změna nájmu…) a doplnění plateb. */
export async function pridatPolozku(smlouvaId: string, f: FormData) {
  const supabase = await supabaseServer();
  const od = (t(f, "platnost_od") ?? new Date().toISOString().slice(0, 10)).slice(0, 8) + "01";
  const { error } = await supabase.from("predpis_polozka").insert({
    smlouva_id: smlouvaId, druh: t(f, "druh") ?? "jine", popis: t(f, "popis"), castka: n(f, "castka") ?? 0,
    perioda: t(f, "perioda") ?? "mesicne", platnost_od: od,
  });
  if (error) zpet(smlouvaId, error.message);
  await supabase.rpc("vygenerovat_pohledavky", { p_smlouva: smlouvaId });
  zpet(smlouvaId);
}

/** Ukončí položku k poslednímu dni zvoleného měsíce – už vystavené platby zůstanou. */
export async function ukoncitPolozku(smlouvaId: string, id: string, f: FormData) {
  const supabase = await supabaseServer();
  const m = (t(f, "do") ?? new Date().toISOString().slice(0, 7)).slice(0, 7);
  const [r, mm] = m.split("-").map(Number);
  const posledni = new Date(Date.UTC(r, mm, 0)).toISOString().slice(0, 10);
  const { error } = await supabase.from("predpis_polozka").update({ platnost_do: posledni }).eq("id", id);
  zpet(smlouvaId, error?.message);
}

export async function smazatPolozku(smlouvaId: string, id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("predpis_polozka").delete().eq("id", id);
  zpet(smlouvaId, error?.message);
}

/** Kontaktní osoba u smlouvy (vedoucí pobočky, účetní, správce…). */
export async function pridatKontakt(smlouvaId: string, f: FormData) {
  const supabase = await supabaseServer();
  if (!t(f, "jmeno") && !t(f, "prijmeni")) zpet(smlouvaId, "Vyplňte jméno nebo příjmení kontaktu.");
  const { data: o, error } = await supabase.from("osoba").insert({
    druh: "FO", jmeno: t(f, "jmeno"), prijmeni: t(f, "prijmeni"), email: t(f, "email"), telefon: t(f, "telefon"),
    preferovany_kanal: t(f, "email") ? "email" : "sms",
  }).select("id").single();
  if (error) zpet(smlouvaId, error.message);
  const { error: e2 } = await supabase.from("najemni_smlouva_osoba").insert({
    smlouva_id: smlouvaId, osoba_id: o!.id, role: t(f, "role") ?? "kontakt", funkce: t(f, "funkce"), poznamka: t(f, "poznamka"),
  });
  zpet(smlouvaId, e2?.message);
}

export async function odebratKontakt(smlouvaId: string, osobaId: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("najemni_smlouva_osoba").delete().eq("smlouva_id", smlouvaId).eq("osoba_id", osobaId).neq("role", "najemce");
  zpet(smlouvaId, error?.message);
}
