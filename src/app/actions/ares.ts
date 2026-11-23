"use server";
import { nacistZAres, type AresVysledek } from "@/lib/ares";
import { supabaseServer } from "@/lib/supabase/server";

export async function aresPodleIco(ico: string): Promise<{ ok: true; data: AresVysledek } | { ok: false; chyba: string }> {
  // jen pro přihlášené
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) return { ok: false, chyba: "Nejste přihlášen." };
  try {
    return { ok: true, data: await nacistZAres(ico) };
  } catch (e) {
    return { ok: false, chyba: e instanceof Error ? e.message : "Chyba při načítání z ARES." };
  }
}
