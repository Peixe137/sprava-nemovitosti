import "server-only";
import type { supabaseServer } from "@/lib/supabase/server";
type Db = Awaited<ReturnType<typeof supabaseServer>>;

export const ROLE: Record<string, string> = {
  majitel: "Administrátor", spravce: "Správce", ucetni: "Účetní", host: "Host", vlastnik: "Vlastník (klient)", najemnik: "Nájemník",
};
export const POPIS_ROLE: Record<string, string> = {
  majitel: "vše včetně mazání, uživatelů a schvalování",
  spravce: "zakládá a upravuje, mazání jen navrhuje ke schválení",
  ucetni: "upravuje platby, náklady a vyúčtování, ostatní jen čte",
  host: "jen čtení",
};

export async function mojeRole(supabase: Db): Promise<string | null> {
  const { data } = await supabase.rpc("moje_aktualni_role");
  return (data as string | null) ?? null;
}

/** Správce a účetní nemažou: zapíše žádost o smazání pro administrátora. Vrací text chyby, nebo null. */
export async function navrhnoutSmazani(supabase: Db, z: { tabulka: string; id: string; popis: string; odkaz?: string; duvod?: string | null }) {
  const { error } = await supabase.from("zadost_smazani").insert({
    tabulka: z.tabulka, zaznam_id: z.id, popis: z.popis, odkaz: z.odkaz ?? null, duvod: z.duvod ?? null,
  });
  if (error?.code === "23505") return null; // už čeká na schválení
  return error?.message ?? null;
}

export const NAVRZENO = "Smazání čeká na schválení administrátorem.";
