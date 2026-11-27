"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";
import { mojeRole } from "@/lib/role";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };
const ROLE_OK = ["majitel", "spravce", "ucetni", "host", "udrzbar"];

async function jenAdmin(kam: string) {
  const supabase = await supabaseServer();
  if (await mojeRole(supabase) !== "majitel") redirect(`${kam}?chyba=${encodeURIComponent("Tohle může jen administrátor.")}`);
  return supabase;
}

// ---------- uživatelé ----------
export async function pridatUzivatele(f: FormData) {
  const supabase = await jenAdmin("/nastaveni/uzivatele");
  const email = t(f, "email"), role = t(f, "role") ?? "host";
  if (!email || !ROLE_OK.includes(role)) redirect("/nastaveni/uzivatele?chyba=" + encodeURIComponent("Vyplňte e-mail a roli."));
  const h = await headers();
  const zaklad = `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`;
  const { data, error } = await supabase.functions.invoke("pozvat-uzivatele", {
    body: { email, role, jmeno: t(f, "jmeno"), telefon: t(f, "telefon"), presmerovat: `${zaklad}/heslo` },
  });
  if (error) {
    let text = error.message;
    try { text = (await (error as { context?: Response }).context?.json())?.chyba ?? text; } catch {}
    redirect("/nastaveni/uzivatele?chyba=" + encodeURIComponent(text));
  }
  revalidatePath("/nastaveni/uzivatele");
  redirect("/nastaveni/uzivatele?zprava=" + encodeURIComponent((data as { pozvan?: boolean })?.pozvan
    ? `Pozvánka odeslána na ${email}. Po kliknutí na odkaz si nastaví heslo.` : `${email} už účet měl – byl přidán s rolí.`));
}

export async function upravitUzivatele(userId: string, f: FormData) {
  const supabase = await jenAdmin("/nastaveni/uzivatele");
  const { error } = await supabase.rpc("upravit_clena", { p_user: userId, p_jmeno: t(f, "jmeno") ?? "", p_telefon: t(f, "telefon") ?? "" });
  if (error) redirect("/nastaveni/uzivatele?chyba=" + encodeURIComponent(error.message));
  revalidatePath("/nastaveni/uzivatele");
  redirect("/nastaveni/uzivatele");
}

export async function zmenitRoli(userId: string, f: FormData) {
  const supabase = await jenAdmin("/nastaveni/uzivatele");
  const role = t(f, "role") ?? "";
  const { data: ja } = await supabase.auth.getClaims();
  if (ja?.claims?.sub === userId) redirect("/nastaveni/uzivatele?chyba=" + encodeURIComponent("Svou vlastní roli změnit nelze (aby nezůstala organizace bez administrátora)."));
  if (!ROLE_OK.includes(role)) redirect("/nastaveni/uzivatele");
  const { error } = await supabase.from("clenstvi").update({ role }).eq("user_id", userId);
  if (error) redirect("/nastaveni/uzivatele?chyba=" + encodeURIComponent(error.message));
  revalidatePath("/nastaveni/uzivatele");
  redirect("/nastaveni/uzivatele?zprava=" + encodeURIComponent("Role změněna."));
}

export async function odebratUzivatele(userId: string, f: FormData) {
  if (f.get("potvrzeni") !== "on") redirect("/nastaveni/uzivatele");
  const supabase = await jenAdmin("/nastaveni/uzivatele");
  const { data: ja } = await supabase.auth.getClaims();
  if (ja?.claims?.sub === userId) redirect("/nastaveni/uzivatele?chyba=" + encodeURIComponent("Sebe odebrat nelze."));
  const { error } = await supabase.from("clenstvi").delete().eq("user_id", userId);
  if (error) redirect("/nastaveni/uzivatele?chyba=" + encodeURIComponent(error.message));
  revalidatePath("/nastaveni/uzivatele");
  redirect("/nastaveni/uzivatele?zprava=" + encodeURIComponent("Uživatel odebrán z organizace (jeho účet zůstává)."));
}

// ---------- žádosti o smazání ----------
async function vyridit(id: string, stav: "schvaleno" | "zamitnuto") {
  const supabase = await supabaseServer();
  const { data: ja } = await supabase.auth.getClaims();
  await supabase.from("zadost_smazani").update({ stav, vyridil: ja?.claims?.sub, vyrizeno: new Date().toISOString() }).eq("id", id);
}

export async function schvalitSmazani(id: string) {
  const supabase = await jenAdmin("/nastaveni/schvaleni");
  const { data: z } = await supabase.from("zadost_smazani").select("*").eq("id", id).eq("stav", "navrh").maybeSingle();
  if (!z) redirect("/nastaveni/schvaleni");
  const chyba = (m: string) => redirect("/nastaveni/schvaleni?chyba=" + encodeURIComponent(`${z.popis}: ${m}`));

  if (z.tabulka === "nemovitost") {
    const [{ count: j }, { count: s }] = await Promise.all([
      supabase.from("nemovitost").select("id", { count: "exact", head: true }).eq("nadrazena_id", z.zaznam_id),
      supabase.from("najemni_smlouva").select("id", { count: "exact", head: true }).eq("nemovitost_id", z.zaznam_id),
    ]);
    if (j || s) chyba(`nelze smazat, má ${j ?? 0} jednotek a ${s ?? 0} smluv.`);
  }
  let smlouva: string | null = null;
  if (z.tabulka === "predpis_polozka") {
    const { data: p } = await supabase.from("predpis_polozka").select("smlouva_id").eq("id", z.zaznam_id).maybeSingle();
    smlouva = p?.smlouva_id ?? null;
  }
  const { error } = await supabase.from(z.tabulka).delete().eq("id", z.zaznam_id);
  if (error) chyba(error.message);
  if (smlouva) await supabase.rpc("prepocitat_pohledavky", { p_smlouva: smlouva });
  await vyridit(id, "schvaleno");
  revalidatePath("/", "layout");
  redirect("/nastaveni/schvaleni?zprava=" + encodeURIComponent(`Smazáno: ${z.popis}`));
}

export async function zamitnoutSmazani(id: string) {
  await jenAdmin("/nastaveni/schvaleni");
  await vyridit(id, "zamitnuto");
  revalidatePath("/nastaveni/schvaleni");
  redirect("/nastaveni/schvaleni?zprava=" + encodeURIComponent("Žádost zamítnuta, záznam zůstává."));
}
