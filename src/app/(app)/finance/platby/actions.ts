"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { dekodovat, nactiVypis, stejnyUcet, type Vypis } from "@/lib/vypisy";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const zpet = (k: "chyba" | "zprava", text: string): never => redirect(`/finance/platby?${k}=${encodeURIComponent(text)}`);

/** Nahrání výpisu (GPC / SEPA XML): uloží nové pohyby a příchozí platby spáruje podle VS. Opakované nahrání nic nezdvojí. */
export async function nahratVypis(f: FormData) {
  const supabase = await supabaseServer();
  const soubory = f.getAll("soubor").filter((x): x is File => x instanceof File && x.size > 0);
  if (!soubory.length) zpet("chyba", "Vyberte soubor s výpisem.");

  const vypisy: { nazev: string; v: Vypis }[] = [];
  for (const s of soubory) {
    if (s.size > 4_000_000) zpet("chyba", `${s.name}: soubor je větší než 4 MB.`);
    try { vypisy.push({ nazev: s.name, v: nactiVypis(dekodovat(await s.arrayBuffer()), s.name) }); }
    catch (e) { zpet("chyba", e instanceof Error ? e.message : `${s.name}: soubor se nepodařilo přečíst.`); }
  }

  const { data: ucty } = await supabase.from("bankovni_ucet").select("id, nazev, cislo_uctu, kod_banky");
  let celkem = 0, nove = 0, sparovano = 0, nesparovano = 0;
  const pouziteUcty = new Set<string>();

  for (const { nazev, v } of vypisy) {
    // účet: vybraný ve formuláři → podle čísla ve výpisu → nový
    let ucetId = t(f, "ucet_id");
    if (!ucetId && v.ucet) ucetId = (ucty ?? []).find((u) => stejnyUcet(u.cislo_uctu, v.ucet) && (!v.kodBanky || u.kod_banky === v.kodBanky))?.id ?? null;
    if (!ucetId) {
      const cislo = t(f, "novy_cislo") ?? v.ucet;
      const kod = t(f, "novy_banka") ?? v.kodBanky;
      if (!t(f, "novy_nazev") || !t(f, "novy_vlastnik") || !cislo || !kod) {
        zpet("chyba", `${nazev}: účet ${v.ucet ?? "z výpisu"} zatím v aplikaci není. Vyberte účet, nebo vyplňte „Nový účet“ (název, vlastník, banka).`);
      }
      const { data: u, error } = await supabase.from("bankovni_ucet").insert({
        nazev: t(f, "novy_nazev"), vlastnik_id: t(f, "novy_vlastnik"), cislo_uctu: cislo, kod_banky: kod, banka: "IMPORT",
      }).select("id").single();
      if (error) zpet("chyba", `Nový účet: ${error.message}`);
      ucetId = u!.id as string;
      (ucty ?? []).push({ id: ucetId, nazev: t(f, "novy_nazev")!, cislo_uctu: cislo!, kod_banky: kod! });
    }
    pouziteUcty.add(ucetId);
    celkem += v.pohyby.length;
    if (!v.pohyby.length) continue;

    const { data: vlozene, error } = await supabase.from("bankovni_pohyb").upsert(
      v.pohyby.map((p) => ({
        ucet_id: ucetId, banka_pohyb_id: p.id, datum: p.datum, castka: p.castka, mena: p.mena,
        vs: p.vs, ks: p.ks, ss: p.ss, protiucet: p.protiucet, protiucet_banka: p.protiucet_banka,
        protiucet_nazev: p.protiucet_nazev, zprava: p.zprava, typ: p.typ,
        surova_data: { zdroj: v.format, soubor: nazev },
      })),
      { onConflict: "ucet_id,banka_pohyb_id", ignoreDuplicates: true },
    ).select("id, castka");
    if (error) zpet("chyba", `${nazev}: ${error.message}`);
    nove += vlozene?.length ?? 0;
    for (const p of vlozene ?? []) {
      if (Number(p.castka) <= 0) continue;
      const { data: stav } = await supabase.rpc("sparovat_pohyb", { p_pohyb: p.id });
      if (String(stav ?? "").startsWith("sparovano") || String(stav ?? "").startsWith("preplatek")) sparovano++; else nesparovano++;
    }
  }
  if (pouziteUcty.size) await supabase.from("bankovni_ucet").update({ posledni_sync: new Date().toISOString() }).in("id", [...pouziteUcty]);

  revalidatePath("/finance", "layout");
  zpet("zprava", `Výpis načten: ${celkem} pohybů, z toho ${nove} nových`
    + (nove < celkem ? ` (${celkem - nove} už bylo nahráno dřív)` : "")
    + `. Příchozí platby: spárováno ${sparovano}, k ručnímu přiřazení ${nesparovano}.`);
}

/** Ruční přiřazení příchozí platby ke smlouvě (platba bez VS nebo s neznámým VS). */
export async function priraditPohyb(pohybId: string, f: FormData) {
  const smlouva = t(f, "smlouva_id");
  if (!smlouva) zpet("chyba", "Vyberte smlouvu.");
  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("sparovat_pohyb", { p_pohyb: pohybId, p_smlouva: smlouva });
  if (error) zpet("chyba", error.message);
  revalidatePath("/finance", "layout");
  const s = String(data ?? "");
  zpet("zprava", s.startsWith("preplatek") ? `Přiřazeno. Platba pokryla všechny otevřené předpisy, přeplatek ${s.split(" ")[1]} Kč.` : "Platba přiřazena ke smlouvě.");
}

/** Platba, která se nájmů netýká (převod mezi účty, vrácení…): už se nenabízí k přiřazení. */
export async function ignorovatPohyb(pohybId: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("bankovni_pohyb").update({ stav_parovani: "ignorovat" }).eq("id", pohybId);
  if (error) zpet("chyba", error.message);
  revalidatePath("/finance/platby");
  zpet("zprava", "Platba označena jako netýkající se nájmů.");
}
