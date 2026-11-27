"use server";
import { revalidatePath } from "next/cache";
import { supabaseServer } from "@/lib/supabase/server";

/** Smazání přílohy (soubor i záznam). Mazat smí správce a administrátor (hlídá RLS). */
export async function smazatPrilohu(id: string, cesta: string) {
  const supabase = await supabaseServer();
  const { data: p } = await supabase.from("priloha").select("cesta").eq("id", id).maybeSingle();
  if (!p) return;
  const { error } = await supabase.from("priloha").delete().eq("id", id);
  if (!error) await supabase.storage.from("prilohy").remove([p.cesta]);
  revalidatePath(cesta);
}
