import { moznostiNemovitosti } from "@/lib/vyberNemovitosti";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { FormularNemovitosti } from "@/components/FormularNemovitosti";
import { pridatNemovitost } from "../actions";

export default async function NovaNemovitost({ searchParams }: PageProps<"/nemovitosti/nova">) {
  const { chyba, nadrazena } = await searchParams;
  const supabase = await supabaseServer();
  const [typy, budovy, vlastnici, rodic] = await Promise.all([
    supabase.from("typ_nemovitosti").select("kod, nazev").order("kod"),
    moznostiNemovitosti(supabase, { jenBudovy: true }),
    supabase.from("vlastnik").select("id, nazev, zkratka").order("nazev"),
    nadrazena ? supabase.from("nemovitost").select("id, nazev, drive_folder_url, ulice, cislo_popisne, obec, katastralni_uzemi, lv, parcelni_cislo, datum_porizeni, vlastnictvi(vlastnik(nazev, zkratka))").eq("id", String(nadrazena)).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const r = rodic.data as (typeof rodic.data & { vlastnictvi?: { vlastnik: { nazev: string; zkratka: string | null } | null }[] }) | null;
  const rodicInfo = r ? { ...r, vlastnici: ((r.vlastnictvi ?? []) as unknown as { vlastnik: { nazev: string } | null }[]).map((v) => v.vlastnik?.nazev).filter(Boolean).join(", ") } : null;
  return (
    <>
      <Nadpis titulek={rodic.data ? "Nová jednotka" : "Nová nemovitost"} />
      <Chyba text={chyba} />
      <FormularNemovitosti akce={pridatNemovitost} zrusit={rodic.data ? `/nemovitosti/${rodic.data.id}` : "/nemovitosti"}
        typy={typy.data ?? []} budovy={budovy} vlastnici={vlastnici.data ?? []} rodic={rodicInfo} />
    </>
  );
}
