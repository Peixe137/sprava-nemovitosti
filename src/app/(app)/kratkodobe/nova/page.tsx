import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { FormularRezervace } from "@/components/FormularRezervace";
import { ulozitRezervaci } from "../actions";

export default async function NovaRezervace({ searchParams }: PageProps<"/kratkodobe/nova">) {
  const { chyba, nemovitost, prijezd } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("nemovitost").select("id, nazev, vyuziti").is("archivovano_dne", null).order("nazev");
  // krátkodobé nahoře, ostatní pod nimi
  const nem = [...(data ?? [])].sort((a, b) => Number(b.vyuziti === "kratkodoby") - Number(a.vyuziti === "kratkodoby"));
  return (
    <>
      <Nadpis titulek="Nová rezervace" />
      <Chyba text={chyba} />
      <FormularRezervace akce={ulozitRezervaci.bind(null, null)} nemovitosti={nem} vychoziNemovitost={nemovitost ? String(nemovitost) : undefined}
        v={prijezd ? { prijezd: String(prijezd) } : undefined} />
    </>
  );
}
