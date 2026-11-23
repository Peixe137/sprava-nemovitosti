"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const n = (f: FormData, k: string) => { const v = t(f, k); return v == null ? null : Number(v.replace(/\s/g, "").replace(",", ".")); };

/** Uloží novou (id = null) nebo upravenou rezervaci. Hlídá překryv termínů na stejné nemovitosti. */
export async function ulozitRezervaci(id: string | null, f: FormData) {
  const supabase = await supabaseServer();
  const zpet = (m: string) => redirect(`${id ? `/kratkodobe/${id}` : "/kratkodobe/nova"}?chyba=${encodeURIComponent(m)}`);
  const nem = t(f, "nemovitost_id"), prijezd = t(f, "prijezd"), odjezd = t(f, "odjezd");
  if (!nem || !prijezd || !odjezd) zpet("Vyplňte nemovitost, příjezd a odjezd.");
  if (odjezd! <= prijezd!) zpet("Odjezd musí být po příjezdu.");
  const stav = t(f, "stav") ?? "potvrzena";

  if (stav !== "zrusena") {
    let q = supabase.from("rezervace").select("host, prijezd, odjezd").eq("nemovitost_id", nem!).neq("stav", "zrusena")
      .lt("prijezd", odjezd!).gt("odjezd", prijezd!);
    if (id) q = q.neq("id", id);
    const { data: kolize } = await q.limit(1).maybeSingle();
    if (kolize) zpet(`Termín se překrývá s rezervací ${kolize.host ?? ""} (${kolize.prijezd} – ${kolize.odjezd}).`);
  }

  const cena = n(f, "cena_ubytovani"), uklid = n(f, "uklid"), provize = n(f, "poplatek_platformy");
  // výplata: když není zadaná, odhadne se jako ubytování + úklid − provize platformy
  const vyplata = n(f, "vyplata") ?? (cena != null ? Math.round(((cena ?? 0) + (uklid ?? 0) - (provize ?? 0)) * 100) / 100 : null);
  const zaznam = {
    nemovitost_id: nem, platforma: t(f, "platforma") ?? "airbnb", kod_rezervace: t(f, "kod_rezervace"),
    host: t(f, "host"), host_email: t(f, "host_email"), host_telefon: t(f, "host_telefon"), pocet_hostu: n(f, "pocet_hostu"),
    prijezd, odjezd, cena_ubytovani: cena, uklid, poplatek_platformy: provize, poplatek_z_pobytu: n(f, "poplatek_z_pobytu"),
    vyplata, datum_vyplaty: t(f, "datum_vyplaty"), stav, poznamka: t(f, "poznamka"),
  };
  const { data, error } = id
    ? await supabase.from("rezervace").update(zaznam).eq("id", id).select("id").single()
    : await supabase.from("rezervace").insert(zaznam).select("id").single();
  if (error) zpet(error.code === "23505" ? "Rezervace s tímto kódem už existuje." : error.message);
  revalidatePath("/kratkodobe");
  redirect(`/kratkodobe?m=${prijezd!.slice(0, 7)}&ulozeno=${data!.id}`);
}

export async function smazatRezervaci(id: string, f: FormData) {
  if (f.get("potvrzeni") !== "on") redirect(`/kratkodobe/${id}`);
  const supabase = await supabaseServer();
  await supabase.from("rezervace").delete().eq("id", id);
  revalidatePath("/kratkodobe");
  redirect("/kratkodobe");
}
