import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { FormularNemovitosti } from "@/components/FormularNemovitosti";
import { Odeslat } from "@/components/Odeslat";
import { upravitNemovitost, smazatNemovitost } from "../../actions";

export default async function UpravitNemovitost({ params, searchParams }: PageProps<"/nemovitosti/[id]/upravit">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data: x } = await supabase.from("nemovitost").select("*, vlastnictvi(vlastnik_id, podil_citatel, podil_jmenovatel)").eq("id", id).maybeSingle();
  if (!x) notFound();
  const [typy, budovy, vlastnici, rodic] = await Promise.all([
    supabase.from("typ_nemovitosti").select("kod, nazev").order("kod"),
    supabase.from("nemovitost").select("id, nazev").is("nadrazena_id", null).order("nazev"),
    supabase.from("vlastnik").select("id, nazev, zkratka").order("nazev"),
    x.nadrazena_id ? supabase.from("nemovitost").select("id, nazev, drive_folder_url").eq("id", x.nadrazena_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const vl = (x.vlastnictvi ?? []) as { vlastnik_id: string; podil_citatel: number; podil_jmenovatel: number }[];
  // jednotka = má nadřazenou budovu a sama nemá podřízené; areál s podřízenou budovou se upravuje plným formulářem
  const jednotka = rodic.data && ["J", "N", "O"].includes(x.typ_kod) ? rodic.data : null;

  return (
    <>
      <Nadpis titulek={`Upravit: ${x.nazev}`} />
      <Chyba text={chyba} />
      <FormularNemovitosti akce={upravitNemovitost.bind(null, id)} zrusit={`/nemovitosti/${id}`} v={x}
        typy={typy.data ?? []} budovy={budovy.data ?? []} vlastnici={vlastnici.data ?? []} rodic={jednotka}
        vlastnictvi={vl[0] ?? null} vice_vlastniku={vl.length > 1} />
      <form action={smazatNemovitost.bind(null, id)} className="mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
        <p className="mb-3 text-red-800">Smazat nemovitost včetně katastrální skladby a vlastnictví. Nejde smazat, pokud má jednotky nebo nájemní smlouvy.</p>
        <div className="flex items-center gap-4"><label className="flex items-center gap-2"><input type="checkbox" name="potvrzeni" required /> Ano, opravdu smazat</label><Odeslat svetle>Smazat nemovitost</Odeslat></div>
      </form>
    </>
  );
}
