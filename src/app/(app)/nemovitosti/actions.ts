"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { mojeRole, navrhnoutSmazani, NAVRZENO } from "@/lib/role";
import { rozebratParcelu } from "@/lib/ruian";

const parcela = (f: FormData) => { const v = String(f.get("parcelni_cislo") ?? "").trim(); return v === "" ? null : rozebratParcelu(v)?.zapis ?? v; };
const spatnaParcela = (f: FormData) => { const v = String(f.get("parcelni_cislo") ?? "").trim(); return v !== "" && !rozebratParcelu(v) ? `Číslo parcely „${v}“ nemá správný tvar – zadejte např. 1435/1, nebo u stavební parcely st. 3522. Nic se neuložilo.` : null; };

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };

// pole společná pro založení i úpravu
function udaje(f: FormData) {
  return {
    typ_kod: t(f, "typ_kod"), nazev: t(f, "nazev"), nadrazena_id: t(f, "nadrazena_id"), stav: t(f, "stav") ?? "drzeni", vyuziti: t(f, "vyuziti") ?? "pronajem", upozorneni: t(f, "upozorneni"), kod_jednotky: t(f, "kod_jednotky"), patro: n(f, "patro"),
    katastralni_uzemi: t(f, "katastralni_uzemi"), lv: t(f, "lv"), parcelni_cislo: parcela(f),
    cislo_popisne: t(f, "cislo_popisne"), ulice: t(f, "ulice"), obec: t(f, "obec"), psc: t(f, "psc"),
    plocha_m2: n(f, "plocha_m2"), porizovaci_cena: n(f, "porizovaci_cena"), datum_porizeni: t(f, "datum_porizeni"),
    trzni_hodnota: n(f, "trzni_hodnota"), drive_folder_url: t(f, "drive_folder_url"), poznamka: t(f, "poznamka"),
  };
}

// jednotka pod budovou přebírá adresu a katastr z budovy
async function zdedit(supabase: Awaited<ReturnType<typeof supabaseServer>>, nadrazenaId: string | null) {
  if (!nadrazenaId) return null;
  const { data } = await supabase.from("nemovitost")
    .select("katastralni_uzemi, lv, ku_kod, cislo_popisne, ulice, obec, psc, zem_sirka, zem_delka, vlastnictvi(vlastnik_id, podil_citatel, podil_jmenovatel, platnost_od)")
    .eq("id", nadrazenaId).maybeSingle();
  return data;
}

export async function pridatNemovitost(f: FormData) {
  const supabase = await supabaseServer();
  const zaklad = udaje(f);
  const zpet = zaklad.nadrazena_id ? `/nemovitosti/nova?nadrazena=${zaklad.nadrazena_id}&` : "/nemovitosti/nova?";
  if (spatnaParcela(f)) redirect(`${zpet}chyba=${encodeURIComponent(spatnaParcela(f)!)}`);

  // ochrana proti dvojímu uložení: stejný název pod stejnou budovou už existuje
  let dup = supabase.from("nemovitost").select("id").eq("nazev", zaklad.nazev ?? "");
  dup = zaklad.nadrazena_id ? dup.eq("nadrazena_id", zaklad.nadrazena_id) : dup.is("nadrazena_id", null);
  const { data: existujici } = await dup.limit(1).maybeSingle();
  if (existujici) redirect(`/nemovitosti/${existujici.id}?chyba=${encodeURIComponent("Nemovitost s tímto názvem už existuje – nic dalšího se neuložilo.")}`);

  const rodic = await zdedit(supabase, zaklad.nadrazena_id);
  const zaznam = rodic ? {
    ...zaklad,
    kod_jednotky: zaklad.kod_jednotky ?? (zaklad.nazev ?? "").match(/\d{1,3}/)?.[0] ?? null, // NP001 (Pošta) → 001
    katastralni_uzemi: zaklad.katastralni_uzemi ?? rodic.katastralni_uzemi, lv: zaklad.lv ?? rodic.lv, ku_kod: rodic.ku_kod,
    cislo_popisne: zaklad.cislo_popisne ?? rodic.cislo_popisne, ulice: zaklad.ulice ?? rodic.ulice, obec: zaklad.obec ?? rodic.obec,
    psc: zaklad.psc ?? rodic.psc, zem_sirka: rodic.zem_sirka, zem_delka: rodic.zem_delka,
  } : {
    ...zaklad,
    zem_sirka: n(f, "zem_sirka"), zem_delka: n(f, "zem_delka"), ruian_adresni_misto: n(f, "ruian_adresni_misto"), ku_kod: n(f, "ku_kod"),
  };

  const { data, error } = await supabase.from("nemovitost").insert(zaznam).select("id").single();
  if (error) redirect(`${zpet}chyba=${encodeURIComponent(error.message)}`);

  // katastrální skladba
  const polozky = [];
  if (!rodic && t(f, "parcelni_cislo")) polozky.push({
    nemovitost_id: data.id, druh: "parcela", katastralni_uzemi: t(f, "katastralni_uzemi"), ku_kod: n(f, "ku_kod"),
    lv: t(f, "lv"), cislo_parcely: parcela(f), vymera_m2: n(f, "parcela_vymera"), druh_pozemku: t(f, "parcela_druh"),
    ruian_kod: n(f, "parcela_ruian"),
  });
  if (!rodic && t(f, "cislo_popisne") && ["B", "O"].includes(String(f.get("typ_kod")))) polozky.push({
    nemovitost_id: data.id, druh: "stavba", katastralni_uzemi: t(f, "katastralni_uzemi"), ku_kod: n(f, "ku_kod"),
    lv: t(f, "lv"), cislo_parcely: parcela(f), cislo_popisne: t(f, "cislo_popisne"),
  });
  if (rodic && t(f, "cislo_jednotky")) polozky.push({
    nemovitost_id: data.id, druh: "jednotka", katastralni_uzemi: rodic.katastralni_uzemi, ku_kod: rodic.ku_kod,
    lv: rodic.lv, cislo_jednotky: t(f, "cislo_jednotky"),
  });
  if (polozky.length) await supabase.from("katastralni_polozka").insert(polozky);

  // vlastnictví: zvolený vlastník, u jednotky stejný jako u budovy
  const vlastnik = t(f, "vlastnik_id");
  const vlastnictvi = vlastnik
    ? [{ nemovitost_id: data.id, vlastnik_id: vlastnik, podil_citatel: n(f, "podil_citatel") ?? 1, podil_jmenovatel: n(f, "podil_jmenovatel") ?? 1 }]
    : (rodic?.vlastnictvi ?? []).map((v: { vlastnik_id: string; podil_citatel: number; podil_jmenovatel: number; platnost_od: string | null }) => ({ ...v, nemovitost_id: data.id }));
  if (vlastnictvi.length) {
    const { error: e2 } = await supabase.from("vlastnictvi").insert(vlastnictvi);
    if (e2) redirect(`/nemovitosti/${data.id}?chyba=${encodeURIComponent("Nemovitost uložena, ale vlastnictví ne: " + e2.message)}`);
  }
  revalidatePath("/nemovitosti");
  redirect(rodic ? `/nemovitosti/${zaklad.nadrazena_id}` : `/nemovitosti/${data.id}`);
}

export async function upravitNemovitost(id: string, f: FormData) {
  const supabase = await supabaseServer();
  const z = udaje(f);
  // formulář jednotky neposílá adresu, katastr ani ceny – ty se nemění
  const jednotka = !f.has("katastralni_uzemi");
  const zmeny = jednotka
    ? { typ_kod: z.typ_kod, nazev: z.nazev, stav: z.stav, vyuziti: z.vyuziti, upozorneni: z.upozorneni, kod_jednotky: z.kod_jednotky, patro: z.patro, plocha_m2: z.plocha_m2, drive_folder_url: z.drive_folder_url, poznamka: z.poznamka }
    : z;
  if (spatnaParcela(f)) redirect(`/nemovitosti/${id}/upravit?chyba=${encodeURIComponent(spatnaParcela(f)!)}`);
  if (z.nadrazena_id === id && !jednotka) redirect(`/nemovitosti/${id}/upravit?chyba=${encodeURIComponent("Nemovitost nemůže patřit sama pod sebe.")}`);
  const { error } = await supabase.from("nemovitost").update(zmeny).eq("id", id);
  if (error) redirect(`/nemovitosti/${id}/upravit?chyba=${encodeURIComponent(error.message)}`);

  const vlastnik = t(f, "vlastnik_id");
  if (!jednotka && f.has("vlastnik_id")) {
    const { data: stavajici } = await supabase.from("vlastnictvi").select("id").eq("nemovitost_id", id);
    if ((stavajici ?? []).length <= 1) {
      await supabase.from("vlastnictvi").delete().eq("nemovitost_id", id);
      if (vlastnik) await supabase.from("vlastnictvi").insert({
        nemovitost_id: id, vlastnik_id: vlastnik, podil_citatel: n(f, "podil_citatel") ?? 1, podil_jmenovatel: n(f, "podil_jmenovatel") ?? 1,
      });
      // vlastník budovy se propíše do jejích jednotek
      const { data: deti } = await supabase.from("nemovitost").select("id").eq("nadrazena_id", id);
      const ids = (deti ?? []).map((d) => d.id);
      if (ids.length) {
        await supabase.from("vlastnictvi").delete().in("nemovitost_id", ids);
        if (vlastnik) await supabase.from("vlastnictvi").insert(ids.map((nid) => ({
          nemovitost_id: nid, vlastnik_id: vlastnik, podil_citatel: n(f, "podil_citatel") ?? 1, podil_jmenovatel: n(f, "podil_jmenovatel") ?? 1,
        })));
      }
    }
  }
  revalidatePath("/nemovitosti");
  redirect(`/nemovitosti/${id}`);
}

export async function smazatNemovitost(id: string, f: FormData) {
  if (f.get("potvrzeni") !== "on") redirect(`/nemovitosti/${id}/upravit`);
  const supabase = await supabaseServer();
  const [{ count: jednotek }, { count: smluv }] = await Promise.all([
    supabase.from("nemovitost").select("id", { count: "exact", head: true }).eq("nadrazena_id", id),
    supabase.from("najemni_smlouva").select("id", { count: "exact", head: true }).eq("nemovitost_id", id),
  ]);
  if (jednotek || smluv) redirect(`/nemovitosti/${id}/upravit?chyba=${encodeURIComponent(`Nelze smazat: nemovitost má ${jednotek ?? 0} jednotek a ${smluv ?? 0} nájemních smluv.`)}`);
  if (await mojeRole(supabase) !== "majitel") {
    const { data: n } = await supabase.from("nemovitost").select("nazev").eq("id", id).single();
    const e = await navrhnoutSmazani(supabase, { tabulka: "nemovitost", id, popis: `Nemovitost ${n?.nazev ?? ""}`, odkaz: `/nemovitosti/${id}` });
    redirect(`/nemovitosti/${id}?${e ? `chyba=${encodeURIComponent(e)}` : `zprava=${encodeURIComponent(NAVRZENO)}`}`);
  }
  const { error } = await supabase.from("nemovitost").delete().eq("id", id);
  if (error) redirect(`/nemovitosti/${id}/upravit?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/nemovitosti");
  redirect("/nemovitosti");
}

export async function pridatKatastralniPolozku(nemovitostId: string, f: FormData) {
  const supabase = await supabaseServer();
  const druh = t(f, "druh") ?? "parcela";
  let doplneno: Record<string, unknown> = {};
  let varovani: string | null = null;
  const { rozebratParcelu, parcelaPodleCisla } = await import("@/lib/ruian");
  const cp = t(f, "cislo_parcely");
  const rozbor = cp ? rozebratParcelu(cp) : null;
  if (cp && !rozbor) redirect(`/nemovitosti/${nemovitostId}?katastr_chyba=${encodeURIComponent(`Číslo parcely „${cp}“ nemá správný tvar – zadejte např. 1435/1, nebo u stavební parcely st. 3522. Nic se neuložilo.`)}#katastr`);
  if (druh === "parcela" && f.get("z_ruian") === "on" && t(f, "katastralni_uzemi") && cp) {
    try {
      const p = await parcelaPodleCisla(t(f, "katastralni_uzemi")!, cp);
      doplneno = { vymera_m2: p.vymera, druh_pozemku: p.druh, ruian_kod: p.ruian_kod, ku_kod: p.ku_kod, katastralni_uzemi: p.katastralni_uzemi };
    } catch (e) {
      varovani = `Uloženo, ale z RÚIAN se nepodařilo doplnit výměru: ${e instanceof Error ? e.message : "služba nedostupná"}`;
    }
  }
  const { error } = await supabase.from("katastralni_polozka").insert({
    nemovitost_id: nemovitostId, druh, katastralni_uzemi: t(f, "katastralni_uzemi"), lv: t(f, "lv"),
    cislo_parcely: rozbor?.zapis ?? cp, vymera_m2: n(f, "vymera_m2"), druh_pozemku: t(f, "druh_pozemku"),
    cislo_popisne: t(f, "cislo_popisne"), cislo_jednotky: t(f, "cislo_jednotky"),
    podil_citatel: n(f, "podil_citatel"), podil_jmenovatel: n(f, "podil_jmenovatel"), poznamka: t(f, "poznamka"),
    ...Object.fromEntries(Object.entries(doplneno).filter(([, v]) => v != null)),
  });
  if (error) redirect(`/nemovitosti/${nemovitostId}?katastr_chyba=${encodeURIComponent("Neuloženo: " + error.message)}#katastr`);
  revalidatePath(`/nemovitosti/${nemovitostId}`);
  redirect(`/nemovitosti/${nemovitostId}?${varovani ? `katastr_chyba=${encodeURIComponent(varovani)}` : `katastr_ok=1`}#katastr`);
}

export async function smazatKatastralniPolozku(nemovitostId: string, id: string) {
  const supabase = await supabaseServer();
  if (await mojeRole(supabase) !== "majitel") {
    const { data: k } = await supabase.from("katastralni_polozka").select("druh, cislo_parcely, cislo_popisne, cislo_jednotky").eq("id", id).single();
    const e = await navrhnoutSmazani(supabase, { tabulka: "katastralni_polozka", id, odkaz: `/nemovitosti/${nemovitostId}#katastr`,
      popis: `Katastr: ${k?.druh ?? ""} ${k?.cislo_parcely ?? k?.cislo_popisne ?? k?.cislo_jednotky ?? ""}` });
    redirect(`/nemovitosti/${nemovitostId}?${e ? `chyba=${encodeURIComponent(e)}` : `zprava=${encodeURIComponent(NAVRZENO)}`}`);
  }
  await supabase.from("katastralni_polozka").delete().eq("id", id);
  revalidatePath(`/nemovitosti/${nemovitostId}`);
}

export async function upravitKatastralniPolozku(nemovitostId: string, id: string, f: FormData) {
  const supabase = await supabaseServer();
  const { rozebratParcelu } = await import("@/lib/ruian");
  const cpU = t(f, "cislo_parcely");
  if (cpU && !rozebratParcelu(cpU)) redirect(`/nemovitosti/${nemovitostId}?uprav=${id}&katastr_chyba=${encodeURIComponent(`Číslo parcely „${cpU}“ nemá správný tvar – např. 1435/1 nebo st. 3522. Neuloženo.`)}#katastr`);
  if (cpU) f.set("cislo_parcely", rozebratParcelu(cpU)!.zapis);
  const { error } = await supabase.from("katastralni_polozka").update({
    druh: t(f, "druh") ?? "parcela", katastralni_uzemi: t(f, "katastralni_uzemi"), lv: t(f, "lv"),
    cislo_parcely: t(f, "cislo_parcely"), vymera_m2: n(f, "vymera_m2"), druh_pozemku: t(f, "druh_pozemku"),
    cislo_popisne: t(f, "cislo_popisne"), cislo_jednotky: t(f, "cislo_jednotky"),
    podil_citatel: n(f, "podil_citatel"), podil_jmenovatel: n(f, "podil_jmenovatel"), poznamka: t(f, "poznamka"),
  }).eq("id", id);
  if (error) redirect(`/nemovitosti/${nemovitostId}?uprav=${id}&katastr_chyba=${encodeURIComponent("Neuloženo: " + error.message)}#katastr`);
  revalidatePath(`/nemovitosti/${nemovitostId}`);
  redirect(`/nemovitosti/${nemovitostId}?katastr_ok=1#katastr`);
}


/** Archivace: záznam zůstane (platby, náklady, výnosnost), jen zmizí z běžných seznamů. Archivuje i podřízené jednotky. */
export async function archivovatNemovitost(id: string, f: FormData) {
  const supabase = await supabaseServer();
  const duvod = String(f.get("duvod") ?? "jine");
  const dne = String(f.get("dne") || new Date().toISOString().slice(0, 10));
  const { data: deti } = await supabase.from("nemovitost").select("id").eq("nadrazena_id", id);
  const ids = [id, ...(deti ?? []).map((d) => d.id)];
  const { count } = await supabase.from("najemni_smlouva").select("id", { count: "exact", head: true })
    .in("nemovitost_id", ids).in("stav", ["aktivni", "navrh"]);
  if (count) redirect(`/nemovitosti/${id}/upravit?chyba=${encodeURIComponent(`Na nemovitosti běží ${count} nájemní smlouv${count === 1 ? "a" : "y"}. Nejdřív ji ukončete (jinak by se dál generovaly platby).`)}`);
  const zmeny: Record<string, unknown> = { archivovano_dne: dne, duvod_archivace: duvod };
  const { error } = await supabase.from("nemovitost").update(zmeny).in("id", ids);
  if (error) redirect(`/nemovitosti/${id}/upravit?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/", "layout");
  redirect(`/nemovitosti/${id}`);
}

export async function obnovitNemovitost(id: string) {
  const supabase = await supabaseServer();
  const { data: deti } = await supabase.from("nemovitost").select("id").eq("nadrazena_id", id);
  await supabase.from("nemovitost").update({ archivovano_dne: null, duvod_archivace: null }).in("id", [id, ...(deti ?? []).map((d) => d.id)]);
  revalidatePath("/", "layout");
  redirect(`/nemovitosti/${id}`);
}

/** Omezení z listu vlastnictví (zástava, exekuce, věcné břemeno…). */
export async function pridatOmezeni(nemovitostId: string, f: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("omezeni").insert({
    nemovitost_id: nemovitostId, druh: t(f, "druh") ?? "jine", popis: t(f, "popis"), opravneny: t(f, "opravneny"), datum: t(f, "datum"),
  });
  if (error) redirect(`/nemovitosti/${nemovitostId}?chyba=${encodeURIComponent(error.message)}#omezeni`);
  revalidatePath(`/nemovitosti/${nemovitostId}`);
  redirect(`/nemovitosti/${nemovitostId}#omezeni`);
}

export async function smazatOmezeni(nemovitostId: string, id: string) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("omezeni").delete().eq("id", id);
  if (error) redirect(`/nemovitosti/${nemovitostId}?chyba=${encodeURIComponent(error.message)}#omezeni`);
  revalidatePath(`/nemovitosti/${nemovitostId}`);
  redirect(`/nemovitosti/${nemovitostId}#omezeni`);
}
