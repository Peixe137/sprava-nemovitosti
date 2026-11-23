"use server";
import { hledatAdresu, detailMista, type NalezenaAdresa, type DetailMista } from "@/lib/ruian";
import { supabaseServer } from "@/lib/supabase/server";

async function prihlasen() {
  const { data } = await (await supabaseServer()).auth.getClaims();
  return !!data?.claims;
}

export async function ruianHledat(text: string): Promise<NalezenaAdresa[]> {
  if (!(await prihlasen())) return [];
  try { return await hledatAdresu(text); } catch { return []; }
}

export async function ruianDetail(x: number, y: number): Promise<{ ok: true; data: DetailMista } | { ok: false; chyba: string }> {
  if (!(await prihlasen())) return { ok: false, chyba: "Nejste přihlášen." };
  try { return { ok: true, data: await detailMista(x, y) }; }
  catch (e) { return { ok: false, chyba: e instanceof Error ? e.message : "Chyba RÚIAN" }; }
}
