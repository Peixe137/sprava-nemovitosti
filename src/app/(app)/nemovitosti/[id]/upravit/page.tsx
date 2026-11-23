import { moznostiNemovitosti } from "@/lib/vyberNemovitosti";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { FormularNemovitosti } from "@/components/FormularNemovitosti";
import { Odeslat } from "@/components/Odeslat";
import { upravitNemovitost, smazatNemovitost, archivovatNemovitost, obnovitNemovitost } from "../../actions";
import { DUVODY_ARCHIVACE, dnesIso } from "@/lib/format";

export default async function UpravitNemovitost({ params, searchParams }: PageProps<"/nemovitosti/[id]/upravit">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data: x } = await supabase.from("nemovitost").select("*, vlastnictvi(vlastnik_id, podil_citatel, podil_jmenovatel)").eq("id", id).maybeSingle();
  if (!x) notFound();
  const [typy, budovy, vlastnici, rodic] = await Promise.all([
    supabase.from("typ_nemovitosti").select("kod, nazev").order("kod"),
    moznostiNemovitosti(supabase, { jenBudovy: true }),
    supabase.from("vlastnik").select("id, nazev, zkratka").order("nazev"),
    x.nadrazena_id ? supabase.from("nemovitost").select("id, nazev, drive_folder_url, ulice, cislo_popisne, obec, katastralni_uzemi, lv, parcelni_cislo, datum_porizeni, vlastnictvi(vlastnik(nazev, zkratka))").eq("id", x.nadrazena_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const vl = (x.vlastnictvi ?? []) as { vlastnik_id: string; podil_citatel: number; podil_jmenovatel: number }[];
  // jednotka = má nadřazenou budovu a sama nemá podřízené; areál s podřízenou budovou se upravuje plným formulářem
  const r = rodic.data as (typeof rodic.data & { vlastnictvi?: { vlastnik: { nazev: string } | null }[] }) | null;
  const jednotka = r && ["J", "N", "O"].includes(x.typ_kod)
    ? { ...r, vlastnici: ((r.vlastnictvi ?? []) as unknown as { vlastnik: { nazev: string } | null }[]).map((v) => v.vlastnik?.nazev).filter(Boolean).join(", ") } : null;

  return (
    <>
      <Nadpis titulek={`Upravit: ${x.nazev}`} />
      <Chyba text={chyba} />
      <FormularNemovitosti akce={upravitNemovitost.bind(null, id)} zrusit={`/nemovitosti/${id}`} v={x}
        typy={typy.data ?? []} budovy={budovy} vlastnici={vlastnici.data ?? []} rodic={jednotka}
        vlastnictvi={vl[0] ?? null} vice_vlastniku={vl.length > 1} />
      {x.archivovano_dne ? (
        <form action={obnovitNemovitost.bind(null, id)} className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <p className="mb-3 text-slate-700">Nemovitost je v archivu ({DUVODY_ARCHIVACE[x.duvod_archivace ?? "jine"]}). Obnovením se vrátí mezi aktivní, i s jednotkami.</p>
          <Odeslat svetle>Obnovit z archivu</Odeslat>
        </form>
      ) : (
        <form action={archivovatNemovitost.bind(null, id)} className="mt-6 max-w-3xl rounded-xl border border-slate-200 bg-white p-5 text-sm">
          <h2 className="mb-1 font-semibold">Archivovat</h2>
          <p className="mb-3 text-slate-600">Pro prodanou nemovitost nebo ukončenou správu. Záznam i s platbami, náklady a dokumenty zůstane, jen zmizí z běžných přehledů{!x.nadrazena_id ? " – archivují se i jednotky pod ní" : ""}. Nájemní smlouvy musí být nejdřív ukončené.</p>
          <div className="flex flex-wrap items-end gap-3">
            <label className="block"><span className="stitek">Důvod</span>
              <select name="duvod" className="pole" defaultValue="prodano">
                {Object.entries(DUVODY_ARCHIVACE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select></label>
            <label className="block"><span className="stitek">Ke dni</span><input type="date" name="dne" defaultValue={dnesIso()} className="pole" /></label>
            <Odeslat svetle>Archivovat</Odeslat>
          </div>
        </form>
      )}
      <form action={smazatNemovitost.bind(null, id)} className="mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
        <p className="mb-3 text-red-800">Smazat nemovitost natrvalo – jen pro omyly a duplicity (prodej nebo konec správy řešte archivací). Maže se i katastrální skladba a vlastnictví. Nejde smazat, pokud má jednotky nebo nájemní smlouvy.</p>
        <div className="flex items-center gap-4"><label className="flex items-center gap-2"><input type="checkbox" name="potvrzeni" required /> Ano, opravdu smazat</label><Odeslat svetle>Smazat nemovitost</Odeslat></div>
      </form>
    </>
  );
}
