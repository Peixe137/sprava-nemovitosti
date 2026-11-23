import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { FormularNemovitosti } from "@/components/FormularNemovitosti";
import { pridatNemovitost } from "../actions";

export default async function NovaNemovitost({ searchParams }: PageProps<"/nemovitosti/nova">) {
  const { chyba, nadrazena } = await searchParams;
  const supabase = await supabaseServer();
  const [typy, budovy, vlastnici, rodic] = await Promise.all([
    supabase.from("typ_nemovitosti").select("kod, nazev").order("kod"),
    supabase.from("nemovitost").select("id, nazev").is("nadrazena_id", null).order("nazev"),
    supabase.from("vlastnik").select("id, nazev, zkratka").order("nazev"),
    nadrazena ? supabase.from("nemovitost").select("id, nazev, drive_folder_url").eq("id", String(nadrazena)).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <Nadpis titulek={rodic.data ? "Nová jednotka" : "Nová nemovitost"} />
      <Chyba text={chyba} />
      <FormularNemovitosti akce={pridatNemovitost} zrusit={rodic.data ? `/nemovitosti/${rodic.data.id}` : "/nemovitosti"}
        typy={typy.data ?? []} budovy={budovy.data ?? []} vlastnici={vlastnici.data ?? []} rodic={rodic.data} />
    </>
  );
}
