"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

const t = (f: FormData, k: string) => { const v = String(f.get(k) ?? "").trim(); return v === "" ? null : v; };

export async function pridatVlastnika(f: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.from("vlastnik").insert({
    druh: t(f, "druh"), nazev: t(f, "nazev"), zkratka: t(f, "zkratka")?.replace(/^@/, "") ?? null,
    pravni_forma: t(f, "pravni_forma") ?? "PO", ico: t(f, "ico"), dic: t(f, "dic"), adresa: t(f, "adresa"), platce_dph: f.get("platce_dph") === "on",
    email: t(f, "email"), telefon: t(f, "telefon"),
  });
  if (error) redirect(`/vlastnici?chyba=${encodeURIComponent(error.message)}`);
  revalidatePath("/vlastnici");
  redirect("/vlastnici");
}
